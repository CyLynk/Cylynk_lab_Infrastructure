# Ansible Infrastructure Automation

This directory contains Ansible playbooks and roles for provisioning infrastructure components after Terraform creates the base resources.

## Directory Structure

```
ansible/
├── ansible.cfg              # Ansible configuration
├── requirements.yml         # Ansible Galaxy dependencies
├── inventory/               # Inventory files
│   └── hosts.yml.example   # Example inventory template
├── playbooks/              # Playbooks
│   └── guacamole.yml      # Guacamole deployment playbook
└── roles/                  # Ansible roles
    └── guacamole/         # Guacamole role
        ├── tasks/         # Task files
        ├── templates/    # Jinja2 templates
        └── handlers/     # Handlers
```

## Setup

1. **Install Ansible**:
   ```bash
   pip install ansible
   ```

2. **Install Ansible Galaxy dependencies**:
   ```bash
   ansible-galaxy install -r requirements.yml
   ```

3. **Create inventory file**:
   ```bash
   cp inventory/hosts.yml.example inventory/hosts.yml
   ```

4. **Update inventory with Terraform outputs**:
   After running `terraform apply`, get the instance IP:
   ```bash
   terraform output -json | jq -r '.guacamole_public_ip.value'
   ```
   
   Update `inventory/hosts.yml` with the IP address and SSH key path.

## Usage

### Deploy Guacamole

```bash
ansible-playbook playbooks/guacamole.yml
```

### Deploy to specific environment

```bash
ansible-playbook playbooks/guacamole.yml -i inventory/hosts.yml
```

### Check connectivity

```bash
ansible all -m ping
```

## Integration with Terraform

After Terraform creates the infrastructure, you can:

1. **Extract Terraform outputs to inventory**:
   ```bash
   terraform output -json > terraform-outputs.json
   # Use jq or a script to populate inventory/hosts.yml
   ```

2. **Run Ansible playbook**:
   ```bash
   ansible-playbook playbooks/guacamole.yml
   ```

## Variables

Variables can be set in:
- Inventory file (`inventory/hosts.yml`)
- Playbook (`playbooks/*.yml`)
- Command line (`-e key=value`)
- Variable files (`group_vars/`, `host_vars/`)

## Troubleshooting

- **Connection issues**: Check SSH key path and security group rules
- **Permission errors**: Ensure `ansible_user` has sudo access
- **Docker issues**: Verify Docker installation completed successfully
- **Service not starting**: Check logs with `guacamole-logs` command

## Next Steps

- Add more roles for other infrastructure components
- Set up Ansible Vault for sensitive data
- Integrate with CI/CD pipeline

