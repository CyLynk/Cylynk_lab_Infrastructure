# modules/guacamole/main.tf

terraform {
  required_version = ">= 1.0"
}

# Get latest Ubuntu AMI
data "aws_ami" "ubuntu" {
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

# Elastic IP for Guacamole
resource "aws_eip" "guacamole" {
  domain = "vpc"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-guacamole-eip"
    }
  )

  lifecycle {
    prevent_destroy = false
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "guacamole" {
  name              = "/cyberlab/${var.environment}/guacamole/syslog"
  retention_in_days = var.log_retention_days

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-guacamole-logs"
    }
  )
}

# Guacamole EC2 Instance
resource "aws_instance" "guacamole" {
  ami                    = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  iam_instance_profile   = var.iam_instance_profile_name
  key_name               = var.key_name

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    iops                  = var.root_volume_iops
    throughput            = var.root_volume_throughput
    encrypted             = true
    delete_on_termination = true

    tags = merge(
      var.tags,
      {
        Name = "${var.project_name}-${var.environment}-guacamole-root"
      }
    )
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  monitoring = var.enable_detailed_monitoring

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-guacamole"
      Role        = "Guacamole"
      Environment = var.environment
    }
  )

  lifecycle {
    ignore_changes = [
      user_data,
      ami
    ]
  }
}

# Associate Elastic IP
resource "aws_eip_association" "guacamole" {
  instance_id   = aws_instance.guacamole.id
  allocation_id = aws_eip.guacamole.id
}

# CloudWatch CPU Alarm
resource "aws_cloudwatch_metric_alarm" "guacamole_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-guacamole-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_alarm_threshold
  alarm_description   = "This metric monitors Guacamole CPU utilization"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    InstanceId = aws_instance.guacamole.id
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-guacamole-cpu-alarm"
    }
  )
}

# CloudWatch Status Check Alarm
resource "aws_cloudwatch_metric_alarm" "guacamole_status" {
  alarm_name          = "${var.project_name}-${var.environment}-guacamole-status-check"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "This metric monitors Guacamole instance status"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    InstanceId = aws_instance.guacamole.id
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-guacamole-status-alarm"
    }
  )
}

# CloudWatch Memory Alarm (requires CloudWatch agent)
resource "aws_cloudwatch_metric_alarm" "guacamole_memory" {
  count               = var.enable_detailed_monitoring ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-guacamole-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "mem_used_percent"
  namespace           = "CyberLab/Guacamole"
  period              = "300"
  statistic           = "Average"
  threshold           = var.memory_alarm_threshold
  alarm_description   = "This metric monitors Guacamole memory utilization"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    InstanceId = aws_instance.guacamole.id
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-guacamole-memory-alarm"
    }
  )
}