"""
Get Lab Status Lambda Function

Checks the status of a lab session and returns the target IP when ready.
"""

import logging
import os
import sys

# Add common layer to path
sys.path.insert(0, "/opt/python")

from utils import (
    DynamoDBClient,
    EC2Client,
    error_response,
    get_current_timestamp,
    get_path_parameter,
    success_response,
    verify_moodle_request,
    get_moodle_token_from_event,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
LAB_SESSIONS_TABLE = os.environ.get("LAB_SESSIONS_TABLE")
MOODLE_WEBHOOK_SECRET = os.environ.get("MOODLE_WEBHOOK_SECRET", "")
REQUIRE_MOODLE_AUTH = os.environ.get("REQUIRE_MOODLE_AUTH", "false").lower() == "true"


class LabSessionStatus:
    """Lab session status constants."""
    PENDING = "pending"
    LAUNCHING = "launching"
    RUNNING = "running"
    TERMINATING = "terminating"
    TERMINATED = "terminated"
    ERROR = "error"


def get_lab_session(session_id: str) -> dict:
    """Get a lab session from DynamoDB."""
    if not LAB_SESSIONS_TABLE:
        logger.error("LAB_SESSIONS_TABLE not configured")
        return None
    
    db = DynamoDBClient(LAB_SESSIONS_TABLE)
    return db.get_item({"session_id": session_id})


def get_instance_status(instance_id: str) -> dict:
    """Get EC2 instance status including private IP and status checks."""
    ec2 = EC2Client()
    
    try:
        # Get instance details
        response = ec2.ec2.describe_instances(InstanceIds=[instance_id])
        reservations = response.get("Reservations", [])
        
        if not reservations:
            return {"state": "not_found", "private_ip": None, "status_checks_passed": False}
        
        instance = reservations[0]["Instances"][0]
        state = instance["State"]["Name"]
        private_ip = instance.get("PrivateIpAddress")
        
        # Check instance status checks (system + instance = 2/2)
        status_checks_passed = False
        if state == "running":
            try:
                status_response = ec2.ec2.describe_instance_status(InstanceIds=[instance_id])
                statuses = status_response.get("InstanceStatuses", [])
                
                if statuses:
                    instance_status = statuses[0]
                    system_status = instance_status.get("SystemStatus", {}).get("Status", "")
                    instance_check = instance_status.get("InstanceStatus", {}).get("Status", "")
                    
                    status_checks_passed = (system_status == "ok" and instance_check == "ok")
                    logger.info(f"Instance {instance_id} status checks: system={system_status}, instance={instance_check}, passed={status_checks_passed}")
            except Exception as e:
                logger.warning(f"Error checking instance status for {instance_id}: {e}")
                # If we can't check status, assume not ready
                status_checks_passed = False
        
        return {
            "state": state,
            "private_ip": private_ip,
            "public_ip": instance.get("PublicIpAddress"),
            "instance_type": instance.get("InstanceType"),
            "launch_time": instance.get("LaunchTime").isoformat() if instance.get("LaunchTime") else None,
            "status_checks_passed": status_checks_passed
        }
    except Exception as e:
        logger.error(f"Error getting instance status for {instance_id}: {e}")
        return {"state": "error", "private_ip": None, "error": str(e), "status_checks_passed": False}


def update_session_status(session_id: str, status: str, target_ip: str = None) -> None:
    """Update the lab session status in DynamoDB."""
    db = DynamoDBClient(LAB_SESSIONS_TABLE)
    
    update_data = {
        "status": status,
        "updated_at": get_current_timestamp()
    }
    
    if target_ip:
        update_data["target_ip"] = target_ip
    
    db.update_item(
        key={"session_id": session_id},
        updates=update_data
    )


def check_lab_status(session_id: str) -> dict:
    """Check the status of a lab session and update if instance is ready."""
    
    session = get_lab_session(session_id)
    if not session:
        raise ValueError(f"Lab session '{session_id}' not found")
    
    current_status = session.get("status")
    instance_id = session.get("instance_id")
    
    # If already terminated or error, just return current state
    if current_status in [LabSessionStatus.TERMINATED, LabSessionStatus.ERROR]:
        return {
            "session_id": session_id,
            "status": current_status,
            "target_ip": session.get("target_ip"),
            "template_name": session.get("template_name"),
            "progress": 100,
            "error": session.get("error")
        }
    
    # If already running with IP, return it
    if current_status == LabSessionStatus.RUNNING and session.get("target_ip"):
        # Calculate time remaining
        expires_at = session.get("expires_at", 0)
        time_remaining = max(0, expires_at - get_current_timestamp())
        
        return {
            "session_id": session_id,
            "status": LabSessionStatus.RUNNING,
            "target_ip": session.get("target_ip"),
            "template_id": session.get("template_id"),
            "template_name": session.get("template_name"),
            "services": session.get("services", []),
            "instance_id": instance_id,
            "progress": 100,
            "time_remaining_seconds": time_remaining,
            "expires_at": expires_at
        }
    
    # Check EC2 instance status
    if not instance_id:
        return {
            "session_id": session_id,
            "status": current_status,
            "target_ip": None,
            "template_name": session.get("template_name"),
            "progress": 10,
            "message": "Instance not yet launched"
        }
    
    instance_status = get_instance_status(instance_id)
    ec2_state = instance_status.get("state")
    private_ip = instance_status.get("private_ip")
    status_checks_passed = instance_status.get("status_checks_passed", False)
    
    logger.info(f"Lab {session_id}: EC2 state={ec2_state}, IP={private_ip}, status_checks={status_checks_passed}")
    
    # Update session based on EC2 state AND status checks
    if ec2_state == "running" and private_ip and status_checks_passed:
        # Instance is fully ready - status checks passed!
        update_session_status(session_id, LabSessionStatus.RUNNING, private_ip)
        
        expires_at = session.get("expires_at", 0)
        time_remaining = max(0, expires_at - get_current_timestamp())
        
        return {
            "session_id": session_id,
            "status": LabSessionStatus.RUNNING,
            "target_ip": private_ip,
            "template_id": session.get("template_id"),
            "template_name": session.get("template_name"),
            "services": session.get("services", []),
            "instance_id": instance_id,
            "progress": 100,
            "time_remaining_seconds": time_remaining,
            "expires_at": expires_at,
            "message": "Lab is ready! You can now connect."
        }
    
    elif ec2_state == "running" and private_ip and not status_checks_passed:
        # Instance is running but status checks not yet passed
        # Return "initializing" status - services are booting up
        return {
            "session_id": session_id,
            "status": "initializing",
            "target_ip": private_ip,  # Show IP early for reference
            "template_id": session.get("template_id"),
            "template_name": session.get("template_name"),
            "services": session.get("services", []),
            "instance_id": instance_id,
            "progress": 85,
            "message": "Instance running, waiting for services to start (status checks: 0/2)..."
        }
    
    elif ec2_state in ["pending", "initializing"]:
        # Calculate progress based on time elapsed (rough estimate)
        # Typical EC2 boot time is 30-90 seconds
        created_at = session.get("created_at", get_current_timestamp())
        elapsed = get_current_timestamp() - created_at
        # Progress from 20% to 90% over ~60 seconds
        progress = min(90, 20 + int(elapsed / 60 * 70))
        
        return {
            "session_id": session_id,
            "status": LabSessionStatus.LAUNCHING,
            "target_ip": None,
            "template_name": session.get("template_name"),
            "instance_id": instance_id,
            "progress": progress,
            "message": "Lab instance is starting up..."
        }
    
    elif ec2_state in ["stopping", "stopped", "shutting-down", "terminated"]:
        update_session_status(session_id, LabSessionStatus.TERMINATED)
        return {
            "session_id": session_id,
            "status": LabSessionStatus.TERMINATED,
            "target_ip": None,
            "template_name": session.get("template_name"),
            "progress": 100,
            "message": "Lab instance has been terminated"
        }
    
    elif ec2_state == "not_found":
        update_session_status(session_id, LabSessionStatus.ERROR)
        return {
            "session_id": session_id,
            "status": LabSessionStatus.ERROR,
            "target_ip": None,
            "template_name": session.get("template_name"),
            "progress": 100,
            "error": "Instance not found"
        }
    
    elif ec2_state == "running" and not private_ip:
        # Running but no IP yet - still initializing
        return {
            "session_id": session_id,
            "status": LabSessionStatus.LAUNCHING,
            "target_ip": None,
            "template_name": session.get("template_name"),
            "instance_id": instance_id,
            "progress": 85,
            "message": "Instance running, waiting for network..."
        }
    
    else:
        return {
            "session_id": session_id,
            "status": current_status,
            "target_ip": private_ip,
            "template_name": session.get("template_name"),
            "instance_id": instance_id,
            "progress": 50,
            "ec2_state": ec2_state,
            "message": f"Instance state: {ec2_state}"
        }


def handler(event, context):
    """Lambda entry point."""
    logger.info(f"Get lab status request: {event}")
    
    try:
        # Verify Moodle authentication if required
        if REQUIRE_MOODLE_AUTH:
            token_payload = get_moodle_token_from_event(event)
            is_valid, error_msg = verify_moodle_request(
                event, MOODLE_WEBHOOK_SECRET, token_payload
            )
            if not is_valid:
                logger.warning(f"Auth failed: {error_msg}")
                return error_response(401, "Unauthorized", error_msg)
        
        # Get session ID from path parameter
        session_id = get_path_parameter(event, "sessionId")
        
        if not session_id:
            return error_response(400, "Missing session_id", "sessionId path parameter is required")
        
        # Check lab status
        result = check_lab_status(session_id)
        
        return success_response(result, f"Lab status: {result.get('status')}")
        
    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        return error_response(404, "Not Found", str(e))
    except Exception as e:
        logger.exception(f"Error checking lab status: {e}")
        return error_response(500, "Internal Server Error", str(e))
