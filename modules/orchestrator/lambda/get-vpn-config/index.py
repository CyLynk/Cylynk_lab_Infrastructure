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
        query_params = event.get('queryStringParameters', {})
        session_id = query_params.get('session_id')
        student_id = query_params.get('student_id')

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

        if session.get('student_id') != student_id:
            return {
                'statusCode': 403,
                'body': json.dumps({'error': 'Unauthorized'})
            }

        if session.get('status') != 'running':
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
