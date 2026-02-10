variable "environment" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the VPN server will be deployed"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID for the VPN server (should be a public subnet)"
  type        = string
}

variable "security_group_id" {
  description = "Security Group ID for the VPN server"
  type        = string
}

variable "key_name" {
  description = "Name of the SSH key pair to use"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for the VPN server"
  type        = string
  default     = "t3.small"
}

variable "ami_id" {
  description = "AMI ID for the VPN server (optional, defaults to latest Ubuntu 22.04)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
