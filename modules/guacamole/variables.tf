# modules/guacamole/variables.tf

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

variable "ami_id" {
  description = "AMI ID for Guacamole instance (leave empty for latest Ubuntu)"
  type        = string
  default     = ""
}

variable "instance_type" {
  description = "EC2 instance type for Guacamole"
  type        = string
  default     = "t3.small"
  validation {
    condition     = can(regex("^t[2-3]\\.(micro|small|medium|large)", var.instance_type))
    error_message = "Instance type must be a valid t2 or t3 instance (e.g., t3.small)."
  }
}

variable "subnet_id" {
  description = "Subnet ID for Guacamole instance"
  type        = string
}

variable "security_group_id" {
  description = "Security group ID for Guacamole instance"
  type        = string
}

variable "iam_instance_profile_name" {
  description = "IAM instance profile name"
  type        = string
}

variable "key_name" {
  description = "SSH key pair name"
  type        = string
}

variable "root_volume_size" {
  description = "Size of root volume in GB"
  type        = number
  default     = 30
  validation {
    condition     = var.root_volume_size >= 20 && var.root_volume_size <= 200
    error_message = "Root volume size must be between 20 and 200 GB."
  }
}

variable "root_volume_iops" {
  description = "IOPS for root volume (gp3 only)"
  type        = number
  default     = 3000
}

variable "root_volume_throughput" {
  description = "Throughput for root volume in MB/s (gp3 only)"
  type        = number
  default     = 125
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Domain name for Guacamole (for Let's Encrypt SSL)"
  type        = string
  default     = ""
}

variable "admin_email" {
  description = "Administrator email address"
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.admin_email))
    error_message = "Admin email must be a valid email address."
  }
}

variable "enable_lets_encrypt" {
  description = "Enable Let's Encrypt SSL certificate"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "cpu_alarm_threshold" {
  description = "CPU utilization threshold for alarms (%)"
  type        = number
  default     = 80
  validation {
    condition     = var.cpu_alarm_threshold >= 50 && var.cpu_alarm_threshold <= 100
    error_message = "CPU alarm threshold must be between 50 and 100."
  }
}

variable "memory_alarm_threshold" {
  description = "Memory utilization threshold for alarms (%)"
  type        = number
  default     = 85
  validation {
    condition     = var.memory_alarm_threshold >= 50 && var.memory_alarm_threshold <= 100
    error_message = "Memory alarm threshold must be between 50 and 100."
  }
}

variable "alarm_sns_topic_arns" {
  description = "List of SNS topic ARNs for alarm notifications"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default     = {}
}