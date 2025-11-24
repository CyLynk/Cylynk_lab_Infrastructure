# GitHub Actions Quick Reference

Quick commands and tips for working with the CI/CD pipelines.

## Local Pre-commit Checks

Run these before pushing to catch issues early:

### Terraform

```bash
# Format all Terraform files
terraform fmt -recursive

# Validate dev environment
cd environments/dev
terraform init -backend=false
terraform validate

# Validate prod environment
cd ../prod
terraform init -backend=false
terraform validate
```

### Ansible

```bash
cd ansible

# Install/update dependencies
ansible-galaxy collection install -r requirements.yml

# Run YAML lint
yamllint .

# Run Ansible lint
ansible-lint playbooks/ roles/

# Check playbook syntax
ansible-playbook --syntax-check playbooks/guacamole.yml -i inventory/hosts.yml.example
```

## GitHub CLI Commands

### Trigger Manual Deployment

```bash
# Deploy to dev
gh workflow run terraform-deploy.yml -f environment=dev -f action=apply

# Plan for prod (dry run)
gh workflow run terraform-deploy.yml -f environment=prod -f action=plan

# Deploy to prod
gh workflow run terraform-deploy.yml -f environment=prod -f action=apply
```

### Check Workflow Status

```bash
# List recent workflow runs
gh run list

# View specific workflow runs
gh run list --workflow=terraform-validate.yml

# Watch a running workflow
gh run watch

# View workflow logs
gh run view <run-id> --log
```

### Work with Pull Requests

```bash
# Create PR with auto-fill
gh pr create --fill

# Check PR status and checks
gh pr status

# View PR checks
gh pr checks

# Merge PR after approval
gh pr merge --squash
```

## Common Workflow Patterns

### Making Infrastructure Changes

```bash
# 1. Create feature branch
git checkout -b feature/add-monitoring

# 2. Make changes to Terraform files
vim environments/dev/main.tf

# 3. Format and validate locally
terraform fmt -recursive
cd environments/dev && terraform init -backend=false && terraform validate

# 4. Commit and push
git add .
git commit -m "Add CloudWatch monitoring"
git push origin feature/add-monitoring

# 5. Create PR
gh pr create --fill

# 6. Review CI/CD results in PR
# 7. Merge when approved
```

### Making Ansible Changes

```bash
# 1. Create feature branch
git checkout -b feature/update-guacamole-role

# 2. Make changes
vim ansible/roles/guacamole/tasks/main.yml

# 3. Lint locally
cd ansible
ansible-lint playbooks/ roles/
yamllint .

# 4. Test syntax
ansible-playbook --syntax-check playbooks/guacamole.yml -i inventory/hosts.yml.example

# 5. Commit and push
git add .
git commit -m "Update Guacamole role configuration"
git push origin feature/update-guacamole-role

# 6. Create PR
gh pr create --fill
```

## Debugging Failed Workflows

### View Failed Workflow Logs

```bash
# List recent runs
gh run list --workflow=terraform-validate.yml

# View specific run
gh run view <run-id>

# Download logs
gh run download <run-id>

# Re-run failed jobs
gh run rerun <run-id> --failed
```

### Common Issues and Solutions

#### Terraform Format Check Failed

```bash
# Fix: Run terraform fmt
terraform fmt -recursive
git add .
git commit -m "Fix Terraform formatting"
git push
```

#### Terraform Validate Failed

```bash
# Check the error in workflow logs
# Common issues:
# - Missing required variables
# - Invalid resource configuration
# - Module version conflicts

# Fix locally:
cd environments/dev
terraform init -backend=false
terraform validate
```

#### Ansible Lint Failed

```bash
# View specific issues
cd ansible
ansible-lint playbooks/ roles/

# Common fixes:
# - Fix YAML formatting
# - Add name to tasks
# - Use FQCN for modules
# - Remove deprecated syntax
```

#### AWS Credentials Error (OIDC)

```bash
# Verify OIDC secrets are set in GitHub:
# Settings → Secrets → Actions
# Required: AWS_ROLE_TO_ASSUME, PROD_AWS_ROLE_TO_ASSUME, AWS_REGION

# Verify the IAM role ARN format is correct:
# Format: arn:aws:iam::123456789012:role/github-actions-terraform-dev

# Check that the IAM role trust policy allows your repository:
aws iam get-role --role-name github-actions-terraform-dev --query 'Role.AssumeRolePolicyDocument'

# Ensure the workflow has id-token: write permission
# Check the workflow YAML for:
# permissions:
#   id-token: write
#   contents: read

# Test role assumption locally (optional):
# This won't work exactly like GitHub Actions, but you can verify the role exists
aws sts get-caller-identity
```

## Useful Git Aliases

Add these to your `~/.gitconfig`:

```ini
[alias]
    # Quick status
    st = status -sb

    # Pretty log
    lg = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit

    # Amend last commit
    amend = commit --amend --no-edit

    # Force push with lease (safer)
    pushf = push --force-with-lease
```

## Monitoring Deployments

### Check Deployment Status

```bash
# View latest deployment
gh run list --workflow=terraform-deploy.yml --limit 1

# Watch live deployment
gh run watch

# View deployment summary
gh run view --web
```

### Rollback a Deployment

```bash
# Option 1: Revert the commit
git revert <commit-hash>
git push origin main

# Option 2: Manual workflow dispatch
gh workflow run terraform-deploy.yml -f environment=dev -f action=apply

# Option 3: Restore previous state (if using remote backend)
# Navigate to AWS S3/Terraform Cloud and restore previous state
```

## Best Practices Checklist

- [ ] Run `terraform fmt` before committing
- [ ] Run `terraform validate` locally
- [ ] Run `ansible-lint` on playbook changes
- [ ] Test playbooks with `--syntax-check`
- [ ] Review `terraform plan` output in PR
- [ ] Get approval before merging
- [ ] Monitor deployment in GitHub Actions
- [ ] Verify deployment in AWS console
- [ ] Check application health after deployment
- [ ] Document any manual steps required

## Environment Variables

Set these locally for testing:

```bash
# AWS credentials
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_REGION="us-east-1"

# Terraform
export TF_LOG=DEBUG  # Enable debug logging
export TF_LOG_PATH=./terraform.log

# Ansible
export ANSIBLE_DEBUG=1
export ANSIBLE_STDOUT_CALLBACK=yaml
```

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [Terraform CLI Reference](https://www.terraform.io/cli/commands)
- [Ansible CLI Documentation](https://docs.ansible.com/ansible/latest/cli/ansible-playbook.html)
- [Project CI/CD Guide](.github/CICD.md)
