output "vpn_instance_id" {
  description = "ID of the VPN server instance"
  value       = aws_instance.vpn_server.id
}

output "vpn_public_ip" {
  description = "Public IP (EIP) of the VPN server"
  value       = aws_eip.vpn_eip.public_ip
}

output "vpn_private_ip" {
  description = "Private IP of the VPN server"
  value       = aws_instance.vpn_server.private_ip
}
