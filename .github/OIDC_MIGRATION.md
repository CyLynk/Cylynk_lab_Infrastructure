# OIDC Migration Summary

## Overview

The GitHub Actions workflows have been successfully migrated from static AWS credentials to **OpenID Connect (OIDC)** authentication.

## What Changed

### Updated Workflows

1. **`.github/workflows/terraform-validate.yml`**

   - Added `id-token: write` permission at job level
   - Replaced `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` env vars
   - Added `Configure AWS Credentials` step using `aws-actions/configure-aws-credentials@v4`
   - Uses `AWS_ROLE_TO_ASSUME` secret for role ARN

2. **`.github/workflows/terraform-deploy.yml`**
   - Updated both `terraform-deploy-dev` and `terraform-deploy-prod` jobs
   - Added `id-token: write` permission
   - Replaced static credentials with OIDC role assumption
   - Dev uses `AWS_ROLE_TO_ASSUME`, Prod uses `PROD_AWS_ROLE_TO_ASSUME`

### New Documentation

1. **`.github/AWS_OIDC_SETUP.md`** (NEW)

   - Comprehensive guide for setting up AWS OIDC with GitHub Actions
   - Step-by-step instructions for creating OIDC provider
   - IAM role creation with trust policies
   - Security best practices and troubleshooting
   - Custom IAM policy examples

2. **`.github/CICD.md`** (UPDATED)

   - Updated secrets section to reflect OIDC requirements
   - Added link to AWS OIDC Setup Guide
   - Removed references to static credentials

3. **`.github/SETUP_CHECKLIST.md`** (UPDATED)

   - Added AWS OIDC configuration section
   - Updated secrets checklist for OIDC
   - Added deprecated secrets removal checklist

4. **`README.md`** (UPDATED)

   - Updated CI/CD section to mention OIDC authentication
   - Listed OIDC benefits
   - Updated required secrets section
   - Added link to AWS OIDC Setup Guide

5. **`.github/QUICK_REFERENCE.md`** (UPDATED)
   - Updated AWS credentials troubleshooting section
   - Added OIDC-specific debugging tips

## Required GitHub Secrets

### New Secrets (OIDC-based)

| Secret Name               | Description              | Example                                                        |
| ------------------------- | ------------------------ | -------------------------------------------------------------- |
| `AWS_ROLE_TO_ASSUME`      | ARN of IAM role for dev  | `arn:aws:iam::123456789012:role/github-actions-terraform-dev`  |
| `PROD_AWS_ROLE_TO_ASSUME` | ARN of IAM role for prod | `arn:aws:iam::123456789012:role/github-actions-terraform-prod` |
| `AWS_REGION`              | AWS region               | `us-east-1`                                                    |

### Deprecated Secrets (Should be removed)

- ❌ `AWS_ACCESS_KEY_ID`
- ❌ `AWS_SECRET_ACCESS_KEY`
- ❌ `PROD_AWS_ACCESS_KEY_ID`
- ❌ `PROD_AWS_SECRET_ACCESS_KEY`

## AWS Setup Required

### 1. Create OIDC Identity Provider

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. Create IAM Roles

**Development Role:**

- Name: `github-actions-terraform-dev`
- Trust Policy: Allow repository `jacobadiaba/Cylynk_lab_Infrastructure`
- Permissions: EC2, VPC, S3, DynamoDB, CloudWatch

**Production Role:**

- Name: `github-actions-terraform-prod`
- Trust Policy: Restrict to `main` branch only
- Permissions: Same as dev

See [AWS_OIDC_SETUP.md](.github/AWS_OIDC_SETUP.md) for complete instructions.

## Benefits

✅ **Enhanced Security**

- No long-lived credentials stored in GitHub
- Credentials cannot be exfiltrated or leaked
- Automatic rotation with each workflow run

✅ **Fine-Grained Control**

- IAM trust policies can restrict by repository, branch, environment
- Separate roles for dev and prod with different permissions
- Can use IAM conditions for advanced access control

✅ **Better Audit Trail**

- CloudTrail shows which GitHub workflow assumed which role
- Session names include workflow and environment information
- Easier to track and audit deployments

✅ **Compliance**

- Meets security requirements for credential management
- Aligns with AWS and GitHub best practices
- Reduces attack surface

## Migration Steps

1. **Set up AWS OIDC Provider** (See AWS_OIDC_SETUP.md)

   - Create OIDC identity provider in AWS IAM
   - Create IAM roles with trust policies
   - Attach necessary permissions to roles

2. **Update GitHub Secrets**

   - Add `AWS_ROLE_TO_ASSUME` with dev role ARN
   - Add `PROD_AWS_ROLE_TO_ASSUME` with prod role ARN
   - Keep `AWS_REGION` secret
   - Delete old credential secrets

3. **Test Workflows**

   - Create a test PR to verify terraform-validate workflow
   - Manually trigger terraform-deploy to verify both environments
   - Check workflow logs for successful role assumption

4. **Clean Up**
   - Remove old AWS access keys from AWS IAM (if they exist)
   - Update documentation references
   - Notify team of the change

## Workflow Changes Detail

### Before (Static Credentials)

```yaml
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  AWS_REGION: ${{ secrets.AWS_REGION }}
steps:
  - name: Checkout code
    uses: actions/checkout@v4
  - name: Setup Terraform
    uses: hashicorp/setup-terraform@v3
```

### After (OIDC)

```yaml
permissions:
  id-token: write
  contents: read
steps:
  - name: Checkout code
    uses: actions/checkout@v4
  - name: Configure AWS Credentials
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
      aws-region: ${{ secrets.AWS_REGION }}
      role-session-name: GitHubActions-TerraformPlan-Dev
  - name: Setup Terraform
    uses: hashicorp/setup-terraform@v3
```

## Troubleshooting

### Common Issues

1. **"Not authorized to perform sts:AssumeRoleWithWebIdentity"**

   - Check OIDC provider is created in AWS
   - Verify role ARN in GitHub Secrets is correct
   - Ensure trust policy allows your repository

2. **"Access Denied" on AWS API calls**

   - IAM role needs more permissions
   - Check and attach required IAM policies

3. **Workflow fails to get credentials**
   - Ensure `permissions: id-token: write` is set
   - Verify the `Configure AWS Credentials` step runs before Terraform

## Rollback Plan

If issues arise, you can temporarily rollback by:

1. Re-add the old secrets:

   ```
   AWS_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY
   PROD_AWS_ACCESS_KEY_ID
   PROD_AWS_SECRET_ACCESS_KEY
   ```

2. Revert workflow changes to use `env:` with static credentials

3. Remove the OIDC-specific steps

However, it's recommended to fix OIDC issues rather than rollback, as OIDC is more secure.

## Next Steps

1. ✅ Review and merge these changes
2. ⏳ Set up AWS OIDC provider and IAM roles
3. ⏳ Add new secrets to GitHub
4. ⏳ Test workflows with a PR
5. ⏳ Delete old AWS credential secrets
6. ⏳ Notify team of the migration

## Resources

- [AWS OIDC Setup Guide](AWS_OIDC_SETUP.md)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC Provider](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [configure-aws-credentials Action](https://github.com/aws-actions/configure-aws-credentials)

---

**Migration Date**: November 23, 2025  
**Status**: ✅ Complete - Ready for AWS configuration and testing
