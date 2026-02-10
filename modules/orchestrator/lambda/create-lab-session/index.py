"""
Create Lab Session Lambda Function

Handles requests to launch a lab VM for a student.
Returns the target IP address for the student to attack via LynkBox.
"""

import logging
import os
import sys
import uuid
import time

# Add common layer to path
sys.path.insert(0, "/opt/python")

from utils import (
    DynamoDBClient,
    EC2Client,
    SessionStatus,
    calculate_expiry,
    error_response,
    get_current_timestamp,
    get_iso_timestamp,
    parse_request_body,
    success_response,
    verify_moodle_request,
    get_moodle_token_from_event,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
LAB_TEMPLATES_TABLE = os.environ.get("LAB_TEMPLATES_TABLE")
LAB_SESSIONS_TABLE = os.environ.get("LAB_SESSIONS_TABLE")
LAB_TARGETS_SUBNET_ID = os.environ.get("LAB_TARGETS_SUBNET_ID")
LAB_TARGETS_SG_ID = os.environ.get("LAB_TARGETS_SG_ID")
SESSION_TTL_HOURS = int(os.environ.get("SESSION_TTL_HOURS", "4"))
MAX_LAB_SESSIONS = int(os.environ.get("MAX_LAB_SESSIONS", "1"))
PROJECT_NAME = os.environ.get("PROJECT_NAME", "cyberlab")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
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


def generate_lab_session_id() -> str:
    """Generate a unique lab session ID."""
    return f"lab-{uuid.uuid4().hex[:12]}"


def get_lab_template(template_id: str) -> dict:
    """Retrieve a lab template from DynamoDB."""
    if not LAB_TEMPLATES_TABLE:
        logger.error("LAB_TEMPLATES_TABLE not configured")
        return None
    
    db = DynamoDBClient(LAB_TEMPLATES_TABLE)
    template = db.get_item({"template_id": template_id})
    
    if template and template.get("active", 1) == 1:
        return template
    return None


def get_user_active_lab_sessions(user_id: str) -> list:
    """Get all active lab sessions for a user."""
    if not LAB_SESSIONS_TABLE:
        return []
    
    db = DynamoDBClient(LAB_SESSIONS_TABLE)
    sessions = db.query_by_index(
        index_name="UserIndex",
        key_name="user_id",
        key_value=user_id
    )
    
    # Filter to active sessions only
    active_statuses = [LabSessionStatus.PENDING, LabSessionStatus.LAUNCHING, LabSessionStatus.RUNNING]
    return [s for s in sessions if s.get("status") in active_statuses]


def check_existing_lab_session(user_id: str, template_id: str) -> dict:
    """Check if user already has an active session for this lab template."""
    active_sessions = get_user_active_lab_sessions(user_id)
    for session in active_sessions:
        if session.get("template_id") == template_id:
            return session
    return None


def launch_lab_instance(template: dict, session_id: str, user_id: str) -> dict:
    """Launch an EC2 instance for the lab."""
    ec2 = EC2Client()
    
    ami_id = template.get("ami_id")
    instance_type = template.get("instance_type", "t3.micro")
    
    if not ami_id:
        raise ValueError(f"Template {template.get('template_id')} has no ami_id")
    
    # Build user data script (if any)
    user_data = template.get("user_data", "")
    
    # Tags for the instance
    tags = [
        {"Key": "Name", "Value": f"{PROJECT_NAME}-{ENVIRONMENT}-lab-{template.get('name', 'unknown')}"},
        {"Key": "Role", "Value": "LabTarget"},
        {"Key": "LabSessionId", "Value": session_id},
        {"Key": "UserId", "Value": user_id},
        {"Key": "TemplateId", "Value": template.get("template_id")},
        {"Key": "Project", "Value": PROJECT_NAME},
        {"Key": "Environment", "Value": ENVIRONMENT},
        {"Key": "ManagedBy", "Value": "Orchestrator"},
    ]
    
    # Launch the instance
    response = ec2.ec2.run_instances(
        ImageId=ami_id,
        InstanceType=instance_type,
        MinCount=1,
        MaxCount=1,
        SubnetId=LAB_TARGETS_SUBNET_ID,
        SecurityGroupIds=[LAB_TARGETS_SG_ID] if LAB_TARGETS_SG_ID else [],
        UserData=user_data,
        TagSpecifications=[
            {
                "ResourceType": "instance",
                "Tags": tags
            }
        ],
        MetadataOptions={
            "HttpTokens": "required",  # IMDSv2
            "HttpEndpoint": "enabled"
        }
    )
    
    instance = response["Instances"][0]
    instance_id = instance["InstanceId"]
    
    logger.info(f"Launched lab instance {instance_id} for session {session_id}")
    
    return {
        "instance_id": instance_id,
        "instance_type": instance_type,
        "ami_id": ami_id
    }


def create_lab_session(user_id: str, template_id: str, course_id: str = None, 
                       connection_method: str = "lynkbox") -> dict:
    """Create a new lab session."""
    
    # Get the lab template
    template = get_lab_template(template_id)
    if not template:
        raise ValueError(f"Lab template '{template_id}' not found or inactive")
    
    # Check for existing session for this template
    existing = check_existing_lab_session(user_id, template_id)
    if existing:
        logger.info(f"User {user_id} already has active session for template {template_id}")
        return {
            "session_id": existing["session_id"],
            "status": existing["status"],
            "instance_id": existing.get("instance_id"),
            "target_ip": existing.get("target_ip"),
            "template_id": template_id,
            "template_name": existing.get("template_name"),
            "existing": True,
            "message": "Returning existing active session"
        }
    
    # Check max sessions limit
    active_sessions = get_user_active_lab_sessions(user_id)
    if len(active_sessions) >= MAX_LAB_SESSIONS:
        raise ValueError(f"Maximum lab sessions ({MAX_LAB_SESSIONS}) reached. Please terminate an existing lab first.")
    
    # Generate session ID
    session_id = generate_lab_session_id()
    
    # Create session record (pending state)
    db = DynamoDBClient(LAB_SESSIONS_TABLE)
    session_record = {
        "session_id": session_id,
        "user_id": user_id,
        "template_id": template_id,
        "template_name": template.get("name", "Unknown"),
        "course_id": course_id or "",
        "connection_method": connection_method,
        "status": LabSessionStatus.LAUNCHING,
        "lab_type": template.get("lab_type", "vm"),
        "created_at": get_current_timestamp(),
        "created_at_iso": get_iso_timestamp(),
        "expires_at": calculate_expiry(SESSION_TTL_HOURS),
        "ttl_hours": SESSION_TTL_HOURS,
    }
    
    # Launch the lab instance
    try:
        instance_info = launch_lab_instance(template, session_id, user_id)
        session_record["instance_id"] = instance_info["instance_id"]
        session_record["instance_type"] = instance_info["instance_type"]
        session_record["ami_id"] = instance_info["ami_id"]
    except Exception as e:
        logger.error(f"Failed to launch lab instance: {e}")
        session_record["status"] = LabSessionStatus.ERROR
        session_record["error"] = str(e)
        db.put_item(session_record)
        raise
    
    # Store the session
    db.put_item(session_record)
    
    logger.info(f"Created lab session {session_id} for user {user_id}, template {template_id}")
    
    return {
        "session_id": session_id,
        "status": LabSessionStatus.LAUNCHING,
        "template_id": template_id,
        "template_name": template.get("name"),
        "instance_id": instance_info["instance_id"],
        "services": template.get("services", []),
        "difficulty": template.get("difficulty", "beginner"),
        "ttl_hours": SESSION_TTL_HOURS,
        "existing": False
    }


def handler(event, context):
    """Lambda entry point."""
    logger.info(f"Create lab session request: {event}")
    
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
        
        # Parse request body
        body = parse_request_body(event)
        
        # Extract required parameters
        user_id = body.get("user_id") or body.get("student_id")
        template_id = body.get("template_id")
        course_id = body.get("course_id")
        connection_method = body.get("connection_method", "lynkbox")
        
        if not user_id:
            return error_response(400, "Missing user_id", "user_id or student_id is required")
        
        if not template_id:
            return error_response(400, "Missing template_id", "template_id is required")
        
        check_only = body.get("check_only", False)
        
        # Check for existing session first
        if check_only:
            existing = check_existing_lab_session(user_id, template_id)
            if existing:
                return success_response({
                    "session_id": existing["session_id"],
                    "status": existing["status"],
                    "instance_id": existing.get("instance_id"),
                    "target_ip": existing.get("target_ip"),
                    "template_id": template_id,
                    "template_name": existing.get("template_name"),
                    "existing": True,
                    "message": "Existing active session found"
                }, "Existing active session found")
            else:
                return success_response({
                    "existing": False, 
                    "message": "No active session found"
                }, "No active session found")

        # Create the lab session
        result = create_lab_session(
            user_id=user_id,
            template_id=template_id,
            course_id=course_id,
            connection_method=connection_method
        )
        
        message = "Lab session already exists" if result.get("existing") else "Lab session created"
        return success_response(result, message)
        
    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        return error_response(400, "Bad Request", str(e))
    except Exception as e:
        logger.exception(f"Error creating lab session: {e}")
        return error_response(500, "Internal Server Error", str(e))
