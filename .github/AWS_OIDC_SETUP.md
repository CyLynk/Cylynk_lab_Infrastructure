# AWS OIDC Setup Guide for GitHub Actions

This guide walks you through setting up OpenID Connect (OIDC) authentication between GitHub Actions and AWS, eliminating the need for long-lived AWS access keys.

## Why Use OIDC?

✅ **No Long-Lived Credentials**: No need to store AWS access keys in GitHub Secrets  
✅ **Automatic Credential Rotation**: Temporary credentials are issued for each workflow run  
✅ **Fine-Grained Access Control**: Use IAM conditions to restrict access by repository, branch, etc.  
✅ **Better Security**: Reduced risk of credential leakage  
✅ **Audit Trail**: Better tracking of which GitHub workflow assumed which role

## Prerequisites

- AWS Account with admin access (or IAM permissions to create roles and identity providers)
- GitHub repository: `jacobadiaba/Cylynk_lab_Infrastructure`
- AWS CLI installed and configured (optional, but helpful)

## Step 1: Create AWS OIDC Identity Provider

### Using AWS Console

1. **Navigate to IAM Console**

   - Go to https://console.aws.amazon.com/iam/
   - Click **Identity providers** in the left sidebar
   - Click **Add provider**

2. **Configure the Provider**
   - **Provider type**: OpenID Connect
   - **Provider URL**: `https://token.actions.githubusercontent.com`
   - Click **Get thumbprint** (AWS will automatically fetch it)
   - **Audience**: `sts.amazonaws.com`
   - Click **Add provider**

### Using AWS CLI

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

**Note**: The thumbprint above is GitHub's current thumbprint. You can verify it by running:

```bash
openssl s_client -servername token.actions.githubusercontent.com \
  -connect token.actions.githubusercontent.com:443 < /dev/null 2>/dev/null | \
  openssl x509 -fingerprint -sha1 -noout | \
  sed 's/://g' | awk -F= '{print tolower($2)}'
```

## Step 2: Create IAM Role for Development Environment

### Using AWS Console

1. **Navigate to IAM Roles**

   - Go to IAM → Roles → Create role

2. **Select Trusted Entity**

   - Select **Web identity**
   - **Identity provider**: Select the OIDC provider you just created (`token.actions.githubusercontent.com`)
   - **Audience**: `sts.amazonaws.com`
   - Click **Next**

3. **Add Permissions**

   - Attach policies needed for your infrastructure:
     - `AmazonEC2FullAccess` (or create a custom policy with minimal permissions)
     - `AmazonVPCFullAccess`
     - `AmazonS3FullAccess` (for Terraform state)
     - `AmazonDynamoDBFullAccess` (for Terraform state locking)
     - `CloudWatchLogsFullAccess`
   - Click **Next**

4. **Name and Create**

   - **Role name**: `github-actions-terraform-dev`
   - **Description**: `Role for GitHub Actions to deploy dev infrastructure`
   - Click **Create role**

5. **Edit Trust Relationship**
   - Open the role you just created
   - Click **Trust relationships** tab
   - Click **Edit trust policy**
   - Replace with the policy below (update with your repository details)

### Using AWS CLI

Create a file `trust-policy-dev.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:jacobadiaba/Cylynk_lab_Infrastructure:*"
        }
      }
    }
  ]
}
```

**Important**: Replace `YOUR_AWS_ACCOUNT_ID` with your actual AWS account ID.

Create the role:

```bash
# Create the role
aws iam create-role \
  --role-name github-actions-terraform-dev \
  --assume-role-policy-document file://trust-policy-dev.json \
  --description "Role for GitHub Actions to deploy dev infrastructure"

# Attach necessary policies
aws iam attach-role-policy \
  --role-name github-actions-terraform-dev \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2FullAccess

aws iam attach-role-policy \
  --role-name github-actions-terraform-dev \
  --policy-arn arn:aws:iam::aws:policy/AmazonVPCFullAccess

aws iam attach-role-policy \
  --role-name github-actions-terraform-dev \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam attach-role-policy \
  --role-name github-actions-terraform-dev \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

aws iam attach-role-policy \
  --role-name github-actions-terraform-dev \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
```

## Step 3: Create IAM Role for Production Environment

Repeat Step 2 with these changes:

**Role name**: `github-actions-terraform-prod`

