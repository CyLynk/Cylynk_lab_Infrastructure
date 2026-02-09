# =============================================================================
# Demo Lab Templates
# =============================================================================
# These are pre-configured lab templates for demonstration purposes.
# Each template represents a vulnerable target VM that students can attack.

locals {
  # Demo lab templates - seed data for the lab_templates DynamoDB table
  # Template IDs MUST match what Moodle plugin expects (see mod_cyberlab/lib.php)
  demo_lab_templates = [
    {
      template_id       = "dvwa-web-vuln"
      name              = "DVWA - Damn Vulnerable Web Application"
      description       = "Damn Vulnerable Web Application (DVWA) is a PHP/MySQL web app that is intentionally vulnerable. Practice SQL injection, XSS, CSRF, and more."
      lab_type          = "vm"
      difficulty        = "beginner"
      estimated_minutes = 60
      ami_id            = var.demo_dvwa_ami_id
      instance_type     = "t3.small"
      services = jsonencode([
        { port = 80, protocol = "tcp", name = "HTTP (Apache)" },
        { port = 3306, protocol = "tcp", name = "MySQL" }
      ])
      tags = jsonencode(["web-security", "sql-injection", "xss", "csrf", "beginner"])
      category          = "web-application"
      thumbnail_url     = "https://raw.githubusercontent.com/digininja/DVWA/master/docs/DVWA-logo.png"
      instructions      = <<-EOT
        ## DVWA Lab Instructions
        
        ### Objective
        Practice common web vulnerabilities including SQL Injection, XSS, CSRF, and more.
        
        ### Getting Started
        1. Open your LynkBox and launch a browser
        2. Navigate to `http://<target_ip>/DVWA`
        3. Default credentials: `admin` / `password`
        4. Start with "Low" security level and progress upward
        
        ### Challenges
        - [ ] SQL Injection: Extract all usernames
        - [ ] Reflected XSS: Pop an alert box
        - [ ] Stored XSS: Inject persistent script
        - [ ] Command Injection: Read /etc/passwd
        - [ ] File Upload: Upload a PHP shell
        
        ### Tools
        - Burp Suite (included in LynkBox)
        - sqlmap
        - Browser Developer Tools
      EOT
      active            = 1
    },
    {
      template_id       = "juice-shop"
      name              = "OWASP Juice Shop - Modern Web Security"
      description       = "OWASP Juice Shop is a modern vulnerable web application written in Node.js/Angular. Practice the OWASP Top 10 and beyond with 100+ challenges."
      lab_type          = "vm"
      difficulty        = "intermediate"
      estimated_minutes = 120
      ami_id            = var.demo_juice_shop_ami_id
      instance_type     = "t3.small"
      services = jsonencode([
        { port = 3000, protocol = "tcp", name = "Juice Shop (Node.js)" }
      ])
      tags = jsonencode(["web-security", "owasp-top10", "nodejs", "angular", "intermediate"])
      category          = "web-application"
      thumbnail_url     = "https://raw.githubusercontent.com/juice-shop/juice-shop/master/frontend/src/assets/public/images/JuiceShop_Logo.png"
      instructions      = <<-EOT
        ## OWASP Juice Shop Lab Instructions
        
        ### Objective
        Complete challenges across the OWASP Top 10 categories and earn points on the scoreboard.
        
        ### Getting Started
        1. Open your LynkBox and launch a browser
        2. Navigate to `http://<target_ip>:3000`
        3. Click the scoreboard link to track your progress
        4. Register an account to start shopping (and hacking!)
        
        ### Challenge Categories
        - Injection (SQL, NoSQL)
        - Broken Authentication
        - Sensitive Data Exposure
        - XML External Entities (XXE)
        - Broken Access Control
        - Security Misconfiguration
        - Cross-Site Scripting (XSS)
        - Insecure Deserialization
        
        ### Recommended Tools
        - Burp Suite
        - OWASP ZAP
        - curl/httpie
        - Browser Developer Tools
        
        ### Tips
        - Check the JavaScript console for hints
        - Inspect API responses carefully
        - Look for hidden endpoints in source code
      EOT
      active            = 1
    },
    {
      template_id       = "metasploitable3-linux"
      name              = "Metasploitable 3 - Linux Penetration Testing"
      description       = "A vulnerable Ubuntu Linux VM with intentional security flaws. Practice network scanning, exploitation, and post-exploitation techniques."
      lab_type          = "vm"
      difficulty        = "intermediate"
      estimated_minutes = 180
      ami_id            = var.demo_metasploitable_ami_id
      instance_type     = "t3.medium"
      services = jsonencode([
        { port = 21, protocol = "tcp", name = "FTP (ProFTPD)" },
        { port = 22, protocol = "tcp", name = "SSH" },
        { port = 80, protocol = "tcp", name = "HTTP (Apache)" },
        { port = 445, protocol = "tcp", name = "SMB" },
        { port = 3306, protocol = "tcp", name = "MySQL" },
        { port = 8080, protocol = "tcp", name = "Apache Tomcat" },
        { port = 8181, protocol = "tcp", name = "ManageEngine" }
      ])
      tags = jsonencode(["penetration-testing", "linux", "exploitation", "metasploit", "intermediate"])
      category          = "penetration-testing"
      thumbnail_url     = null
      instructions      = <<-EOT
        ## Metasploitable 3 Linux Lab Instructions
        
        ### Objective
        Perform a full penetration test from reconnaissance to post-exploitation.
        
        ### Getting Started
        1. Open your LynkBox terminal
        2. Start with reconnaissance: `nmap -sV -sC <target_ip>`
        3. Identify vulnerable services and research exploits
        4. Launch Metasploit: `msfconsole`
        
        ### Methodology
        1. **Reconnaissance**: nmap, nikto, enum4linux
        2. **Vulnerability Analysis**: searchsploit, nmap scripts
        3. **Exploitation**: Metasploit, manual exploits
        4. **Post-Exploitation**: Privilege escalation, pivoting
        
        ### Known Vulnerable Services
        - ProFTPD 1.3.5 (mod_copy)
        - Apache + PHP
        - Samba
        - MySQL
        - Tomcat Manager
        - Multiple web apps
        
        ### Flags to Capture
        - [ ] Root flag: /root/flag.txt
        - [ ] User flag: /home/user/flag.txt
        - [ ] Web flag: Hidden in web application
      EOT
      active            = 1
    }
  ]
}

