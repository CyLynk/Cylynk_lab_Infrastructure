# modules/guacamole/outputs.tf

output "instance_id" {
  description = "ID of the Guacamole EC2 instance"
  value       = aws_instance.guacamole.id
}

output "instance_arn" {
  description = "ARN of the Guacamole EC2 instance"
  value       = aws_instance.guacamole.arn
}

output "public_ip" {
  description = "Public IP address of Guacamole server"
  value       = aws_eip.guacamole.public_ip
}

output "private_ip" {
  description = "Private IP address of Guacamole server"
  value       = aws_instance.guacamole.private_ip
}

output "elastic_ip_id" {
  description = "ID of the Elastic IP"
  value       = aws_eip.guacamole.id
}

output "elastic_ip_allocation_id" {
  description = "Allocation ID of the Elastic IP"
  value       = aws_eip.guacamole.allocation_id
}

output "guacamole_url" {
  description = "URL to access Guacamole web interface"
  value       = "https://${aws_eip.guacamole.public_ip}/guacamole"
}

output "guacamole_url_http" {
  description = "HTTP URL to access Guacamole (redirects to HTTPS)"
  value       = "http://${aws_eip.guacamole.public_ip}/guacamole"
}

output "ssh_command" {
  description = "SSH command to connect to Guacamole server"
  value       = "ssh -i ~/.ssh/${var.key_name} ubuntu@${aws_eip.guacamole.public_ip}"
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.guacamole.name
}

output "log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = aws_cloudwatch_log_group.guacamole.arn
}

output "default_credentials" {
  description = "Default Guacamole credentials (CHANGE IMMEDIATELY)"
  value       = "Username: guacadmin, Password: guacadmin"
  sensitive   = true
}