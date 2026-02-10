import json
import os
import boto3
import time
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ssm = boto3.client('ssm')
dynamodb = boto3.resource('dynamodb')

VPN_INSTANCE_ID = os.environ.get('VPN_INSTANCE_ID')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')

def handler(event, context):
    """
    Handle Get VPN Config request.
    GET /vpn-config?session_id=...&student_id=...
    """
    try:
        logger.info(f"Event received: {json.dumps(event)}")

        # Robust parameter extraction for API Gateway v2
        session_id = None
        student_id = None

        # Try queryStringParameters first
        query_params = event.get('queryStringParameters') or {}
        session_id = query_params.get('session_id')
        student_id = query_params.get('student_id')

        # Workaround: Moodle's PHP may encode & as &amp; in query strings,
        # causing API Gateway to parse "amp;student_id" as the key name.
        if not student_id:
            student_id = query_params.get('amp;student_id')

        # Fallback: parse rawQueryString (fix &amp; encoding first)
        if not session_id or not student_id:
            raw_qs = event.get('rawQueryString', '')
            if raw_qs:
                # Fix HTML-encoded ampersands from Moodle
                raw_qs = raw_qs.replace('&amp;', '&')
                from urllib.parse import parse_qs
                parsed = parse_qs(raw_qs)
                session_id = session_id or (parsed.get('session_id', [None])[0])
                student_id = student_id or (parsed.get('student_id', [None])[0])

        # Fallback: check request body (in case sent as POST)
        if not session_id or not student_id:
            body = event.get('body', '')
            if body:
                try:
                    body_data = json.loads(body)
                    session_id = session_id or body_data.get('session_id')
                    student_id = student_id or body_data.get('student_id')
                except (json.JSONDecodeError, TypeError):
                    pass

        logger.info(f"Parsed params - session_id: {session_id}, student_id: {student_id}")

        if not session_id or not student_id:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing session_id or student_id'})
            }

        # Verify session
        table = dynamodb.Table(SESSIONS_TABLE)
        response = table.get_item(Key={'session_id': session_id})
        session = response.get('Item')

        if not session:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Session not found'})
            }

        # Check ownership - lab sessions use 'user_id' field
        session_owner = session.get('user_id') or session.get('student_id')
        if session_owner != student_id:
            return {
                'statusCode': 403,
                'body': json.dumps({'error': 'Unauthorized'})
            }

        if session.get('status') not in ('running', 'launching', 'active', 'ready'):
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Session is not running'})
            }

        # Generate VPN Config via SSM
        # We use the session_id as the client name to ensure uniqueness per session
        client_name = f"user-{student_id}-{session_id}"
        
        logger.info(f"Requesting VPN config for {client_name} on instance {VPN_INSTANCE_ID}")

        command = f"/usr/local/bin/create-vpn-client.sh {client_name}"
        
        ssm_response = ssm.send_command(
            InstanceIds=[VPN_INSTANCE_ID],
            DocumentName="AWS-RunShellScript",
            Parameters={'commands': [command]},
            TimeoutSeconds=30
        )
        
        command_id = ssm_response['Command']['CommandId']
        
        # Poll for completion (max 10 seconds)
        retries = 20
        while retries > 0:
            time.sleep(0.5)
            invocation = ssm.get_command_invocation(
                CommandId=command_id,
                InstanceId=VPN_INSTANCE_ID
            )
            status = invocation['Status']
            
            if status == 'Success':
                vpn_config = invocation['StandardOutputContent']
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/x-openvpn-profile',
                        'Content-Disposition': f'attachment; filename="cyberlab-{session_id}.ovpn"'
                    },
                    'body': vpn_config
                }
            elif status in ['Failed', 'Cancelled', 'TimedOut']:
                logger.error(f"SSM command failed: {invocation.get('StandardErrorContent')}")
                return {
                    'statusCode': 500,
                    'body': json.dumps({'error': 'Failed to generate VPN config'})
                }
            
            retries -= 1

        return {
            'statusCode': 504,
            'body': json.dumps({'error': 'Timeout waiting for VPN config generation'})
        }

    except Exception as e:
        logger.exception("Error handling VPN config request")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
