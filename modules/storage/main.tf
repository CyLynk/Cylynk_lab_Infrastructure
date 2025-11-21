# modules/storage/main.tf

terraform {
  required_version = ">= 1.0"
}

data "aws_caller_identity" "current" {}

# S3 Bucket - Configurations
resource "aws_s3_bucket" "configs" {
  bucket = "${var.project_name}-${var.environment}-configs-${data.aws_caller_identity.current.account_id}"

  tags = merge(
    var.tags,
    {
      Name    = "${var.project_name}-${var.environment}-configs"
      Purpose = "VPN configs and templates"
    }
  )
}

# S3 Bucket - Logs
resource "aws_s3_bucket" "logs" {
  bucket = "${var.project_name}-${var.environment}-logs-${data.aws_caller_identity.current.account_id}"

  tags = merge(
    var.tags,
    {
      Name    = "${var.project_name}-${var.environment}-logs"
      Purpose = "Session and audit logs"
    }
  )
}

# S3 Bucket - AMIs and Snapshots
resource "aws_s3_bucket" "amis" {
  bucket = "${var.project_name}-${var.environment}-amis-${data.aws_caller_identity.current.account_id}"

  tags = merge(
    var.tags,
    {
      Name    = "${var.project_name}-${var.environment}-amis"
      Purpose = "AMI exports and lab templates"
    }
  )
}

# Enable versioning
resource "aws_s3_bucket_versioning" "configs" {
  count  = var.enable_versioning ? 1 : 0
  bucket = aws_s3_bucket.configs.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "configs" {
  bucket = aws_s3_bucket.configs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "amis" {
  bucket = aws_s3_bucket.amis.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "configs" {
  bucket = aws_s3_bucket.configs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "amis" {
  bucket = aws_s3_bucket.amis.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rules for logs
resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  count  = var.enable_lifecycle_rules ? 1 : 0
  bucket = aws_s3_bucket.logs.id

  rule {
    filter {
      prefix = ""
    }

    id     = "transition-to-ia"
    status = "Enabled"

    transition {
      days          = var.lifecycle_transition_days
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = var.lifecycle_expiration_days
    }
  }
}