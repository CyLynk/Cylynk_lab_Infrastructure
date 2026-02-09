# GitHub Copilot Instructions - CyberLab Infrastructure

## Project Overview

**Hybrid IaC project** deploying a cloud-based cybersecurity lab (CyberLab/Cylynk) on AWS:

- **Terraform**: Modular AWS resources with `environments/dev/` and `environments/prod/`
- **Ansible**: Post-provisioning for Guacamole and AttackBox instances
- **Python Lambdas**: Session orchestration API (16 functions including WebSocket + lab management)
- **Moodle Plugins**: Two plugins - `local_attackbox` (floating launcher) + `mod_cyberlab` (course activity)
- **Packer**: Custom Kali Linux + vulnerable lab target AMIs (DVWA, Juice Shop)

## Architecture

```
Moodle LMS → API Gateway → Lambda → DynamoDB (sessions/usage/lab_templates)
                                  ↓
                     EC2 Auto Scaling (tiered AttackBox pools)
                                  ↓
                     Guacamole (RDP Gateway) → Student Browser
```

**Key Modules:**

- `modules/orchestrator`: Lambda API + DynamoDB + lab templates (`lab-templates.tf`)
- `modules/networking`: VPC with management, AttackBox pool, student lab subnets
- `modules/attackbox`: Multi-tier ASGs (freemium/starter/pro) with warm pools
- `modules/guacamole`: Apache Guacamole RDP gateway with Let's Encrypt SSL
- `moodle-plugin/local_attackbox`: Site-wide floating launcher UI, usage dashboard
- `moodle-plugin/mod_cyberlab`: Course activity module for embedded labs (depends on local_attackbox)

## Critical Workflows

### 1. Terraform Development

```bash
terraform fmt -recursive           # Required before commit (CI checks)
cd environments/dev && terraform init && terraform plan
# Production: manual via GitHub Actions → workflow_dispatch
```

**Module Order:** Networking → Security → Monitoring → Guacamole/Orchestrator/AttackBox

### 2. Lambda Development

```bash
# Build all Lambda packages (CI/CD uses this)
python scripts/build-lambdas.py
# Output: modules/orchestrator/lambda/packages/*.zip, lambda/layers/common.zip
```

**Lambda Functions (16 total):**

- **Session:** `create-session`, `get-session-status`, `terminate-session`, `session-heartbeat`, `admin-sessions`
- **Pool/Usage:** `pool-manager`, `get-usage`, `usage-history`
- **Labs:** `create-lab-session`, `get-lab-status`, `terminate-lab-session`, `list-lab-templates`
- **WebSocket:** `websocket-connect`, `websocket-disconnect`, `websocket-default`, `websocket-push`

**Pattern:** Each function has `index.py` with `lambda_handler(event, context)`. Import shared utils:

```python
from utils import DynamoDBClient, success_response, error_response, SessionStatus
```

### 3. Ansible Configuration

```bash
cd ansible
ansible-galaxy collection install -r requirements.yml
ansible-playbook playbooks/guacamole.yml -i inventory/hosts.yml
```

### 4. Packer AMI Building

```bash
# AttackBox (Kali Linux)
cd packer/attackbox && packer build -var-file=dev.pkrvars.hcl kali-attackbox.pkr.hcl

# Lab targets (DVWA, Juice Shop)
cd packer/labs && packer build dvwa.pkr.hcl
```

## Project Conventions

### Terraform

- **Tagging:** Provider `default_tags` block (Project, Environment, ManagedBy, Owner, CostCenter)
- **Naming:** `{project_name}-{environment}-{resource}` (e.g., `cylynk_infra-dev-api-gateway`)
- **Modules:** Referenced via `../../modules/{name}` from environments
- **State:** S3 backend + DynamoDB lock (see `environments/*/backend.tf`)
- **Secrets:** CI/CD generates `terraform.tfvars` from GitHub secrets/variables (no secrets in repo)

### Lambda Functions

- **Auth:** HMAC-SHA256 tokens via `MOODLE_WEBHOOK_SECRET` env var
- **Sessions:** DynamoDB TTL on `expires_at` field (default 4h via `session_ttl_hours`)
- **Response helpers:** Always use `success_response(data)` or `error_response(status, msg)`
- **Plan Tiers:** freemium (t3.micro, 5h/mo), starter (t3.small, 15h/mo), pro (t3.medium, unlimited)

