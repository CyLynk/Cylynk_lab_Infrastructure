# Quick Start: OIDC Setup

Follow these steps to enable OIDC authentication for your GitHub Actions workflows.

## ⚡ Quick Setup (15-20 minutes)

### Step 1: Get Your AWS Account ID

```bash
aws sts get-caller-identity --query Account --output text
```

Save this number - you'll need it multiple times.

### Step 2: Create OIDC Provider in AWS

**Option A: AWS Console**

1. Go to [IAM Console](https://console.aws.amazon.com/iam/) → Identity providers → Add provider
2. Provider URL: `https://token.actions.githubusercontent.com`
3. Click "Get thumbprint"
4. Audience: `sts.amazonaws.com`
5. Click "Add provider"

**Option B: AWS CLI**

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### Step 3: Create IAM Role for Dev

**Using AWS Console:**

1. IAM → Roles → Create role
2. Select "Web identity"
3. Identity provider: `token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Name: `github-actions-terraform-dev`
6. Attach policies: EC2FullAccess, VPCFullAccess, S3FullAccess, DynamoDBFullAccess, CloudWatchLogsFullAccess

**Using AWS CLI:**

Create `trust-policy-dev.json` (replace `YOUR_ACCOUNT_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
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

Run:

```bash
# Create role
aws iam create-role \
  --role-name github-actions-terraform-dev \
  --assume-role-policy-document file://trust-policy-dev.json

# Attach policies (basic set - adjust as needed)
aws iam attach-role-policy \
  --role-name github-actions-terraform-dev \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2FullAccess

aws iam attach-role-policy \
  --role-name github-actions-terraform-dev \
  --policy-arn arn:aws:iam::aws:policy/AmazonVPCFullAccess

aws iam attach-role-policy \
  --role-name github-actions-terraform-dev \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

### Step 4: Create IAM Role for Prod

Create `trust-policy-prod.json` (replace `YOUR_ACCOUNT_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
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

Run:

```bash
aws iam create-role \
  --role-name github-actions-terraform-prod \
  --assume-role-policy-document file://trust-policy-prod.json

# Attach same policies as dev
aws iam attach-role-policy \
  --role-name github-actions-terraform-prod \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2FullAccess
# ... repeat for other policies
```

### Step 5: Get Role ARNs

```bash
# Get dev role ARN
aws iam get-role \
  --role-name github-actions-terraform-dev \
  --query 'Role.Arn' \
  --output text

# Get prod role ARN
aws iam get-role \
  --role-name github-actions-terraform-prod \
  --query 'Role.Arn' \
  --output text
```

Copy these ARNs - you'll need them for GitHub Secrets.

### Step 6: Add Secrets to GitHub

1. Go to https://github.com/jacobadiaba/Cylynk_lab_Infrastructure/settings/secrets/actions
2. Click "New repository secret"
3. Add these three secrets:

| Name                      | Value                                                          |
| ------------------------- | -------------------------------------------------------------- |
| `AWS_ROLE_TO_ASSUME`      | `arn:aws:iam::123456789012:role/github-actions-terraform-dev`  |
| `PROD_AWS_ROLE_TO_ASSUME` | `arn:aws:iam::123456789012:role/github-actions-terraform-prod` |
| `AWS_REGION`              | `us-east-1` (or your region)                                   |

### Step 7: Test It!

Create a test PR:

```bash
git checkout -b test/oidc-setup
echo "# OIDC Test" >> README.md
git add README.md
git commit -m "test: OIDC authentication"
git push origin test/oidc-setup
```

Then create a PR on GitHub and check that the workflows run successfully!

### Step 8: Clean Up (Optional)

If you had old AWS credentials:

1. **Delete old GitHub Secrets:**

   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `PROD_AWS_ACCESS_KEY_ID`
   - `PROD_AWS_SECRET_ACCESS_KEY`

2. **Delete old IAM users/keys in AWS:**

   ```bash
   # List access keys for a user
   aws iam list-access-keys --user-name github-actions-user

   # Delete access key
   aws iam delete-access-key \
     --user-name github-actions-user \
     --access-key-id AKIAIOSFODNN7EXAMPLE
   ```

## 🎉 Done!

Your GitHub Actions now use OIDC for secure, credential-free AWS authentication!

## 📚 More Information

- **Detailed Guide**: [AWS_OIDC_SETUP.md](AWS_OIDC_SETUP.md)
- **Migration Details**: [OIDC_MIGRATION.md](OIDC_MIGRATION.md)
- **Full Checklist**: [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)

## 🆘 Troubleshooting

**Error: "Not authorized to perform sts:AssumeRoleWithWebIdentity"**

- Double-check the role ARN in GitHub Secrets
- Verify trust policy has correct repository name
- Ensure OIDC provider exists in AWS

**Error: "Access Denied" during Terraform**

- IAM role needs more permissions
- Attach additional IAM policies to the role

**Can't find the workflow output?**

- Go to: https://github.com/jacobadiaba/Cylynk_lab_Infrastructure/actions
- Click on the failed workflow run
- Check the "Configure AWS Credentials" step for errors
