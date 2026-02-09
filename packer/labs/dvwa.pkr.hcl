# =============================================================================
# DVWA (Damn Vulnerable Web Application) AMI Build
# =============================================================================
# This Packer configuration builds a custom AMI with DVWA pre-installed
# for use as a demo lab target in the CyberLab platform.

packer {
  required_plugins {
    amazon = {
      version = ">= 1.2.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

# =============================================================================
# Variables
# =============================================================================

variable "aws_region" {
  type        = string
  default     = "eu-west-1"
  description = "AWS region to build the AMI in"
}

variable "instance_type" {
  type        = string
  default     = "t3.small"
  description = "Instance type for the build"
}

variable "vpc_id" {
  type        = string
  default     = ""
  description = "VPC ID to build in (optional, uses default VPC if not specified)"
}

variable "subnet_id" {
  type        = string
  default     = ""
  description = "Subnet ID to build in (optional)"
}

variable "ami_name_prefix" {
  type        = string
  default     = "cyberlab-dvwa"
  description = "Prefix for the AMI name"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Environment tag"
}

# =============================================================================
# Data Sources
# =============================================================================

# Find the latest Ubuntu 22.04 LTS AMI
data "amazon-ami" "ubuntu" {
  filters = {
    name                = "ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"
    root-device-type    = "ebs"
    virtualization-type = "hvm"
  }
  most_recent = true
  owners      = ["099720109477"] # Canonical
  region      = var.aws_region
}

# =============================================================================
# Builder
# =============================================================================

source "amazon-ebs" "dvwa" {
  ami_name        = "${var.ami_name_prefix}-${formatdate("YYYYMMDD-hhmmss", timestamp())}"
  ami_description = "DVWA (Damn Vulnerable Web Application) Lab Target for CyberLab"
  instance_type   = var.instance_type
  region          = var.aws_region
  source_ami      = data.amazon-ami.ubuntu.id

  # Network configuration
  vpc_id                      = var.vpc_id != "" ? var.vpc_id : null
  subnet_id                   = var.subnet_id != "" ? var.subnet_id : null
  associate_public_ip_address = true

  # SSH configuration
  ssh_username         = "ubuntu"
  ssh_timeout          = "10m"
  ssh_agent_auth       = false
  temporary_key_pair_type = "ed25519"

  # AMI configuration
  ami_virtualization_type = "hvm"
  encrypt_boot            = false

  # Tags
  tags = {
    Name        = "${var.ami_name_prefix}-${var.environment}"
    Project     = "CyberLab"
    Environment = var.environment
    LabType     = "dvwa"
    ManagedBy   = "Packer"
    BuildDate   = timestamp()
  }

  run_tags = {
    Name = "Packer Builder - DVWA"
  }
}

# =============================================================================
# Provisioners
# =============================================================================

build {
  name    = "dvwa-lab"
  sources = ["source.amazon-ebs.dvwa"]

  # Wait for cloud-init to complete
  provisioner "shell" {
    inline = [
      "echo 'Waiting for cloud-init to complete...'",
      "cloud-init status --wait || true",
      "echo 'Cloud-init complete!'"
    ]
  }

  # Update system packages
  provisioner "shell" {
    inline = [
      "echo '=== Updating system packages ==='",
      "sudo apt-get update",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y"
    ]
  }

  # Install LAMP stack + DVWA dependencies
  provisioner "shell" {
    inline = [
      "echo '=== Installing LAMP Stack ==='",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \\",
      "  apache2 \\",
      "  mariadb-server \\",
      "  php \\",
      "  php-mysqli \\",
      "  php-gd \\",
      "  libapache2-mod-php \\",
      "  git \\",
      "  curl \\",
      "  unzip"
    ]
  }

  # Install and configure DVWA
  provisioner "shell" {
    inline = [
      "echo '=== Installing DVWA ==='",
      "cd /var/www/html",
      "sudo git clone https://github.com/digininja/DVWA.git",
      "sudo chown -R www-data:www-data /var/www/html/DVWA",
      "sudo chmod -R 755 /var/www/html/DVWA",
      
      "# Configure DVWA",
      "cd /var/www/html/DVWA/config",
      "sudo cp config.inc.php.dist config.inc.php",
      
      "# Update database credentials",
      "sudo sed -i \"s/\\$_DVWA\\[ 'db_user' \\] = 'dvwa';/\\$_DVWA[ 'db_user' ] = 'dvwa';/g\" config.inc.php",
      "sudo sed -i \"s/\\$_DVWA\\[ 'db_password' \\] = 'p@ssw0rd';/\\$_DVWA[ 'db_password' ] = 'dvwa_password';/g\" config.inc.php",
      
      "# Set default security level to low for training",
      "sudo sed -i \"s/\\$_DVWA\\[ 'default_security_level' \\] = 'impossible';/\\$_DVWA[ 'default_security_level' ] = 'low';/g\" config.inc.php",
      
      "# Enable captcha (optional)",
      "echo \"# Recaptcha keys can be obtained from https://www.google.com/recaptcha/admin\" | sudo tee -a config.inc.php"
    ]
  }

  # Configure MySQL/MariaDB
  provisioner "shell" {
    inline = [
      "echo '=== Configuring MariaDB ==='",
      "sudo systemctl start mariadb",
      "sudo systemctl enable mariadb",
      
      "# Create DVWA database and user",
      "sudo mysql -e \"CREATE DATABASE IF NOT EXISTS dvwa;\"",
      "sudo mysql -e \"CREATE USER IF NOT EXISTS 'dvwa'@'localhost' IDENTIFIED BY 'dvwa_password';\"",
      "sudo mysql -e \"GRANT ALL PRIVILEGES ON dvwa.* TO 'dvwa'@'localhost';\"",
      "sudo mysql -e \"FLUSH PRIVILEGES;\""
    ]
  }

  # Configure PHP for DVWA
  provisioner "shell" {
    inline = [
      "echo '=== Configuring PHP ==='",
      "# Enable allow_url_include (required for RFI exercises)",
      "sudo sed -i 's/allow_url_include = Off/allow_url_include = On/g' /etc/php/*/apache2/php.ini",
      "sudo sed -i 's/allow_url_fopen = Off/allow_url_fopen = On/g' /etc/php/*/apache2/php.ini || true",
      
      "# Set reasonable upload limits",
      "sudo sed -i 's/upload_max_filesize = .*/upload_max_filesize = 10M/g' /etc/php/*/apache2/php.ini",
      "sudo sed -i 's/post_max_size = .*/post_max_size = 12M/g' /etc/php/*/apache2/php.ini"
    ]
  }

  # Configure Apache
  provisioner "shell" {
    inline = [
      "echo '=== Configuring Apache ==='",
      
      "# Create virtual host for DVWA",
      "sudo tee /etc/apache2/sites-available/dvwa.conf << 'EOF'",
      "<VirtualHost *:80>",
      "    ServerAdmin webmaster@localhost",
      "    DocumentRoot /var/www/html/DVWA",
      "    ",
      "    <Directory /var/www/html/DVWA>",
      "        Options Indexes FollowSymLinks",
      "        AllowOverride All",
      "        Require all granted",
      "    </Directory>",
      "    ",
      "    ErrorLog $${APACHE_LOG_DIR}/dvwa_error.log",
      "    CustomLog $${APACHE_LOG_DIR}/dvwa_access.log combined",
      "</VirtualHost>",
      "EOF",
      
      "# Enable DVWA site and disable default",
      "sudo a2ensite dvwa.conf",
      "sudo a2dissite 000-default.conf",
      "sudo a2enmod rewrite",
      "sudo systemctl restart apache2"
    ]
  }

  # Create CTF flags
  provisioner "shell" {
    inline = [
      "echo '=== Creating CTF Flags ==='",
      
      "# Create flag files for capture-the-flag challenges",
      "sudo mkdir -p /opt/flags",
      
      "# SQL injection flag (hidden in database)",
      "sudo mysql -e \"USE dvwa; CREATE TABLE IF NOT EXISTS secret_flags (id INT AUTO_INCREMENT PRIMARY KEY, flag VARCHAR(255)); INSERT INTO secret_flags (flag) VALUES ('FLAG{sql_injection_master}');\"",
      
      "# Command injection flag",
      "echo 'FLAG{command_execution}' | sudo tee /root/flag.txt",
      "sudo chmod 600 /root/flag.txt",
      
      "# File upload flag",
      "echo 'FLAG{file_upload_bypass}' | sudo tee /opt/flags/upload_flag.txt",
      
      "# XSS flag (to be displayed via alert)",
      "echo 'FLAG{xss_reflected_win}' | sudo tee /opt/flags/xss_flag.txt"
    ]
  }

  # Setup automatic database initialization on first boot
  provisioner "shell" {
    inline = [
      "echo '=== Setting up first-boot initialization ==='",
      
      "# Create initialization script",
      "sudo tee /opt/init-dvwa.sh << 'INITSCRIPT'",
      "#!/bin/bash",
      "# Initialize DVWA database on first boot",
      "if [ ! -f /opt/.dvwa_initialized ]; then",
      "    sleep 10  # Wait for services",
      "    cd /var/www/html/DVWA",
      "    # The database will be auto-created when user visits setup.php",
      "    touch /opt/.dvwa_initialized",
      "    echo \"DVWA initialized at $(date)\" >> /var/log/dvwa_init.log",
      "fi",
      "INITSCRIPT",
      "sudo chmod +x /opt/init-dvwa.sh",
      
      "# Create systemd service for initialization",
      "sudo tee /etc/systemd/system/dvwa-init.service << 'SYSTEMD'",
      "[Unit]",
      "Description=DVWA Database Initialization",
      "After=network.target mariadb.service apache2.service",
      "",
      "[Service]",
      "Type=oneshot",
      "ExecStart=/opt/init-dvwa.sh",
      "RemainAfterExit=yes",
      "",
      "[Install]",
      "WantedBy=multi-user.target",
      "SYSTEMD",
      
      "sudo systemctl enable dvwa-init.service"
    ]
  }

  # Final cleanup
  provisioner "shell" {
    inline = [
      "echo '=== Final cleanup ==='",
      "sudo apt-get clean",
      "sudo apt-get autoremove -y",
      "sudo rm -rf /tmp/*",
      "sudo rm -rf /var/tmp/*",
      "sudo rm -f /root/.bash_history",
      "sudo rm -f /home/ubuntu/.bash_history",
      
      "# Verify services",
      "sudo systemctl enable apache2",
      "sudo systemctl enable mariadb",
      
      "echo '=== DVWA AMI Build Complete ==='",
      "echo 'Access DVWA at http://<instance-ip>/'",
      "echo 'Default credentials: admin / password'"
    ]
  }

  # Output manifest
  post-processor "manifest" {
    output     = "dvwa-manifest.json"
    strip_path = true
    custom_data = {
      lab_type    = "dvwa"
      description = "DVWA Lab Target"
    }
  }
}
