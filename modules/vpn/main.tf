terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# Get latest Ubuntu 22.04 AMI if not provided
data "aws_ami" "ubuntu" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  ami_id = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu[0].id
}

# VPN Server Instance
resource "aws_instance" "vpn_server" {
  ami           = local.ami_id
  instance_type = var.instance_type
  key_name      = var.key_name
  subnet_id     = var.subnet_id

  vpc_security_group_ids = [var.security_group_id]
  iam_instance_profile   = aws_iam_instance_profile.vpn_profile.name

  # Enable source/dest check must be disabled for VPN routing?
  # Actually for client VPN via NAT it might need to be disabled if it acts as a router
  # For simple road warrior setup, standard NAT masquerade on instance works fine
  source_dest_check = true 

  user_data = <<-EOF
              #!/bin/bash
              apt-get update
              apt-get install -y docker.io docker-compose amazon-cloudwatch-agent
              systemctl enable docker
              systemctl start docker
              usermod -aG docker ubuntu
              EOF

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-vpn-server"
      Role = "vpn-server"
    }
  )

  lifecycle {
    ignore_changes = [ami] # Don't replace if AMI changes
  }
}

# Elastic IP
resource "aws_eip" "vpn_eip" {
  instance = aws_instance.vpn_server.id
  domain   = "vpc"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-vpn-eip"
    }
  )
}

# IAM Role for SSM access
resource "aws_iam_role" "vpn_role" {
  name = "${var.project_name}-${var.environment}-vpn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Attach SSM policy
resource "aws_iam_role_policy_attachment" "ssm_policy" {
  role       = aws_iam_role.vpn_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Attach CloudWatch policy
resource "aws_iam_role_policy_attachment" "cloudwatch_policy" {
  role       = aws_iam_role.vpn_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Instance Profile
resource "aws_iam_instance_profile" "vpn_profile" {
  name = "${var.project_name}-${var.environment}-vpn-profile"
  role = aws_iam_role.vpn_role.name
}
