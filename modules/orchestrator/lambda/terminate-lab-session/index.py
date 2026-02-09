"""
Terminate Lab Session Lambda Function

Terminates a lab session and its associated EC2 instance.
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
    parse_request_body,
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


def terminate_ec2_instance(instance_id: str) -> bool:
    """Terminate an EC2 instance."""
    if not instance_id:
        return False
    
    ec2 = EC2Client()
    
    try:
        response = ec2.ec2.terminate_instances(InstanceIds=[instance_id])
        terminating = response.get("TerminatingInstances", [])
        
        if terminating:
            logger.info(f"Terminated instance {instance_id}")
            return True
        return False
    except Exception as e:
        logger.error(f"Error terminating instance {instance_id}: {e}")
        return False


def update_session_terminated(session_id: str, instance_id: str) -> None:
    """Update the lab session as terminated."""
    db = DynamoDBClient(LAB_SESSIONS_TABLE)
    
    db.update_item(
        key={"session_id": session_id},
        updates={
            "status": LabSessionStatus.TERMINATED,
            "terminated_at": get_current_timestamp(),
            "updated_at": get_current_timestamp()
        }
    )


def terminate_lab_session(session_id: str, user_id: str = None) -> dict:
    """Terminate a lab session."""
    
    session = get_lab_session(session_id)
    if not session:
        raise ValueError(f"Lab session '{session_id}' not found")
    
    # Verify ownership if user_id provided
    if user_id and session.get("user_id") != user_id:
        raise PermissionError("You don't have permission to terminate this lab session")
    
    current_status = session.get("status")
    instance_id = session.get("instance_id")
    
    # If already terminated, just return
    if current_status == LabSessionStatus.TERMINATED:
        return {
            "session_id": session_id,
            "status": LabSessionStatus.TERMINATED,
            "message": "Lab session already terminated"
        }
    
    # Terminate the EC2 instance
    terminated = False
    if instance_id:
        terminated = terminate_ec2_instance(instance_id)
    
    # Update session status
    update_session_terminated(session_id, instance_id)
    
    logger.info(f"Terminated lab session {session_id}, instance {instance_id}")
    
    return {
        "session_id": session_id,
        "status": LabSessionStatus.TERMINATED,
        "instance_id": instance_id,
        "instance_terminated": terminated,
        "template_name": session.get("template_name"),
        "message": "Lab session terminated successfully"
    }


def handler(event, context):
    """Lambda entry point."""
    logger.info(f"Terminate lab session request: {event}")
    
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
        
        # Get session ID from path parameter or body
        session_id = get_path_parameter(event, "sessionId")
        body = parse_request_body(event)
        
        if not session_id:
            session_id = body.get("session_id")
        
        if not session_id:
            return error_response(400, "Missing session_id", "sessionId is required")
        
        # Get user_id for ownership verification (optional)
        user_id = body.get("user_id") or body.get("student_id")
        
        # Terminate the lab session
        result = terminate_lab_session(session_id, user_id)
        
        return success_response(result, result.get("message"))
        
    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        return error_response(404, "Not Found", str(e))
    except PermissionError as e:
        logger.warning(f"Permission error: {e}")
        return error_response(403, "Forbidden", str(e))
    except Exception as e:
        logger.exception(f"Error terminating lab session: {e}")
        return error_response(500, "Internal Server Error", str(e))
