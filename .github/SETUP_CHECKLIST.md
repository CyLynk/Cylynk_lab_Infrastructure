# CI/CD Setup Checklist

Use this checklist to ensure your CI/CD pipelines are properly configured.

## ✅ Initial Setup

### 1. GitHub Repository Settings

- [ ] Repository exists: `jacobadiaba/Cylynk_lab_Infrastructure`
- [ ] Default branch is set to `main`
- [ ] Branch protection rules enabled for `main`
  - [ ] Require pull request reviews (at least 1)
  - [ ] Require status checks to pass
  - [ ] Require branches to be up to date
  - [ ] Include administrators (optional)

### 2. AWS OIDC Configuration

Follow the detailed guide: [AWS OIDC Setup Guide](AWS_OIDC_SETUP.md)

- [ ] Create AWS OIDC Identity Provider

  - Provider URL: `https://token.actions.githubusercontent.com`
  - Audience: `sts.amazonaws.com`
  - Thumbprint: Auto-fetched by AWS

- [ ] Create IAM Role for Development

  - Role name: `github-actions-terraform-dev`
  - Trust policy configured for your GitHub repository
  - Attach necessary permissions (EC2, VPC, S3, DynamoDB, CloudWatch)
  - Copy Role ARN: `______________________`

- [ ] Create IAM Role for Production
  - Role name: `github-actions-terraform-prod`
  - Trust policy restricted to `main` branch only
  - Attach necessary permissions
  - Copy Role ARN: `______________________`

### 3. GitHub Secrets Configuration

Navigate to: `Settings → Secrets and variables → Actions → New repository secret`

#### Required Secrets (OIDC-based):

- [ ] `AWS_ROLE_TO_ASSUME` - ARN of dev IAM role
  - Example: `arn:aws:iam::123456789012:role/github-actions-terraform-dev`
- [ ] `PROD_AWS_ROLE_TO_ASSUME` - ARN of prod IAM role
  - Example: `arn:aws:iam::123456789012:role/github-actions-terraform-prod`
- [ ] `AWS_REGION` - AWS region (e.g., `us-east-1`)

#### Deprecated Secrets (Remove if present):

- [ ] Delete `AWS_ACCESS_KEY_ID` (if exists)
- [ ] Delete `AWS_SECRET_ACCESS_KEY` (if exists)
- [ ] Delete `PROD_AWS_ACCESS_KEY_ID` (if exists)
- [ ] Delete `PROD_AWS_SECRET_ACCESS_KEY` (if exists)

### 4. GitHub Environments

Navigate to: `Settings → Environments → New environment`

#### Development Environment

- [ ] Create environment named `development`
- [ ] Set environment URL (optional): `https://dev.cyberlab.example.com`
- [ ] Configure protection rules:
  - [ ] Required reviewers (optional for dev)
  - [ ] Wait timer (optional)
  - [ ] Deployment branches: Selected branches → `main`

#### Production Environment

- [ ] Create environment named `production`
- [ ] Set environment URL (optional): `https://cyberlab.example.com`
- [ ] Configure protection rules:
  - [ ] Required reviewers: **At least 1-2 reviewers** ⚠️
  - [ ] Wait timer: 5 minutes (recommended)
  - [ ] Deployment branches: Selected branches → `main`

### 5. Terraform Backend Configuration

- [ ] Create S3 bucket for Terraform state

  - Bucket name: `______________________`
  - Region: `______________________`
  - Versioning: Enabled
  - Encryption: Enabled

- [ ] Create DynamoDB table for state locking

  - Table name: `terraform-state-locks`
  - Partition key: `LockID` (String)

- [ ] Update backend configuration:

  - [ ] `environments/dev/backend.tf`
  - [ ] `environments/prod/backend.tf`

- [ ] Initialize Terraform with remote backend:
  ```bash
  cd environments/dev
  terraform init
  cd ../prod
  terraform init
  ```

### 5. AWS IAM Permissions

Ensure the IAM user/role has these permissions:

- [ ] EC2 (full access or specific permissions)
- [ ] VPC (full access or specific permissions)
- [ ] S3 (read/write to state bucket)
- [ ] DynamoDB (read/write to lock table)
- [ ] CloudWatch (logs and metrics)
- [ ] IAM (if creating roles/policies)
- [ ] Systems Manager Parameter Store (if used)

### 6. Repository Files

- [ ] All workflow files exist in `.github/workflows/`:

  - [ ] `terraform-validate.yml`
  - [ ] `terraform-deploy.yml`
  - [ ] `ansible-validate.yml`
  - [ ] `security-scan.yml`

