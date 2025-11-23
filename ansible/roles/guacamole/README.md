# Guacamole Ansible Role

This role deploys Apache Guacamole on Ubuntu servers using Docker and Docker Compose.

## Requirements

- Ubuntu 22.04 (Jammy) or later
- Ansible 2.9+
- Python 3.6+
- Access to Docker Hub for pulling images

## Role Variables

### Required Variables

- `environment`: Environment name (dev, staging, production)
- `project_name`: Project name for resource naming
- `admin_email`: Administrator email address

### Optional Variables

- `guacamole_version`: Guacamole Docker image version (default: `latest`)
- `docker_compose_version`: Docker Compose version (default: `v2.24.0`)
- `guacamole_base_dir`: Base directory for Guacamole (default: `/opt/guacamole`)
- `guacamole_user`: User to run Guacamole services (default: `ubuntu`)
- `domain_name`: Domain name for Let's Encrypt (default: `""`)
- `enable_lets_encrypt`: Enable Let's Encrypt SSL (default: `false`)

## Dependencies

- `community.docker` collection
- `community.general` collection
- `community.crypto` collection (for SSL certificate generation)

## Example Playbook

```yaml
- hosts: guacamole
  become: yes
  vars:
    environment: dev
    project_name: cyberlab
    admin_email: admin@example.com
    domain_name: guacamole.example.com
    enable_lets_encrypt: true
  roles:
    - guacamole
```

## What This Role Does

1. **System Setup**: Updates packages, installs prerequisites
2. **Docker Installation**: Installs Docker CE and Docker Compose
3. **Application Deployment**: 
   - Generates secure database password
   - Initializes Guacamole database schema
   - Creates Docker Compose configuration
   - Sets up Nginx reverse proxy
   - Generates self-signed SSL certificate (if Let's Encrypt not enabled)
4. **CloudWatch Integration**: Installs and configures CloudWatch agent
5. **Management Scripts**: Creates helper scripts for status, restart, and logs

## Post-Deployment

After deployment, access Guacamole at:
- `https://<public-ip>/guacamole`
- Default credentials: `guacadmin` / `guacadmin` (CHANGE IMMEDIATELY)

Management commands:
- `guacamole-status`: Check service status
- `guacamole-restart`: Restart services
- `guacamole-logs [service]`: View logs

## License

MIT

