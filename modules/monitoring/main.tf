# modules/monitoring/main.tf

terraform {
  required_version = ">= 1.0"
}

# SNS Topic for Alarms
resource "aws_sns_topic" "alarms" {
  count = var.enable_sns_alarms ? 1 : 0
  name  = "${var.project_name}-${var.environment}-alarms"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-alarms"
    }
  )
}

# SNS Topic Subscription
resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.enable_sns_alarms && var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# CloudWatch Log Group for VPC Flow Logs
resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/aws/vpc/${var.project_name}-${var.environment}-flow-logs"
  retention_in_days = var.log_retention_days

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-flow-logs"
    }
  )
}

# IAM Role for VPC Flow Logs
resource "aws_iam_role" "flow_logs" {
  name = "${var.project_name}-${var.environment}-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-flow-logs-role"
    }
  )
}

# IAM Policy for VPC Flow Logs
resource "aws_iam_role_policy" "flow_logs" {
  name = "${var.project_name}-${var.environment}-flow-logs-policy"
  role = aws_iam_role.flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-${var.environment}-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "EC2 CPU Utilization"
        }
      }
    ]
  })
}

# Cost Anomaly Detection
resource "aws_ce_anomaly_monitor" "main" {
  count             = var.enable_cost_anomaly_detection ? 1 : 0
  name              = "${var.project_name}-${var.environment}-cost-monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-cost-monitor"
    }
  )
}

resource "aws_ce_anomaly_subscription" "main" {
  count     = var.enable_cost_anomaly_detection && var.alarm_email != "" ? 1 : 0
  name      = "${var.project_name}-${var.environment}-cost-alerts"
  frequency = "DAILY"

  monitor_arn_list = [
    aws_ce_anomaly_monitor.main[0].arn
  ]

  subscriber {
    type    = "EMAIL"
    address = var.alarm_email
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      values        = [tostring(var.cost_anomaly_threshold)]
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-cost-alerts"
    }
  )
}