- [ ] Documentation files exist:

  - [ ] `README.md`
  - [ ] `.github/CICD.md`
  - [ ] `.github/QUICK_REFERENCE.md`
  - [ ] `.github/pull_request_template.md`

- [ ] Configuration files:
  - [ ] `.gitignore` (updated)
  - [ ] `ansible/.yamllint.yml`

## 🧪 Testing

### 1. Test Workflows Locally

- [ ] Run Terraform format check:

  ```bash
  terraform fmt -recursive
  ```

- [ ] Run Terraform validation:

  ```bash
  cd environments/dev
  terraform init -backend=false
  terraform validate
  ```

- [ ] Run Ansible lint:
  ```bash
  cd ansible
  pip install ansible-lint yamllint
  yamllint .
  ansible-lint playbooks/ roles/
  ```

### 2. Test GitHub Actions

- [ ] Create a test branch:

  ```bash
  git checkout -b test/ci-cd-setup
  ```

- [ ] Make a small change (e.g., add comment to a .tf file)

- [ ] Push and create a PR:

  ```bash
  git add .
  git commit -m "Test: CI/CD setup"
  git push origin test/ci-cd-setup
  ```

- [ ] Verify workflows run:

  - [ ] Terraform Validation workflow runs
  - [ ] Ansible Validation workflow runs (if Ansible files changed)
  - [ ] PR comments are posted
  - [ ] All checks pass

- [ ] Test manual deployment (optional):
  - [ ] Go to Actions → Terraform Deploy
  - [ ] Run workflow manually with `environment: dev` and `action: plan`
  - [ ] Verify it completes successfully

## 🚀 Production Readiness

### 1. Security Checklist

- [ ] Secrets are properly configured (not hardcoded)
- [ ] Branch protection enabled
- [ ] Required reviews configured for production
- [ ] Security scanning enabled
- [ ] State file is encrypted and secured
- [ ] AWS credentials use least privilege principle
- [ ] State locking is enabled (DynamoDB)

### 2. Documentation Review

- [ ] Team is aware of new CI/CD processes
- [ ] CI/CD documentation is accessible
- [ ] Quick reference guide is shared
- [ ] Deployment procedures are documented
- [ ] Rollback procedures are documented

### 3. Monitoring and Alerts

- [ ] GitHub Actions notifications configured
- [ ] Slack/Teams integration (optional)
- [ ] AWS CloudWatch alarms configured
- [ ] Log aggregation setup
- [ ] Cost monitoring enabled

### 4. Backup and Recovery

- [ ] Terraform state backup strategy in place
- [ ] S3 bucket versioning enabled
- [ ] Recovery procedures documented
- [ ] Tested rollback process
- [ ] Contact list for emergencies

## 📋 Post-Setup Tasks

### Week 1

- [ ] Monitor all workflow runs
- [ ] Address any failures immediately
- [ ] Gather team feedback
- [ ] Document any issues or improvements

### Week 2

- [ ] Review security scan results
- [ ] Optimize workflow performance
- [ ] Add any missing workflows
- [ ] Update documentation based on feedback

### Monthly

- [ ] Review and rotate AWS credentials
- [ ] Audit workflow permissions
- [ ] Review and update documentation
- [ ] Check for GitHub Actions updates
- [ ] Review cost implications

## 🆘 Support and Resources

### Documentation

- [ ] Bookmark: [CI/CD Guide](.github/CICD.md)
- [ ] Bookmark: [Quick Reference](.github/QUICK_REFERENCE.md)

### Key Contacts

- Infrastructure Lead: **\*\***\_\_\_**\*\***
- DevOps Team: **\*\***\_\_\_**\*\***
- Security Team: **\*\***\_\_\_**\*\***
- On-call Engineer: **\*\***\_\_\_**\*\***

### Useful Links

- GitHub Repository: https://github.com/jacobadiaba/Cylynk_lab_Infrastructure
- Actions Dashboard: https://github.com/jacobadiaba/Cylynk_lab_Infrastructure/actions
- AWS Console: https://console.aws.amazon.com
- Terraform Registry: https://registry.terraform.io

## ✨ Optional Enhancements

Future improvements to consider:

- [ ] Set up Terraform Cloud for remote state
- [ ] Implement cost estimation (Infracost)
- [ ] Add integration tests
- [ ] Set up Slack/Teams notifications
- [ ] Implement drift detection
- [ ] Add performance testing
- [ ] Set up automated backups
- [ ] Implement blue-green deployments
- [ ] Add canary deployments
- [ ] Set up disaster recovery procedures

---

**Setup Completed By:** **\*\***\_\_\_**\*\***  
**Date:** **\*\***\_\_\_**\*\***  
**Verified By:** **\*\***\_\_\_**\*\***  
**Date:** **\*\***\_\_\_**\*\***
