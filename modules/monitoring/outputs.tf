# modules/monitoring/outputs.tf

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alarms"
  value       = var.enable_sns_alarms ? aws_sns_topic.alarms[0].arn : null
}

output "sns_topic_name" {
  description = "Name of the SNS topic for alarms"
  value       = var.enable_sns_alarms ? aws_sns_topic.alarms[0].name : null
}

output "flow_logs_log_group_arn" {
  description = "ARN of the VPC Flow Logs CloudWatch log group"
  value       = aws_cloudwatch_log_group.flow_logs.arn
}

output "flow_logs_log_group_name" {
  description = "Name of the VPC Flow Logs CloudWatch log group"
  value       = aws_cloudwatch_log_group.flow_logs.name
}

output "flow_logs_role_arn" {
  description = "ARN of the IAM role for VPC Flow Logs"
  value       = aws_iam_role.flow_logs.arn
}

output "flow_logs_role_name" {
  description = "Name of the IAM role for VPC Flow Logs"
  value       = aws_iam_role.flow_logs.name
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_arn" {
  description = "ARN of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_arn
}

output "cost_anomaly_monitor_arn" {
  description = "ARN of the cost anomaly monitor"
  value       = var.enable_cost_anomaly_detection ? aws_ce_anomaly_monitor.main[0].arn : null
}

output "cost_anomaly_subscription_arn" {
  description = "ARN of the cost anomaly subscription"
  value       = var.enable_cost_anomaly_detection && var.alarm_email != "" ? aws_ce_anomaly_subscription.main[0].arn : null
}