### Moodle Plugins

**`local_attackbox`** (site-wide, floating button):

- Version: Increment `$plugin->version = YYYYMMDDXX` in `version.php`
- AJAX endpoints: `ajax/*.php` - all require `require_login()` + `require_sesskey()`
- JS modules: `amd/src/launcher.js`, `admin-dashboard.js`, `usage-dashboard.js`
- Deploy: Copy to `local/attackbox/`, run `php admin/cli/purge_caches.php`

**`mod_cyberlab`** (course activity):

- Depends on `local_attackbox` (see `$plugin->dependencies`)
- Embeds lab sessions directly in course activities
- Template IDs must match `lab-templates.tf` definitions (e.g., `dvwa-web-vuln`, `juice-shop`)

### CI/CD (GitHub Actions)

- **OIDC Auth:** No AWS keys - uses `AWS_ROLE_TO_ASSUME` / `PROD_AWS_ROLE_TO_ASSUME`
- **Auto-deploy:** Push to `main` → deploys dev environment
- **Prod deploy:** Manual via Actions → "Terraform Deploy" → select `prod` + `apply`
- **Workflows:** `terraform-validate.yml`, `terraform-deploy.yml`, `ansible-validate.yml`, `security-scan.yml`

## Key Files

| Purpose             | Location                                              |
| ------------------- | ----------------------------------------------------- |
| Module wiring       | `environments/{dev,prod}/main.tf`                     |
| Session API logic   | `modules/orchestrator/lambda/*/index.py`              |
| Shared Lambda utils | `modules/orchestrator/lambda/common/utils.py`         |
| DynamoDB schema     | `modules/orchestrator/main.tf` (tables section)       |
| Lab templates seed  | `modules/orchestrator/lab-templates.tf`               |
| Tier config         | `environments/*/terraform.tfvars` → `attackbox_tiers` |
| Moodle launcher UI  | `moodle-plugin/local_attackbox/amd/src/launcher.js`   |
| Activity module     | `moodle-plugin/mod_cyberlab/view.php`                 |

## Data Flow Examples

1. **Student launches AttackBox:** `launcher.js` → `ajax/get_token.php` (HMAC) → API Gateway → `create-session` Lambda → ASG → Guacamole connection → RDP URL returned
2. **Lab activity start:** `mod_cyberlab/view.php` → `list-lab-templates` → `create-lab-session` → spins up target VM + AttackBox
3. **Usage tracking:** All session starts/stops update `usage` table → `get-usage` Lambda returns monthly minutes

## Common Tasks

### Add New Lambda Function

1. Create `modules/orchestrator/lambda/{name}/index.py` with `lambda_handler(event, context)`
2. Add function name to `functions` list in `scripts/build-lambdas.py`
3. Add Lambda resource + API Gateway route in `modules/orchestrator/main.tf`

### Add New Lab Template

1. Add template to `demo_lab_templates` local in `modules/orchestrator/lab-templates.tf`
2. Build AMI with Packer in `packer/labs/` if needed
3. Set AMI ID via `demo_dvwa_ami_id` / `demo_juice_shop_ami_id` variables

### Modify Session Limits

- **TTL:** `session_ttl_hours` in `terraform.tfvars` (default: 4)
- **Quotas:** `DEFAULT_PLAN_LIMITS` dict in `lambda/common/utils.py`
- **Instance types:** `PlanTier.INSTANCE_TYPES` in `lambda/common/utils.py`

## Troubleshooting

- **Lambda import error:** Run `python scripts/build-lambdas.py`, verify layer attached in Terraform
- **Guacamole unreachable:** Check SG port 8080, verify `GUACAMOLE_PRIVATE_IP` env var
- **OIDC failure:** Check IAM trust policy for GitHub OIDC provider ARN
- **Moodle plugin missing:** Increment `version.php`, purge caches, check `$plugin->dependencies`
- **Lab template not found:** Verify `template_id` matches between Moodle plugin and `lab-templates.tf`
