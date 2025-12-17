"""
Get Session Status Lambda Function

Returns the current status of a session or all sessions for a student.
"""

import logging
import os
import sys

# Add common layer to path
sys.path.insert(0, "/opt/python")

from utils import (
    DynamoDBClient,
    EC2Client,
    GuacamoleClient,
    InstanceStatus,
    SessionStatus,
    error_response,
    get_current_timestamp,
    get_path_parameter,
    success_response,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
SESSIONS_TABLE = os.environ.get("SESSIONS_TABLE")
INSTANCE_POOL_TABLE = os.environ.get("INSTANCE_POOL_TABLE")
GUACAMOLE_PRIVATE_IP = os.environ.get("GUACAMOLE_PRIVATE_IP", "")
GUACAMOLE_PUBLIC_IP = os.environ.get("GUACAMOLE_PUBLIC_IP", "")
GUACAMOLE_API_URL = os.environ.get("GUACAMOLE_API_URL", "")
GUACAMOLE_ADMIN_USER = os.environ.get("GUACAMOLE_ADMIN_USER", "guacadmin")
GUACAMOLE_ADMIN_PASS = os.environ.get("GUACAMOLE_ADMIN_PASS", "guacadmin")
RDP_USERNAME = os.environ.get("RDP_USERNAME", "kali")
RDP_PASSWORD = os.environ.get("RDP_PASSWORD", "kali")


def get_guacamole_public_url() -> str:
    """Get the public-facing Guacamole URL for students."""
    if GUACAMOLE_API_URL:
        return GUACAMOLE_API_URL
    if GUACAMOLE_PUBLIC_IP:
        return f"https://{GUACAMOLE_PUBLIC_IP}/guacamole"
    if GUACAMOLE_PRIVATE_IP:
        # Fallback to private IP (won't work for external access)
        logger.warning("Using private IP for Guacamole URL - external access won't work!")
        return f"https://{GUACAMOLE_PRIVATE_IP}/guacamole"
    return ""


def handler(event, context):
    """
    Main handler for session status requests.
    
    Routes:
    - GET /sessions/{sessionId} - Get specific session
    - GET /students/{studentId}/sessions - Get all sessions for a student
    """
    logger.info(f"Get session status request: {event}")
    
    try:
        # Initialize clients
        sessions_db = DynamoDBClient(SESSIONS_TABLE)
        pool_db = DynamoDBClient(INSTANCE_POOL_TABLE)
        ec2_client = EC2Client()
        
        # Determine which route was called
        route_key = event.get("routeKey", "")
        
        if "sessionId" in (event.get("pathParameters") or {}):
            # Get specific session
            session_id = get_path_parameter(event, "sessionId")
            return get_session_by_id(session_id, sessions_db, pool_db, ec2_client)
        
        elif "studentId" in (event.get("pathParameters") or {}):
            # Get all sessions for student
            student_id = get_path_parameter(event, "studentId")
            return get_sessions_by_student(student_id, sessions_db, pool_db, ec2_client)
        
        else:
            return error_response(400, "Missing sessionId or studentId parameter")
    
    except Exception as e:
        logger.exception("Error getting session status")
        return error_response(500, "Internal server error", str(e))


def get_session_by_id(session_id: str, sessions_db, pool_db, ec2_client):
    """Get a specific session by ID."""
    if not session_id:
        return error_response(400, "Missing sessionId")
    
    session = sessions_db.get_item({"session_id": session_id})
    
    if not session:
        return error_response(404, "Session not found")
    
    # Store original status to detect changes
    original_status = session.get("status")
    
    # Enrich session with live instance status if applicable
    session = enrich_session_status(session, pool_db, ec2_client)
    
    # Persist status change if it was updated
    if session.get("status") != original_status:
        update_data = {
            "status": session["status"],
            "updated_at": get_current_timestamp(),
            "instance_state": session.get("instance_state"),
            "instance_ip": session.get("instance_ip"),
        }
        
        # Also persist connection info when session becomes ready
        if session.get("status") == SessionStatus.READY:
            if session.get("connection_info"):
                update_data["connection_info"] = session["connection_info"]
            if session.get("direct_url"):
                update_data["direct_url"] = session["direct_url"]
        
        sessions_db.update_item({"session_id": session_id}, update_data)
        logger.info(f"Session {session_id} status updated: {original_status} -> {session['status']}")
    
    return success_response(
        format_session_response(session),
        "Session retrieved"
    )


def get_sessions_by_student(student_id: str, sessions_db, pool_db, ec2_client):
    """Get all sessions for a student."""
    if not student_id:
        return error_response(400, "Missing studentId")
    
    sessions = sessions_db.query_by_index("StudentIndex", "student_id", student_id)
    
    # Enrich each session and persist status updates
    enriched_sessions = []
    for session in sessions:
        original_status = session.get("status")
        session = enrich_session_status(session, pool_db, ec2_client)
        
        # Persist status change if it was updated
        if session.get("status") != original_status:
            update_data = {
                "status": session["status"],
                "updated_at": get_current_timestamp(),
                "instance_state": session.get("instance_state"),
                "instance_ip": session.get("instance_ip"),
            }
            
            # Also persist connection info when session becomes ready
            if session.get("status") == SessionStatus.READY:
                if session.get("connection_info"):
                    update_data["connection_info"] = session["connection_info"]
                if session.get("direct_url"):
                    update_data["direct_url"] = session["direct_url"]
            
            sessions_db.update_item({"session_id": session["session_id"]}, update_data)
            logger.info(f"Session {session['session_id']} status updated: {original_status} -> {session['status']}")
        
        enriched_sessions.append(format_session_response(session))
    
    # Sort by created_at descending
    enriched_sessions.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    
    # Separate active and historical
    active_sessions = [
        s for s in enriched_sessions
        if s.get("status") in [SessionStatus.PENDING, SessionStatus.PROVISIONING,
                                SessionStatus.READY, SessionStatus.ACTIVE]
    ]
    
    return success_response(
        {
            "student_id": student_id,
            "active_sessions": active_sessions,
            "total_sessions": len(enriched_sessions),
            "sessions": enriched_sessions[:10],  # Last 10 sessions
        },
        f"Found {len(active_sessions)} active session(s)"
    )


def enrich_session_status(session: dict, pool_db, ec2_client) -> dict:
    """Enrich session with live instance status."""
    instance_id = session.get("instance_id")
    
    # Check if session has expired
    now = get_current_timestamp()
    expires_at = session.get("expires_at", 0)
    
    if expires_at and now > expires_at:
        session["status"] = SessionStatus.TERMINATED
        session["termination_reason"] = "expired"
        return session
    
    # If no instance assigned, try to allocate one from available pool
    if not instance_id and session.get("status") == SessionStatus.PROVISIONING:
        created_at = session.get("created_at", 0)
        time_waiting = now - created_at
        
        # Try to find an available instance for this waiting session
        # Query for available instances in the pool
        try:
            available_instances = pool_db.query_by_index(
                "StatusIndex", "status", InstanceStatus.AVAILABLE
            )
            
            if available_instances:
                # Try to claim the first available instance
                candidate = available_instances[0]
                candidate_id = candidate["instance_id"]
                
                # Verify instance is actually running
                instance_info = ec2_client.get_instance_status(candidate_id)
                if instance_info and instance_info.get("State", {}).get("Name") == "running":
                    # Atomically claim this instance for the session
                    update_success = pool_db.conditional_update(
                        {"instance_id": candidate_id},
                        {
                            "status": InstanceStatus.ASSIGNED,
                            "session_id": session["session_id"],
                            "student_id": session.get("student_id"),
                            "assigned_at": now,
                        },
                        condition_expression="#status = :available",
                        expression_attribute_names={"#status": "status"},
                        expression_attribute_values={":available": InstanceStatus.AVAILABLE}
                    )
                    
                    if update_success:
                        # Successfully claimed the instance - update session
                        instance_id = candidate_id
                        instance_ip = instance_info.get("PrivateIpAddress")
                        
                        session["instance_id"] = instance_id
                        session["instance_ip"] = instance_ip
                        session["updated_at"] = now
                        
                        logger.info(f"Allocated instance {instance_id} to waiting session {session['session_id']} after {time_waiting}s")
                        
                        # Don't return yet - let the code below continue to check health
                    else:
                        logger.info(f"Failed to claim instance {candidate_id}, it was taken by another session")
        except Exception as e:
            logger.warning(f"Error trying to allocate instance for waiting session: {str(e)}")
        
        # If still no instance after trying to allocate, check timeout
        if not session.get("instance_id"):
            # If session has been in provisioning for more than 5 minutes without an instance, mark as error
            # Warm pool instances take 30-60s to start + 60-120s for status checks = up to 3 minutes
            # ASG scale-up can take 3-5 minutes for new instances
            if time_waiting > 300:
                logger.error(f"Session {session.get('session_id')} stuck in provisioning without instance for {time_waiting}s")
                session["status"] = SessionStatus.ERROR
                session["error"] = "Instance allocation timed out. The system may be at capacity. Please try again in a moment."
            elif time_waiting > 240:
                # Warn at 4 minutes but don't fail yet
                logger.warning(f"Session {session.get('session_id')} still waiting for instance after {time_waiting}s")
            
            return session
    
    # If no instance_id but session has instance_ip (edge case from previous allocation)
    # Try to create Guacamole connection with the existing IP
    if not instance_id:
        instance_ip = session.get("instance_ip")
        if instance_ip and session.get("status") == SessionStatus.READY:
            # Session is ready with an IP but no instance_id - try to create Guacamole connection
            existing_conn = session.get("connection_info") or {}
            guac_connection_exists = existing_conn.get("guacamole_connection_id") is not None
            
            if not guac_connection_exists and not session.get("direct_url"):
                logger.info(f"Session {session['session_id']} has IP but no instance_id - attempting Guacamole connection")
                try:
                    guac_result = create_guacamole_connection(
                        session_id=session["session_id"],
                        instance_ip=instance_ip,
                        student_id=session.get("student_id", ""),
                    )
                    
                    if guac_result and guac_result.get("guacamole_connection_url"):
                        session["connection_info"] = {
                            "type": "guacamole",
                            "guacamole_url": guac_result.get("guacamole_base_url"),
                            "guacamole_connection_id": guac_result.get("guacamole_connection_id"),
                            "instance_ip": instance_ip,
                            "rdp_port": 3389,
                            "vnc_port": 5901,
                            "ssh_port": 22,
                        }
                        session["direct_url"] = guac_result.get("guacamole_connection_url")
                        logger.info(f"Successfully created Guacamole connection for session {session['session_id']} (no instance_id)")
                    else:
                        logger.warning(f"Guacamole connection creation returned empty result for session {session['session_id']} (no instance_id)")
                except Exception as e:
                    logger.error(f"Exception creating Guacamole connection for session {session['session_id']} (no instance_id): {str(e)}", exc_info=True)
        return session
    
    # Get live instance status
    instance_info = ec2_client.get_instance_status(instance_id)
    
    if not instance_info:
        # Instance not found
        if session.get("status") not in [SessionStatus.TERMINATED, SessionStatus.ERROR]:
            session["status"] = SessionStatus.ERROR
            session["error"] = "Instance not found"
        return session
    
    instance_state = instance_info.get("State", {}).get("Name", "unknown")
    instance_ip = instance_info.get("PrivateIpAddress")
    health_checks = instance_info.get("HealthChecks", {})
    
    # Update session based on instance state and health checks
    if instance_state == "running":
        session["instance_ip"] = instance_ip
        session["instance_state"] = instance_state
        
        # Store health check status for debugging
        session["health_checks"] = {
            "system_status": health_checks.get("system_status", "unknown"),
            "instance_status": health_checks.get("instance_status", "unknown"),
            "all_passed": health_checks.get("all_passed", False)
        }
        
        # Calculate how long instance has been running
        created_at = session.get("created_at", 0)
        time_running = now - created_at  # seconds
        
        # Check if health checks passed OR timeout fallback (2 minutes)
        health_passed = health_checks.get("all_passed", False)
        timeout_fallback = time_running > 120  # 2 minutes - reduced from 5 for faster UX
        
        if health_passed or timeout_fallback:
            if session.get("status") == SessionStatus.PROVISIONING:
                session["status"] = SessionStatus.READY
                if timeout_fallback and not health_passed:
                    logger.warning(
                        f"Session {session.get('session_id')} marked ready after timeout. "
                        f"Health checks: {health_checks}"
                    )
            
            # Build/update connection info only when fully ready and Guacamole connection not yet created
            # Check if guacamole_connection_id exists (not just connection_info, which may have basic fallback info)
            existing_conn = session.get("connection_info") or {}
            guac_connection_exists = existing_conn.get("guacamole_connection_id") is not None
            
            if instance_ip and not guac_connection_exists and not session.get("direct_url"):
                # Create Guacamole connection with direct URL
                try:
                    logger.info(f"Attempting to create Guacamole connection for session {session['session_id']}")
                    guac_result = create_guacamole_connection(
                        session_id=session["session_id"],
                        instance_ip=instance_ip,
                        student_id=session.get("student_id", ""),
                    )
                    
                    if guac_result and guac_result.get("guacamole_connection_url"):
                        session["connection_info"] = {
                            "type": "guacamole",
                            "guacamole_url": guac_result.get("guacamole_base_url"),
                            "guacamole_connection_id": guac_result.get("guacamole_connection_id"),
                            "instance_ip": instance_ip,
                            "rdp_port": 3389,
                            "vnc_port": 5901,
                            "ssh_port": 22,
                        }
                        session["direct_url"] = guac_result.get("guacamole_connection_url")
                        logger.info(f"Successfully created Guacamole connection for session {session['session_id']}")
                    else:
                        # Log warning but don't fail the entire request
                        logger.warning(f"Guacamole connection creation returned empty result for session {session['session_id']}")
                        # Don't overwrite connection_info with fallback - let it retry on next poll
                        if not session.get("connection_info"):
                            session["connection_info"] = {
                                "type": "guacamole",
                                "instance_ip": instance_ip,
                                "rdp_port": 3389,
                                "vnc_port": 5901,
                                "ssh_port": 22,
                            }
                        
                except Exception as e:
                    # Log error but don't crash - return session with basic info
                    logger.error(f"Exception creating Guacamole connection for session {session['session_id']}: {str(e)}", exc_info=True)
                    # Don't overwrite connection_info with fallback - let it retry on next poll
                    if not session.get("connection_info"):
                        session["connection_info"] = {
                            "type": "guacamole",
                            "instance_ip": instance_ip,
                            "rdp_port": 3389,
                            "vnc_port": 5901,
                            "ssh_port": 22,
                        }
        else:
            # Instance running but health checks not passed yet
            # Keep status as PROVISIONING to show "waiting for health checks"
            if session.get("status") != SessionStatus.READY:
                session["status"] = SessionStatus.PROVISIONING
                session["provisioning_stage"] = "waiting_health_checks"
    
    elif instance_state == "pending":
        session["status"] = SessionStatus.PROVISIONING
        session["instance_state"] = instance_state
    
    elif instance_state in ["stopping", "shutting-down"]:
        session["status"] = SessionStatus.TERMINATING
        session["instance_state"] = instance_state
    
    elif instance_state in ["stopped", "terminated"]:
        session["status"] = SessionStatus.TERMINATED
        session["instance_state"] = instance_state
    
    return session


def get_guacamole_api_url() -> str:
    """
    Get the best URL for Guacamole API calls.
    Prefers GUACAMOLE_API_URL (public), then public IP, then private IP.
    """
    if GUACAMOLE_API_URL:
        return GUACAMOLE_API_URL
    if GUACAMOLE_PUBLIC_IP:
        return f"https://{GUACAMOLE_PUBLIC_IP}/guacamole"
    if GUACAMOLE_PRIVATE_IP:
        return f"http://{GUACAMOLE_PRIVATE_IP}/guacamole"
    return ""


def create_guacamole_connection(session_id: str, instance_ip: str, student_id: str) -> dict:
    """
    Create a Guacamole RDP connection and return connection details with direct URL.
    
    Args:
        session_id: The session ID
        instance_ip: Private IP address of the AttackBox instance
        student_id: Student ID
    
    Returns:
        Dictionary with guacamole_connection_id, guacamole_connection_url, guacamole_base_url
        Returns empty dict on error (doesn't raise exceptions)
    """
    try:
        # Get the best URL for API calls (prefers public URL for Lambda outside VPC)
        api_url = get_guacamole_api_url()
        if not api_url:
            logger.error("No Guacamole URL configured (GUACAMOLE_API_URL, GUACAMOLE_PUBLIC_IP, or GUACAMOLE_PRIVATE_IP)")
            return {}
            
        logger.info(f"Using Guacamole API URL: {api_url}")
        
        public_url = get_guacamole_public_url()
        if not public_url:
            # Fallback to API URL if no separate public URL
            public_url = api_url
        
        logger.info(f"Initializing Guacamole client with URL: {api_url}")
        guac = GuacamoleClient(
            base_url=api_url,
            username=GUACAMOLE_ADMIN_USER,
            password=GUACAMOLE_ADMIN_PASS,
        )
        
        # Create RDP connection
        connection_name = f"attackbox-{session_id[-8:]}"
        logger.info(f"Creating RDP connection '{connection_name}' to {instance_ip}")
        
        connection_id = guac.create_rdp_connection(
            name=connection_name,
            hostname=instance_ip,
            username=RDP_USERNAME,
            password=RDP_PASSWORD,
        )
        
        if not connection_id:
            logger.error(f"Failed to create Guacamole connection for session {session_id}")
            return {}
        
        logger.info(f"Created Guacamole connection {connection_id} for session {session_id}")
        
        # Switch to public URL for generating student-facing links
        guac.base_url = public_url
        
        # Create a temporary session user and get a direct-access URL
        logger.info(f"Creating session user for direct access")
        direct_url = guac.create_session_user_and_get_url(
            session_id=session_id,
            connection_id=connection_id,
            student_id=student_id,
        )
        
        # Generate username for cleanup later
        session_username = f"session_{session_id[-8:]}"
        
        if direct_url:
            logger.info(f"Created session user {session_username} with direct access URL")
            return {
                "guacamole_connection_id": connection_id,
                "guacamole_connection_url": direct_url,
                "guacamole_base_url": public_url,
                "guacamole_session_user": session_username,
            }
        else:
            # Fallback to regular URL (will require login)
            logger.warning("Could not create session user, falling back to regular URL")
            try:
                connection_url = guac.get_connection_url(connection_id)
                return {
                    "guacamole_connection_id": connection_id,
                    "guacamole_connection_url": connection_url,
                    "guacamole_base_url": public_url,
                }
            except Exception as e:
                logger.error(f"Error getting connection URL: {str(e)}")
                return {}
            
    except Exception as e:
        logger.error(f"Unexpected error in create_guacamole_connection: {str(e)}", exc_info=True)
        return {}


def get_stage_info(session: dict) -> dict:
    """
    Calculate the current stage and progress for loading animations.
    
    Stages and their progress:
    - session_created: 5%
    - finding_instance: 10%
    - instance_claimed: 18%
    - instance_starting: 25%
    - instance_running: 33%
    - waiting_health: 42%
    - health_check_passed: 50%
    - creating_guac_connection: 62%
    - guac_connection_ready: 70%
    - creating_guac_user: 85%
    - generating_token: 94%
    - ready: 100%
    """
    status = session.get("status", "")
    instance_state = session.get("instance_state", "")
    connection_info = session.get("connection_info", {})
    health_checks = session.get("health_checks", {})
    
    # Determine stage based on status and available info
    if status == SessionStatus.PENDING:
        if session.get("instance_id"):
            return {
                "stage": "instance_claimed",
                "progress": 18,
                "message": "Instance assigned, preparing to start",
                "estimated_seconds": 45,
            }
        else:
            return {
                "stage": "finding_instance",
                "progress": 10,
                "message": "Finding available instance",
                "estimated_seconds": 55,
            }
    
    elif status == SessionStatus.PROVISIONING:
        if instance_state == "pending":
            return {
                "stage": "instance_starting",
                "progress": 25,
                "message": "Instance is starting up",
                "estimated_seconds": 40,
            }
        elif instance_state == "running":
            # Instance running - check health checks status
            system_status = health_checks.get("system_status", "unknown")
            instance_status = health_checks.get("instance_status", "unknown")
            passed_checks = health_checks.get("passed_checks", 0)
            total_checks = health_checks.get("total_checks", 3)
            all_passed = health_checks.get("all_passed", False)
            
            if not all_passed:
                # Health checks still in progress - show actual check count
                if passed_checks == 0 or system_status == "initializing" or instance_status == "initializing":
                    return {
                        "stage": "waiting_health",
                        "progress": 42,
                        "message": "Initializing security protocols...",
                        "estimated_seconds": 25,
                    }
                elif passed_checks > 0 and passed_checks < total_checks:
                    # Show progress: 1/3, 2/3, etc.
                    return {
                        "stage": "waiting_health",
                        "progress": 42 + (passed_checks * 3),  # 42, 45, 48
                        "message": f"Configuring network interfaces... ({passed_checks}/{total_checks})",
                        "estimated_seconds": 15,
                    }
                else:
                    # Checks exist but status unknown
                    return {
                        "stage": "waiting_health",
                        "progress": 42,
                        "message": "Booting kernel modules...",
                        "estimated_seconds": 25,
                    }
            
            # Health checks passed - check connection setup
            if not connection_info:
                return {
                    "stage": "health_check_passed",
                    "progress": 50,
                    "message": "Loading penetration testing tools...",
                    "estimated_seconds": 20,
                }
            elif not connection_info.get("guacamole_connection_id"):
                return {
                    "stage": "creating_guac_connection",
                    "progress": 62,
                    "message": "Creating secure RDP connection",
                    "estimated_seconds": 15,
                }
            else:
                return {
                    "stage": "generating_token",
                    "progress": 94,
                    "message": "Generating access credentials",
                    "estimated_seconds": 3,
                }
        else:
            return {
                "stage": "instance_starting",
                "progress": 25,
                "message": "Instance is being prepared",
                "estimated_seconds": 40,
            }
    
    elif status == SessionStatus.READY:
        return {
            "stage": "ready",
            "progress": 100,
            "message": "AttackBox ready",
            "estimated_seconds": 0,
        }
    
    elif status == SessionStatus.ACTIVE:
        return {
            "stage": "ready",
            "progress": 100,
            "message": "AttackBox active",
            "estimated_seconds": 0,
        }
    
    elif status == SessionStatus.ERROR:
        return {
            "stage": "error",
            "progress": 0,
            "message": session.get("error", "An error occurred"),
            "estimated_seconds": 0,
        }
    
    elif status == SessionStatus.TERMINATED:
        return {
            "stage": "terminated",
            "progress": 0,
            "message": "Session terminated",
            "estimated_seconds": 0,
        }
    
    else:
        return {
            "stage": "session_created",
            "progress": 5,
            "message": "Session created",
            "estimated_seconds": 60,
        }


def calculate_time_remaining(session: dict) -> int:
    """Calculate remaining time in seconds."""
    expires_at = session.get("expires_at", 0)
    if not expires_at:
        return 0
    
    now = get_current_timestamp()
    remaining = expires_at - now
    return max(0, remaining)


def format_session_response(session: dict) -> dict:
    """Format session for API response with stage info for loading animations."""
    # Get stage info for loading animation
    stage_info = get_stage_info(session)
    
    # Calculate time remaining
    time_remaining = calculate_time_remaining(session)
    
    return {
        "session_id": session.get("session_id"),
        "student_id": session.get("student_id"),
        "student_name": session.get("student_name"),
        "course_id": session.get("course_id"),
        "lab_id": session.get("lab_id"),
        "status": session.get("status"),
        "instance_id": session.get("instance_id"),
        "instance_ip": session.get("instance_ip"),
        "instance_state": session.get("instance_state"),
        "connection_info": session.get("connection_info"),
        "direct_url": session.get("direct_url")
                      or session.get("connection_info", {}).get("direct_url") 
                      or session.get("connection_info", {}).get("guacamole_connection_url"),
        "created_at": session.get("created_at"),
        "updated_at": session.get("updated_at"),
        "expires_at": session.get("expires_at"),
        "time_remaining": time_remaining,
        "error": session.get("error"),
        "termination_reason": session.get("termination_reason"),
        # Stage info for loading animations
        "stage": stage_info.get("stage"),
        "progress": stage_info.get("progress"),
        "stage_message": stage_info.get("message"),
        "estimated_seconds": stage_info.get("estimated_seconds"),
    }

