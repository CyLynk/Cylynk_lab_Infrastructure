"""
List Lab Templates Lambda Function

Returns available lab templates, optionally filtered by type or course.
"""

import logging
import os
import sys

# Add common layer to path
sys.path.insert(0, "/opt/python")

from utils import (
    DynamoDBClient,
    error_response,
    success_response,
    verify_moodle_request,
    get_moodle_token_from_event,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
LAB_TEMPLATES_TABLE = os.environ.get("LAB_TEMPLATES_TABLE")
MOODLE_WEBHOOK_SECRET = os.environ.get("MOODLE_WEBHOOK_SECRET", "")
REQUIRE_MOODLE_AUTH = os.environ.get("REQUIRE_MOODLE_AUTH", "false").lower() == "true"


def get_all_templates() -> list:
    """Get all active lab templates."""
    if not LAB_TEMPLATES_TABLE:
        logger.error("LAB_TEMPLATES_TABLE not configured")
        return []
    
    db = DynamoDBClient(LAB_TEMPLATES_TABLE)
    
    # Scan for all active templates
    templates = db.scan(filter_expression="active = :active", expression_values={":active": 1})
    
    return templates


def get_templates_by_type(lab_type: str) -> list:
    """Get lab templates by type (vm or docker)."""
    if not LAB_TEMPLATES_TABLE:
        return []
    
    db = DynamoDBClient(LAB_TEMPLATES_TABLE)
    
    templates = db.query_by_index(
        index_name="ByTypeIndex",
        key_name="lab_type",
        key_value=lab_type
    )
    
    # Filter to active only
    return [t for t in templates if t.get("active", 1) == 1]


def format_template_for_response(template: dict) -> dict:
    """Format a template for the API response."""
    return {
        "template_id": template.get("template_id"),
        "name": template.get("name"),
        "description": template.get("description", ""),
        "lab_type": template.get("lab_type", "vm"),
        "difficulty": template.get("difficulty", "beginner"),
        "estimated_minutes": template.get("estimated_minutes", 60),
        "services": template.get("services", []),
        "tags": template.get("tags", []),
        "thumbnail_url": template.get("thumbnail_url"),
        "category": template.get("category", "general"),
    }


def handler(event, context):
    """Lambda entry point."""
    logger.info(f"List lab templates request: {event}")
    
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
        
        # Get query parameters
        query_params = event.get("queryStringParameters") or {}
        lab_type = query_params.get("type")  # vm or docker
        category = query_params.get("category")
        
        # Fetch templates
        if lab_type:
            templates = get_templates_by_type(lab_type)
        else:
            templates = get_all_templates()
        
        # Filter by category if specified
        if category:
            templates = [t for t in templates if t.get("category") == category]
        
        # Format for response
        formatted = [format_template_for_response(t) for t in templates]
        
        # Sort by name
        formatted.sort(key=lambda x: x.get("name", ""))
        
        return success_response({
            "templates": formatted,
            "count": len(formatted)
        }, f"Found {len(formatted)} lab templates")
        
    except Exception as e:
        logger.exception(f"Error listing lab templates: {e}")
        return error_response(500, "Internal Server Error", str(e))