# =============================================================================
# DynamoDB Table Items - Seed Demo Lab Templates
# =============================================================================
# Using dynamodb_table_item resources to seed demo templates

resource "aws_dynamodb_table_item" "demo_dvwa" {
  count      = var.seed_demo_labs ? 1 : 0
  table_name = aws_dynamodb_table.lab_templates.name
  hash_key   = aws_dynamodb_table.lab_templates.hash_key

  item = jsonencode({
    template_id       = { S = "dvwa-web-vuln" }
    name              = { S = "DVWA - Damn Vulnerable Web Application" }
    description       = { S = "Damn Vulnerable Web Application (DVWA) is a PHP/MySQL web app that is intentionally vulnerable. Practice SQL injection, XSS, CSRF, and more." }
    lab_type          = { S = "vm" }
    difficulty        = { S = "beginner" }
    estimated_minutes = { N = "60" }
    ami_id            = { S = var.demo_dvwa_ami_id }
    instance_type     = { S = "t3.small" }
    services = { L = [
      { M = { port = { N = "80" }, protocol = { S = "tcp" }, name = { S = "HTTP (Apache)" } } },
      { M = { port = { N = "3306" }, protocol = { S = "tcp" }, name = { S = "MySQL" } } }
    ] }
    tags     = { L = [{ S = "web-security" }, { S = "sql-injection" }, { S = "xss" }, { S = "csrf" }, { S = "beginner" }] }
    category = { S = "web-application" }
    active   = { N = "1" }
    flags = { L = [
      { M = { flag_id = { S = "dvwa-sql-1" }, flag_value = { S = "FLAG{sql_injection_master}" }, points = { N = "100" }, hint = { S = "Try extracting all user passwords" } } },
      { M = { flag_id = { S = "dvwa-xss-1" }, flag_value = { S = "FLAG{xss_reflected_win}" }, points = { N = "75" }, hint = { S = "Check the search functionality" } } },
      { M = { flag_id = { S = "dvwa-cmd-1" }, flag_value = { S = "FLAG{command_execution}" }, points = { N = "150" }, hint = { S = "The ping feature might be vulnerable" } } }
    ] }
    instructions = { S = "## DVWA Lab\n\n**Objective:** Practice common web vulnerabilities.\n\n1. Login with admin/password\n2. Set security level to Low\n3. Work through each vulnerability module\n4. Progress to higher security levels" }
  })

  lifecycle {
    ignore_changes = [item]
  }
}

