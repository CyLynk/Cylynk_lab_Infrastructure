#!/bin/bash
# Generate Ansible inventory from Terraform outputs
# Usage: ./scripts/generate-ansible-inventory.sh [environment]

set -e

ENVIRONMENT=${1:-dev}
TERRAFORM_DIR="environments/${ENVIRONMENT}"
INVENTORY_FILE="ansible/inventory/hosts.yml"

if [ ! -d "$TERRAFORM_DIR" ]; then
    echo "Error: Terraform directory not found: $TERRAFORM_DIR"
    exit 1
fi

cd "$TERRAFORM_DIR"

if [ ! -f terraform.tfstate ] && [ ! -f terraform.tfstate.backup ]; then
    echo "Error: No Terraform state found. Run 'terraform apply' first."
    exit 1
fi

# Extract values from Terraform state
PUBLIC_IP=$(terraform output -raw guacamole_public_ip 2>/dev/null || echo "")
KEY_NAME=$(terraform output -raw key_pair_name 2>/dev/null || echo "cylynk-lab-keypair")
PROJECT_NAME=$(terraform output -raw project_name 2>/dev/null || echo "cyberlab")

if [ -z "$PUBLIC_IP" ]; then
    echo "Error: Could not extract Guacamole public IP from Terraform outputs"
    echo "Make sure Terraform has been applied and outputs are available"
    exit 1
fi

# Create inventory file
cat > "../../${INVENTORY_FILE}" <<EOF
---
# Auto-generated inventory from Terraform outputs
# Environment: ${ENVIRONMENT}
# Generated: $(date)

all:
  children:
    guacamole:
      hosts:
        guacamole-${ENVIRONMENT}:
          ansible_host: ${PUBLIC_IP}
          ansible_user: ubuntu
          ansible_ssh_private_key_file: ~/.ssh/${KEY_NAME}
          environment: ${ENVIRONMENT}
          project_name: ${PROJECT_NAME}
          domain_name: ""
          admin_email: "admin@${PROJECT_NAME}.com"
          enable_lets_encrypt: false
EOF

echo "✅ Inventory file generated: ${INVENTORY_FILE}"
echo "   Guacamole host: ${PUBLIC_IP}"
echo ""
echo "Review and update variables in ${INVENTORY_FILE} before running Ansible"

