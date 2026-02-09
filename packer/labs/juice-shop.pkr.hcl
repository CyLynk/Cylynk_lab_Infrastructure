# =============================================================================
# OWASP Juice Shop AMI Build
# =============================================================================
# This Packer configuration builds a custom AMI with OWASP Juice Shop
# pre-installed for use as a demo lab target in the CyberLab platform.

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
  default     = "cyberlab-juice-shop"
  description = "Prefix for the AMI name"
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Environment tag"
}

variable "juice_shop_version" {
  type        = string
  default     = "latest"
  description = "Juice Shop Docker image version"
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

source "amazon-ebs" "juice_shop" {
  ami_name        = "${var.ami_name_prefix}-${formatdate("YYYYMMDD-hhmmss", timestamp())}"
  ami_description = "OWASP Juice Shop Lab Target for CyberLab"
  instance_type   = var.instance_type
  region          = var.aws_region
  source_ami      = data.amazon-ami.ubuntu.id

  # Network configuration
  vpc_id                      = var.vpc_id != "" ? var.vpc_id : null
  subnet_id                   = var.subnet_id != "" ? var.subnet_id : null
  associate_public_ip_address = true

  # SSH configuration
  ssh_username            = "ubuntu"
  ssh_timeout             = "10m"
  ssh_agent_auth          = false
  temporary_key_pair_type = "ed25519"

  # AMI configuration
  ami_virtualization_type = "hvm"
  encrypt_boot            = false

  # Tags
  tags = {
    Name        = "${var.ami_name_prefix}-${var.environment}"
    Project     = "CyberLab"
    Environment = var.environment
    LabType     = "juice-shop"
    ManagedBy   = "Packer"
    BuildDate   = timestamp()
  }

  run_tags = {
    Name = "Packer Builder - Juice Shop"
  }
}

# =============================================================================
# Provisioners
# =============================================================================

build {
  name    = "juice-shop-lab"
  sources = ["source.amazon-ebs.juice_shop"]

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

  # Install Docker
  provisioner "shell" {
    inline = [
      "echo '=== Installing Docker ==='",
      
      "# Install prerequisites",
      "sudo apt-get install -y ca-certificates curl gnupg lsb-release",
      
      "# Add Docker's official GPG key",
      "sudo install -m 0755 -d /etc/apt/keyrings",
      "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg",
      "sudo chmod a+r /etc/apt/keyrings/docker.gpg",
      
      "# Set up Docker repository",
      "echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null",
      
      "# Install Docker",
      "sudo apt-get update",
      "sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
      
      "# Enable and start Docker",
      "sudo systemctl enable docker",
      "sudo systemctl start docker",
      
      "# Add ubuntu user to docker group",
      "sudo usermod -aG docker ubuntu"
    ]
  }

  # Pull and configure Juice Shop
  provisioner "shell" {
    inline = [
      "echo '=== Setting up OWASP Juice Shop ==='",
      
      "# Pull Juice Shop image",
      "sudo docker pull bkimminich/juice-shop:${var.juice_shop_version}",
      
      "# Create systemd service for Juice Shop",
      "sudo tee /etc/systemd/system/juice-shop.service << 'EOF'",
      "[Unit]",
      "Description=OWASP Juice Shop",
      "After=docker.service",
      "Requires=docker.service",
      "",
      "[Service]",
      "Type=simple",
      "Restart=always",
      "RestartSec=5",
      "ExecStartPre=-/usr/bin/docker stop juice-shop",
      "ExecStartPre=-/usr/bin/docker rm juice-shop",
      "ExecStart=/usr/bin/docker run --rm --name juice-shop -p 3000:3000 bkimminich/juice-shop:${var.juice_shop_version}",
      "ExecStop=/usr/bin/docker stop juice-shop",
      "",
      "[Install]",
      "WantedBy=multi-user.target",
      "EOF",
      
      "# Enable the service",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable juice-shop.service"
    ]
  }

  # Create CTF flag markers
  provisioner "shell" {
    inline = [
      "echo '=== Creating CTF Flag Markers ==='",
      
      "# Create documentation for flags",
      "sudo mkdir -p /opt/cyberlab",
      
      "sudo tee /opt/cyberlab/flags.md << 'EOF'",
      "# OWASP Juice Shop CTF Flags",
      "",
      "The following flags are embedded in the Juice Shop application.",
      "Complete the challenges to find them!",
      "",
      "## Challenges & Flags",
      "",
      "1. **Find the Scoreboard** (★)",
      "   - Flag: FLAG{scoreboard_revealed}",
      "   - Hint: Check the JavaScript source",
      "",
      "2. **Login as Admin** (★★)",
      "   - Flag: FLAG{admin_access_granted}",
      "   - Hint: SQL injection on login form",
      "",
      "3. **DOM-based XSS** (★★★)",
      "   - Flag: FLAG{dom_based_xss}",
      "   - Hint: The search functionality is vulnerable",
      "",
      "4. **Access Confidential Document** (★★)",
      "   - Flag: FLAG{confidential_document}",
      "   - Hint: Some files shouldn't be publicly accessible",
      "",
      "5. **Password Reset Exploit** (★★★★)",
      "   - Flag: FLAG{bender_account_takeover}",
      "   - Hint: Broken authentication in password reset",
      "",
      "Good luck, hacker!",
      "EOF"
    ]
  }

  # Install nginx as reverse proxy (optional, for cleaner URLs)
  provisioner "shell" {
    inline = [
      "echo '=== Installing nginx reverse proxy ==='",
      
      "sudo apt-get install -y nginx",
      
      "# Configure nginx to proxy to Juice Shop",
      "sudo tee /etc/nginx/sites-available/juice-shop << 'EOF'",
      "server {",
      "    listen 80 default_server;",
      "    listen [::]:80 default_server;",
      "    server_name _;",
      "",
      "    location / {",
      "        proxy_pass http://127.0.0.1:3000;",
      "        proxy_http_version 1.1;",
      "        proxy_set_header Upgrade $http_upgrade;",
      "        proxy_set_header Connection 'upgrade';",
      "        proxy_set_header Host $host;",
      "        proxy_cache_bypass $http_upgrade;",
      "        proxy_set_header X-Real-IP $remote_addr;",
      "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
      "    }",
      "}",
      "EOF",
      
      "# Enable the site",
      "sudo rm -f /etc/nginx/sites-enabled/default",
      "sudo ln -sf /etc/nginx/sites-available/juice-shop /etc/nginx/sites-enabled/",
      "sudo nginx -t",
      "sudo systemctl enable nginx",
      "sudo systemctl restart nginx"
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
      
      "echo '=== OWASP Juice Shop AMI Build Complete ==='",
      "echo 'Access Juice Shop at http://<instance-ip>/'",
      "echo 'Or directly at http://<instance-ip>:3000/'"
    ]
  }

  # Output manifest
  post-processor "manifest" {
    output     = "juice-shop-manifest.json"
    strip_path = true
    custom_data = {
      lab_type    = "juice-shop"
      description = "OWASP Juice Shop Lab Target"
    }
  }
}
