# Cyberlab Infrastructure

Infrastructure as Code for Cyberlab using Terraform and Ansible.

## CI/CD Status

[![Terraform Validation](https://github.com/jacobadiaba/Cylynk_lab_Infrastructure/actions/workflows/terraform-validate.yml/badge.svg)](https://github.com/jacobadiaba/Cylynk_lab_Infrastructure/actions/workflows/terraform-validate.yml)
[![Terraform Deploy](https://github.com/jacobadiaba/Cylynk_lab_Infrastructure/actions/workflows/terraform-deploy.yml/badge.svg)](https://github.com/jacobadiaba/Cylynk_lab_Infrastructure/actions/workflows/terraform-deploy.yml)
[![Ansible Validation](https://github.com/jacobadiaba/Cylynk_lab_Infrastructure/actions/workflows/ansible-validate.yml/badge.svg)](https://github.com/jacobadiaba/Cylynk_lab_Infrastructure/actions/workflows/ansible-validate.yml)

## Overview

This repository contains the infrastructure code for deploying and managing the Cyberlab environment on AWS. It uses:

- **Terraform** for infrastructure provisioning
- **Ansible** for configuration management
- **GitHub Actions** for CI/CD automation

## Project Structure

```
.
├── .github/
│   ├── workflows/              # GitHub Actions CI/CD workflows
│   ├── CICD.md                # CI/CD documentation
│   └── pull_request_template.md
├── ansible/
│   ├── playbooks/             # Ansible playbooks
│   ├── roles/                 # Ansible roles
│   ├── inventory/             # Inventory files
│   └── requirements.yml       # Ansible Galaxy dependencies
├── environments/
│   ├── dev/                   # Development environment
│   └── prod/                  # Production environment
├── modules/
│   ├── networking/            # VPC, subnets, routing
│   ├── security/              # Security groups, IAM
│   ├── guacamole/            # Guacamole server
│   ├── monitoring/            # CloudWatch, logging
│   └── storage/              # S3, EBS
└── scripts/                   # Helper scripts
```

## Quick Start

### Prerequisites

- Terraform >= 1.0
- Ansible >= 2.9
- AWS CLI configured
- Python 3.8+

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/jacobadiaba/Cylynk_lab_Infrastructure.git
   cd Cylynk_lab_Infrastructure
   ```

2. **Configure AWS credentials**

   ```bash
   aws configure
   ```

3. **Initialize Terraform (Dev environment)**

   ```bash
   cd environments/dev
   terraform init
   terraform plan
   ```

4. **Install Ansible dependencies**

   ```bash
   cd ansible
   ansible-galaxy collection install -r requirements.yml
   ```

5. **Run Ansible playbook**
   ```bash
   ansible-playbook playbooks/guacamole.yml -i inventory/hosts.yml
   ```

## CI/CD Pipelines

This project uses GitHub Actions for automated testing and deployment with **OIDC authentication** for enhanced security. See [CI/CD Documentation](.github/CICD.md) for detailed setup instructions.

### Workflows

- **Terraform Validation**: Runs on every PR, validates and plans changes
- **Terraform Deploy**: Deploys infrastructure on merge to main
- **Ansible Validation**: Lints and validates Ansible code
- **Security Scan**: Daily security scanning with tfsec, checkov, and more

### Authentication

Uses **OpenID Connect (OIDC)** for secure, credential-free AWS authentication:

- ✅ No long-lived credentials stored in GitHub
- ✅ Automatic credential rotation
- ✅ Fine-grained IAM role-based access

See [AWS OIDC Setup Guide](.github/AWS_OIDC_SETUP.md) for configuration instructions.

### Required Secrets

Set these in GitHub Settings → Secrets:

```
AWS_ROLE_TO_ASSUME         # ARN of IAM role for dev environment
PROD_AWS_ROLE_TO_ASSUME    # ARN of IAM role for production
AWS_REGION                 # AWS region (e.g., us-east-1)
```

**Note**: No AWS access keys are stored! Authentication uses OIDC.

## Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes to Terraform/Ansible code
3. Format Terraform: `terraform fmt -recursive`
4. Lint Ansible: `ansible-lint playbooks/ roles/`
5. Commit and push changes
6. Create a pull request
7. Review CI/CD checks and plan output
8. Merge after approval

## Deployment

### Development Environment

Automatically deploys when merging to `main` branch.

### Production Environment

Manual deployment via GitHub Actions:

1. Go to Actions → Terraform Deploy
2. Click "Run workflow"
3. Select environment: `prod`
4. Select action: `apply`
5. Click "Run workflow"

## Modules

### Networking

VPC configuration, subnets, NAT gateway, and routing.

### Security

Security groups, IAM roles, and policies.

### Guacamole

Apache Guacamole remote desktop gateway server.

### Monitoring

CloudWatch logs, metrics, and alarms.

### Storage

S3 buckets and EBS volumes.

## Contributing

1. Follow the [development workflow](#development-workflow)
2. Ensure all CI/CD checks pass
3. Request review from team members
4. Address review comments
5. Merge after approval

## Documentation

- [CI/CD Setup Guide](.github/CICD.md)
- [Ansible README](ansible/README.md)
- Module READMEs in respective `modules/*/README.md`

## Support

For questions or issues:

- Open a GitHub issue
- Contact the infrastructure team
- Check workflow logs in GitHub Actions

## License

[Add your license information here]

## Authors

- Infrastructure Team @ AmaliTech gGmbH