**Trust policy** (`trust-policy-prod.json`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:jacobadiaba/Cylynk_lab_Infrastructure:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

**Note**: The production trust policy restricts access to only the `main` branch for additional security.

## Step 4: Configure GitHub Secrets

Now that you have the IAM roles created, you need to add their ARNs to GitHub Secrets.

1. **Get Role ARNs**:

   ```bash
   # Get dev role ARN
   aws iam get-role --role-name github-actions-terraform-dev --query 'Role.Arn' --output text

   # Get prod role ARN
   aws iam get-role --role-name github-actions-terraform-prod --query 'Role.Arn' --output text
   ```

2. **Add Secrets to GitHub**:

   - Go to your repository: https://github.com/jacobadiaba/Cylynk_lab_Infrastructure
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**

   Add these secrets:

   | Secret Name               | Value           | Example                                                        |
   | ------------------------- | --------------- | -------------------------------------------------------------- |
   | `AWS_ROLE_TO_ASSUME`      | Dev role ARN    | `arn:aws:iam::123456789012:role/github-actions-terraform-dev`  |
   | `PROD_AWS_ROLE_TO_ASSUME` | Prod role ARN   | `arn:aws:iam::123456789012:role/github-actions-terraform-prod` |
   | `AWS_REGION`              | Your AWS region | `us-east-1`                                                    |

**Important**: You NO LONGER need these secrets (delete if they exist):

- ❌ `AWS_ACCESS_KEY_ID`
- ❌ `AWS_SECRET_ACCESS_KEY`
- ❌ `PROD_AWS_ACCESS_KEY_ID`
- ❌ `PROD_AWS_SECRET_ACCESS_KEY`

## Step 5: Test the Configuration

### Test Dev Role

1. Create a test branch:

   ```bash
   git checkout -b test/oidc-setup
   ```

2. Make a small change to a Terraform file:

   ```bash
   echo "# OIDC Test" >> environments/dev/main.tf
   ```

3. Commit and push:

   ```bash
   git add environments/dev/main.tf
   git commit -m "test: OIDC authentication"
   git push origin test/oidc-setup
   ```

4. Create a pull request and check if the `terraform-plan-dev` job succeeds

### Test Prod Role

1. Manually trigger the deploy workflow:

   - Go to **Actions** → **Terraform Deploy**
   - Click **Run workflow**
   - Select:
     - Environment: `prod`
     - Action: `plan`
   - Click **Run workflow**

2. Check the workflow logs to verify it successfully assumed the role

## Advanced Trust Policy Conditions

You can add additional conditions to your trust policies for enhanced security:

### Restrict by Branch

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
  },
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:jacobadiaba/Cylynk_lab_Infrastructure:ref:refs/heads/main"
  }
}
```

### Restrict by Environment

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
  },
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:jacobadiaba/Cylynk_lab_Infrastructure:environment:production"
  }
}
```

### Combine Multiple Conditions

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
  },
  "StringLike": {
    "token.actions.githubusercontent.com:sub": [
      "repo:jacobadiaba/Cylynk_lab_Infrastructure:ref:refs/heads/main",
      "repo:jacobadiaba/Cylynk_lab_Infrastructure:environment:production"
    ]
  }
}
```

## Creating Custom IAM Policies

Instead of using AWS managed policies, create custom policies with minimal required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TerraformEC2",
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "ec2:CreateTags",
        "ec2:RunInstances",
        "ec2:TerminateInstances",
        "ec2:StopInstances",
        "ec2:StartInstances"
      ],
      "Resource": "*"
    },
    {
      "Sid": "TerraformVPC",
      "Effect": "Allow",
      "Action": [
        "ec2:CreateVpc",
        "ec2:DeleteVpc",
        "ec2:ModifyVpcAttribute",
        "ec2:CreateSubnet",
        "ec2:DeleteSubnet",
        "ec2:CreateInternetGateway",
        "ec2:AttachInternetGateway",
        "ec2:DetachInternetGateway",
        "ec2:DeleteInternetGateway"
      ],
      "Resource": "*"
    },
    {
      "Sid": "TerraformState",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::your-terraform-state-bucket/*"
    },
    {
      "Sid": "TerraformStateLocking",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/terraform-state-locks"
    }
  ]
}
```

## Troubleshooting

### Error: "Not authorized to perform sts:AssumeRoleWithWebIdentity"

**Solution**: Check that:

1. The OIDC provider is correctly configured
2. The role ARN in GitHub Secrets is correct
3. The trust policy allows your repository
4. The audience is set to `sts.amazonaws.com`

### Error: "No valid credential sources found"

**Solution**: Ensure that:

1. The `Configure AWS Credentials` step comes before any AWS API calls
2. The workflow has `id-token: write` permission
3. The secrets are properly set in GitHub

### Error: "Access Denied" when running Terraform

**Solution**: The IAM role doesn't have sufficient permissions. Check and attach the necessary IAM policies.

### How to Debug

Add this step to your workflow to see what identity is being used:

```yaml
- name: Debug AWS Identity
  run: |
    aws sts get-caller-identity
    aws sts get-session-token
```

## Security Best Practices

1. ✅ Use separate roles for dev and prod
2. ✅ Restrict prod role to only the `main` branch
3. ✅ Use custom IAM policies with minimal permissions
4. ✅ Enable CloudTrail to audit role assumptions
5. ✅ Regularly review and rotate OIDC provider thumbprints
6. ✅ Use GitHub environment protection for production
7. ✅ Enable MFA for AWS Console access to modify IAM roles

## Additional Resources

- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC Provider](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)

## Summary

You've now configured OIDC authentication between GitHub Actions and AWS! 🎉

**What changed:**

- ✅ Created AWS OIDC Identity Provider
- ✅ Created IAM roles with trust policies for GitHub
- ✅ Updated GitHub Secrets with role ARNs
- ✅ Removed long-lived AWS credentials

**Next steps:**

- Test the workflows
- Consider using custom IAM policies with minimal permissions
- Monitor CloudTrail for role assumption activity