resource "aws_dynamodb_table_item" "demo_juice_shop" {
  count      = var.seed_demo_labs ? 1 : 0
  table_name = aws_dynamodb_table.lab_templates.name
  hash_key   = aws_dynamodb_table.lab_templates.hash_key

  item = jsonencode({
    template_id       = { S = "juice-shop" }
    name              = { S = "OWASP Juice Shop - Modern Web Security" }
    description       = { S = "Modern vulnerable web application with 100+ challenges covering the OWASP Top 10 and beyond. Built with Node.js, Express, and Angular." }
    lab_type          = { S = "vm" }
    difficulty        = { S = "intermediate" }
    estimated_minutes = { N = "120" }
    ami_id            = { S = var.demo_juice_shop_ami_id }
    instance_type     = { S = "t3.small" }
    services = { L = [
      { M = { port = { N = "3000" }, protocol = { S = "tcp" }, name = { S = "Juice Shop (Node.js)" } } }
    ] }
    tags     = { L = [{ S = "web-security" }, { S = "owasp-top10" }, { S = "nodejs" }, { S = "angular" }, { S = "intermediate" }] }
    category = { S = "web-application" }
    active   = { N = "1" }
    flags = { L = [
      { M = { flag_id = { S = "juice-scoreboard" }, flag_value = { S = "FLAG{scoreboard_revealed}" }, points = { N = "50" }, hint = { S = "Find the hidden scoreboard page" } } },
      { M = { flag_id = { S = "juice-admin" }, flag_value = { S = "FLAG{admin_access_granted}" }, points = { N = "100" }, hint = { S = "Login as the admin user" } } },
      { M = { flag_id = { S = "juice-sqli" }, flag_value = { S = "FLAG{sql_injection_pro}" }, points = { N = "150" }, hint = { S = "The login form might be vulnerable" } } },
      { M = { flag_id = { S = "juice-xss" }, flag_value = { S = "FLAG{dom_based_xss}" }, points = { N = "100" }, hint = { S = "Check the search functionality" } } }
    ] }
    instructions = { S = "## OWASP Juice Shop\n\n**Objective:** Complete as many challenges as possible!\n\n1. Navigate to http://<target_ip>:3000\n2. Find and access the scoreboard\n3. Register an account and start shopping\n4. Use browser dev tools and Burp Suite to find vulnerabilities" }
  })

  lifecycle {
    ignore_changes = [item]
  }
}

resource "aws_dynamodb_table_item" "demo_metasploitable" {
  count      = var.seed_demo_labs ? 1 : 0
  table_name = aws_dynamodb_table.lab_templates.name
  hash_key   = aws_dynamodb_table.lab_templates.hash_key

  item = jsonencode({
    template_id       = { S = "metasploitable-linux" }
    name              = { S = "Metasploitable 3 - Linux Penetration Testing" }
    description       = { S = "A purposefully vulnerable Linux VM designed for penetration testing practice. Features multiple vulnerable services including web apps, FTP, SSH, SMB, and more." }
    lab_type          = { S = "vm" }
    difficulty        = { S = "advanced" }
    estimated_minutes = { N = "180" }
    ami_id            = { S = var.demo_metasploitable_ami_id }
    instance_type     = { S = "t3.medium" }
    services = { L = [
      { M = { port = { N = "21" }, protocol = { S = "tcp" }, name = { S = "FTP (ProFTPD)" } } },
      { M = { port = { N = "22" }, protocol = { S = "tcp" }, name = { S = "SSH" } } },
      { M = { port = { N = "80" }, protocol = { S = "tcp" }, name = { S = "HTTP (Apache)" } } },
      { M = { port = { N = "445" }, protocol = { S = "tcp" }, name = { S = "SMB" } } },
      { M = { port = { N = "3306" }, protocol = { S = "tcp" }, name = { S = "MySQL" } } },
      { M = { port = { N = "8080" }, protocol = { S = "tcp" }, name = { S = "Tomcat" } } }
    ] }
    tags     = { L = [{ S = "penetration-testing" }, { S = "linux" }, { S = "exploitation" }, { S = "metasploit" }, { S = "advanced" }] }
    category = { S = "penetration-testing" }
    active   = { N = "1" }
    flags = { L = [
      { M = { flag_id = { S = "meta-user" }, flag_value = { S = "FLAG{initial_foothold}" }, points = { N = "200" }, hint = { S = "Find a way to get shell access" } } },
      { M = { flag_id = { S = "meta-root" }, flag_value = { S = "FLAG{privilege_escalation_complete}" }, points = { N = "300" }, hint = { S = "Escalate to root privileges" } } },
      { M = { flag_id = { S = "meta-secret" }, flag_value = { S = "FLAG{database_secrets_exposed}" }, points = { N = "150" }, hint = { S = "Check the MySQL database" } } }
    ] }
    instructions = { S = "## Metasploitable 3 Linux\n\n**Objective:** Perform a full penetration test.\n\n1. Start with port scanning: nmap -sV -sC <target_ip>\n2. Enumerate services and look for vulnerabilities\n3. Use Metasploit or manual techniques to exploit\n4. Capture both user and root flags" }
  })

  lifecycle {
    ignore_changes = [item]
  }
}
