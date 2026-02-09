#!/usr/bin/env python3
"""
Seed Demo Lab Templates to DynamoDB

This script populates the lab_templates DynamoDB table with demo labs
for testing and demonstration purposes.

Usage:
    python seed-demo-labs.py --table-name cyberlab-dev-lab-templates
    python seed-demo-labs.py --table-name cyberlab-dev-lab-templates --region us-east-1
"""

import argparse
import boto3
import json
from datetime import datetime


# Demo Lab Templates
# Template IDs MUST match what Moodle plugin expects (see mod_cyberlab/lib.php)
DEMO_LABS = [
    {
        "template_id": "dvwa-web-vuln",
        "name": "DVWA - Damn Vulnerable Web Application",
        "description": "Damn Vulnerable Web Application (DVWA) is a PHP/MySQL web app that is intentionally vulnerable. Practice SQL injection, XSS, CSRF, file inclusion, command injection, and more. Perfect for beginners learning web application security.",
        "lab_type": "vm",
        "difficulty": "beginner",
        "estimated_minutes": 60,
        "ami_id": "ami-placeholder-dvwa",  # Replace with actual AMI
        "instance_type": "t3.small",
        "services": [
            {"port": 80, "protocol": "tcp", "name": "HTTP (Apache)"},
            {"port": 3306, "protocol": "tcp", "name": "MySQL"}
        ],
        "tags": ["web-security", "sql-injection", "xss", "csrf", "beginner", "php"],
        "category": "web-application",
        "thumbnail_url": "https://raw.githubusercontent.com/digininja/DVWA/master/docs/DVWA-logo.png",
        "active": 1,
        "flags": [
            {
                "flag_id": "dvwa-sql-1",
                "flag_value": "FLAG{sql_injection_master}",
                "points": 100,
                "hint": "Try extracting all user passwords using SQL injection"
            },
            {
                "flag_id": "dvwa-xss-1", 
                "flag_value": "FLAG{xss_reflected_win}",
                "points": 75,
                "hint": "Check the search functionality for reflected XSS"
            },
            {
                "flag_id": "dvwa-cmd-1",
                "flag_value": "FLAG{command_execution}",
                "points": 150,
                "hint": "The ping feature might accept more than just IP addresses"
            },
            {
                "flag_id": "dvwa-upload-1",
                "flag_value": "FLAG{file_upload_bypass}",
                "points": 125,
                "hint": "Can you upload something other than an image?"
            }
        ],
        "instructions": """## DVWA - Damn Vulnerable Web Application

### Objectives
Practice common web vulnerabilities in a safe environment.

### Getting Started
1. Open your **LynkBox** and launch Firefox
2. Navigate to `http://<target_ip>/DVWA`
3. Login with credentials: `admin` / `password`
4. Go to **DVWA Security** and set level to **Low**

### Vulnerability Modules
1. **Brute Force** - Crack login credentials
2. **Command Injection** - Execute system commands
3. **CSRF** - Cross-Site Request Forgery
4. **File Inclusion** - Local/Remote file inclusion
5. **File Upload** - Upload malicious files
6. **SQL Injection** - Extract database data
7. **SQL Injection (Blind)** - Boolean-based extraction
8. **Reflected XSS** - Execute arbitrary JavaScript
9. **Stored XSS** - Persistent script injection

### Recommended Tools (included in LynkBox)
- Burp Suite Community Edition
- sqlmap
- Browser Developer Tools

### Progression
Start with **Low** security, then move to **Medium** and **High** as you learn bypass techniques.
""",
        "created_at": datetime.utcnow().isoformat() + "Z"
    },
    {
        "template_id": "juice-shop",
        "name": "OWASP Juice Shop - Modern Web Security",
        "description": "OWASP Juice Shop is a modern, intentionally insecure web application written in Node.js, Express, and Angular. It includes 100+ challenges covering the entire OWASP Top 10 and beyond. Features a built-in scoreboard to track your progress!",
        "lab_type": "vm",
        "difficulty": "intermediate",
        "estimated_minutes": 120,
        "ami_id": "ami-placeholder-juice-shop",  # Replace with actual AMI
        "instance_type": "t3.small",
        "services": [
            {"port": 3000, "protocol": "tcp", "name": "Juice Shop (Node.js)"}
        ],
        "tags": ["web-security", "owasp-top10", "nodejs", "angular", "intermediate", "modern"],
        "category": "web-application",
        "thumbnail_url": "https://raw.githubusercontent.com/juice-shop/juice-shop/master/frontend/src/assets/public/images/JuiceShop_Logo.png",
        "active": 1,
        "flags": [
            {
                "flag_id": "juice-scoreboard",
                "flag_value": "FLAG{scoreboard_revealed}",
                "points": 50,
                "hint": "The scoreboard URL might be hidden but guessable"
            },
            {
                "flag_id": "juice-admin",
                "flag_value": "FLAG{admin_access_granted}",
                "points": 100,
                "hint": "SQL injection might help you bypass authentication"
            },
            {
                "flag_id": "juice-xss-dom",
                "flag_value": "FLAG{dom_based_xss}",
                "points": 100,
                "hint": "The search functionality reflects user input"
            },
            {
                "flag_id": "juice-confidential",
                "flag_value": "FLAG{confidential_document}",
                "points": 75,
                "hint": "Some files shouldn't be publicly accessible"
            },
            {
                "flag_id": "juice-bender",
                "flag_value": "FLAG{bender_account_takeover}",
                "points": 150,
                "hint": "Can you change someone else's password?"
            }
        ],
        "instructions": """## OWASP Juice Shop

### Objectives
Complete as many security challenges as possible! Track your progress on the scoreboard.

### Getting Started
1. Open your **LynkBox** browser
2. Navigate to `http://<target_ip>:3000`
3. Find the hidden **Scoreboard** (this is your first challenge!)
4. Create an account and start exploring

### Challenge Categories
- ⭐ Trivial (1 star) - Getting started
- ⭐⭐ Easy (2 stars) - Basic techniques  
- ⭐⭐⭐ Medium (3 stars) - Standard challenges
- ⭐⭐⭐⭐ Hard (4 stars) - Advanced attacks
- ⭐⭐⭐⭐⭐ Expert (5 stars) - Elite hackers only
- ⭐⭐⭐⭐⭐⭐ Legendary (6 stars) - Near impossible

### Attack Vectors Covered
- SQL Injection (traditional & NoSQL)
- Cross-Site Scripting (XSS)
- Broken Authentication
- Sensitive Data Exposure
- Security Misconfiguration
- Insecure Direct Object References
- Cryptographic Failures
- Server-Side Request Forgery (SSRF)

### Tips
- Check the browser console for hints
- Inspect all API responses
- Look at the client-side JavaScript
- Use Burp Suite to intercept and modify requests
""",
        "created_at": datetime.utcnow().isoformat() + "Z"
    },
    {
        "template_id": "metasploitable-linux",
        "name": "Metasploitable 3 - Linux Penetration Testing",
        "description": "A vulnerable Ubuntu Linux VM specifically designed for penetration testing practice. Features multiple intentionally vulnerable services including web applications, FTP, SSH, SMB, MySQL, and more. Perfect for practicing with Metasploit Framework.",
        "lab_type": "vm",
        "difficulty": "advanced",
        "estimated_minutes": 180,
        "ami_id": "ami-placeholder-metasploitable",  # Replace with actual AMI
        "instance_type": "t3.medium",
        "services": [
            {"port": 21, "protocol": "tcp", "name": "FTP (ProFTPD)"},
            {"port": 22, "protocol": "tcp", "name": "SSH"},
            {"port": 80, "protocol": "tcp", "name": "HTTP (Apache)"},
            {"port": 445, "protocol": "tcp", "name": "SMB (Samba)"},
            {"port": 3306, "protocol": "tcp", "name": "MySQL"},
            {"port": 8080, "protocol": "tcp", "name": "Apache Tomcat"},
            {"port": 8181, "protocol": "tcp", "name": "ManageEngine"},
            {"port": 6667, "protocol": "tcp", "name": "IRC (UnrealIRCd)"}
        ],
        "tags": ["penetration-testing", "linux", "exploitation", "metasploit", "advanced", "ctf"],
        "category": "penetration-testing",
        "thumbnail_url": None,
        "active": 1,
        "flags": [
            {
                "flag_id": "meta-user-flag",
                "flag_value": "FLAG{initial_foothold_achieved}",
                "points": 200,
                "hint": "First, get a shell. Check for outdated services."
            },
            {
                "flag_id": "meta-root-flag",
                "flag_value": "FLAG{root_pwned}",
                "points": 300,
                "hint": "Escalate your privileges to root"
            },
            {
                "flag_id": "meta-mysql-secrets",
                "flag_value": "FLAG{database_treasure}",
                "points": 150,
                "hint": "The MySQL service might have weak credentials"
            },
            {
                "flag_id": "meta-tomcat-flag",
                "flag_value": "FLAG{tomcat_manager_exposed}",
                "points": 175,
                "hint": "Tomcat Manager with default creds?"
            }
        ],
        "instructions": """## Metasploitable 3 - Linux Penetration Testing

### Objectives
Perform a complete penetration test: reconnaissance → exploitation → privilege escalation.

### Getting Started
1. Open your **LynkBox** terminal
2. Start with reconnaissance:
   ```bash
   nmap -sV -sC -p- <target_ip> -oN scan.txt
   ```
3. Identify vulnerable services
4. Research and exploit!

### Penetration Testing Methodology

#### Phase 1: Reconnaissance
```bash
nmap -sV -sC <target_ip>
nikto -h http://<target_ip>
enum4linux -a <target_ip>
```

#### Phase 2: Vulnerability Assessment
- Check `searchsploit` for known vulnerabilities
- Test default credentials
- Check for misconfigurations

#### Phase 3: Exploitation
```bash
msfconsole
search <service_name>
use exploit/...
set RHOSTS <target_ip>
exploit
```

#### Phase 4: Post-Exploitation
- Capture flags in `/home/` and `/root/`
- Look for additional credentials
- Check for privilege escalation vectors

### Known Vulnerable Services
- ProFTPD 1.3.5 (mod_copy vulnerability)
- UnrealIRCd 3.2.8.1 (backdoor)
- Apache Tomcat (manager default creds)
- ManageEngine (multiple CVEs)
- Samba (eternal blue, etc.)
- MySQL (weak passwords)

### Tools Available in LynkBox
- Metasploit Framework
- Nmap
- Nikto
- enum4linux
- Hydra
- John the Ripper
""",
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
]


def convert_to_dynamodb_format(item: dict) -> dict:
    """Convert a Python dict to DynamoDB item format."""
    def convert_value(value):
        if isinstance(value, str):
            return {"S": value}
        elif isinstance(value, bool):
            return {"BOOL": value}
        elif isinstance(value, int) or isinstance(value, float):
            return {"N": str(value)}
        elif value is None:
            return {"NULL": True}
        elif isinstance(value, list):
            return {"L": [convert_value(v) for v in value]}
        elif isinstance(value, dict):
            return {"M": {k: convert_value(v) for k, v in value.items()}}
        else:
            return {"S": str(value)}
    
    return {k: convert_value(v) for k, v in item.items()}


def seed_lab_templates(table_name: str, region: str = None):
    """Seed lab templates to DynamoDB."""
    
    # Create DynamoDB client
    if region:
        dynamodb = boto3.client('dynamodb', region_name=region)
    else:
        dynamodb = boto3.client('dynamodb')
    
    print(f"Seeding {len(DEMO_LABS)} demo labs to table: {table_name}")
    
    for lab in DEMO_LABS:
        template_id = lab["template_id"]
        print(f"  → Adding: {lab['name']} ({template_id})")
        
        try:
            dynamodb_item = convert_to_dynamodb_format(lab)
            
            dynamodb.put_item(
                TableName=table_name,
                Item=dynamodb_item,
                ConditionExpression="attribute_not_exists(template_id)"
            )
            print(f"    ✓ Successfully added {template_id}")
            
        except dynamodb.exceptions.ConditionalCheckFailedException:
            print(f"    ⚠ Template {template_id} already exists, skipping")
        except Exception as e:
            print(f"    ✗ Error adding {template_id}: {e}")
    
    print("\n✓ Demo labs seeding complete!")


def list_templates(table_name: str, region: str = None):
    """List existing templates in the table."""
    if region:
        dynamodb = boto3.client('dynamodb', region_name=region)
    else:
        dynamodb = boto3.client('dynamodb')
    
    print(f"Listing templates in table: {table_name}\n")
    
    response = dynamodb.scan(TableName=table_name)
    
    for item in response.get('Items', []):
        template_id = item.get('template_id', {}).get('S', 'unknown')
        name = item.get('name', {}).get('S', 'Unnamed')
        difficulty = item.get('difficulty', {}).get('S', 'unknown')
        active = item.get('active', {}).get('N', '0')
        
        status = "✓ Active" if active == "1" else "✗ Inactive"
        print(f"  {status} [{difficulty}] {name} ({template_id})")


def main():
    parser = argparse.ArgumentParser(description="Seed demo lab templates to DynamoDB")
    parser.add_argument("--table-name", required=True, help="DynamoDB table name")
    parser.add_argument("--region", default=None, help="AWS region (uses default if not specified)")
    parser.add_argument("--list", action="store_true", help="List existing templates instead of seeding")
    
    args = parser.parse_args()
    
    if args.list:
        list_templates(args.table_name, args.region)
    else:
        seed_lab_templates(args.table_name, args.region)


if __name__ == "__main__":
    main()
