# modules/monitoring/variables.tf

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for monitoring"
  type        = string
}

variable "enable_sns_alarms" {
  description = "Enable SNS topic for alarms"
  type        = bool
  default     = true
}

variable "alarm_email" {
  description = "Email address for alarm notifications"
  type        = string
  default     = ""
  validation {
    condition     = var.alarm_email == "" || can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alarm_email))
    error_message = "If provided, alarm_email must be a valid email address."
  }
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 7
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be one of the valid CloudWatch retention periods."
  }
}

variable "enable_cost_anomaly_detection" {
  description = "Enable AWS Cost Anomaly Detection"
  type        = bool
  default     = false
}

variable "cost_anomaly_threshold" {
  description = "Dollar threshold for cost anomaly alerts"
  type        = number
  default     = 100
  validation {
    condition     = var.cost_anomaly_threshold >= 1
    error_message = "Cost anomaly threshold must be at least $1."
  }
}

variable "enable_dashboard" {
  description = "Enable CloudWatch dashboard"
  type        = bool
  default     = true
}

variable "dashboard_widgets" {
  description = "Custom dashboard widget configuration (JSON)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default     = {}
}