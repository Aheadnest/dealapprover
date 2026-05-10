-- DealApprover — Initial Schema
-- MySQL 8.0+  |  All DATETIME in UTC  |  UUIDs as CHAR(36)
-- Run: mysql -h HOST -u USER -pPASS DATABASE < 001_initial_schema.sql

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET collation_connection = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- users
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                        CHAR(36)        NOT NULL,
  email                     VARCHAR(255)    NOT NULL COLLATE utf8mb4_unicode_ci,
  email_verified_at         DATETIME(3)     NULL,
  password_hash             VARCHAR(255)    NULL,
  phone_e164                VARCHAR(20)     NULL,
  phone_verified_at         DATETIME(3)     NULL,
  display_name              VARCHAR(255)    NOT NULL DEFAULT '',
  locale                    VARCHAR(8)      NOT NULL DEFAULT 'en',
  country_iso2              CHAR(2)         NULL,
  stripe_customer_id        VARCHAR(64)     NULL,
  identity_verification_id  VARCHAR(128)    NULL,
  identity_verified_at      DATETIME(3)     NULL,
  plan                      ENUM('free','pro','business') NOT NULL DEFAULT 'free',
  plan_status               ENUM('active','past_due','canceled') NOT NULL DEFAULT 'active',
  plan_renews_at            DATETIME(3)     NULL,
  quota_period_start        DATE            NOT NULL DEFAULT (CURDATE()),
  quota_used                INT             NOT NULL DEFAULT 0,
  created_at                DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at                DATETIME(3)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_stripe_customer (stripe_customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- oauth_accounts
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id                  CHAR(36)        NOT NULL,
  user_id             CHAR(36)        NOT NULL,
  provider            VARCHAR(32)     NOT NULL,
  provider_account_id VARCHAR(255)    NOT NULL,
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_oauth_provider_account (provider, provider_account_id),
  CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- email_verification_tokens
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         BIGINT          NOT NULL AUTO_INCREMENT,
  user_id    CHAR(36)        NOT NULL,
  token_hash CHAR(64)        NOT NULL,
  expires_at DATETIME(3)     NOT NULL,
  used_at    DATETIME(3)     NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_evtoken_hash (token_hash),
  KEY idx_evtoken_user (user_id),
  CONSTRAINT fk_evtoken_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- password_reset_tokens
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGINT          NOT NULL AUTO_INCREMENT,
  user_id    CHAR(36)        NOT NULL,
  token_hash CHAR(64)        NOT NULL,
  expires_at DATETIME(3)     NOT NULL,
  used_at    DATETIME(3)     NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_prt_user (user_id),
  UNIQUE KEY uq_prt_hash (token_hash),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- phone_verification_codes  (SMS L1 verification)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phone_verification_codes (
  user_id     CHAR(36)        NOT NULL,
  phone_e164  VARCHAR(20)     NOT NULL,
  code_hash   CHAR(64)        NOT NULL,
  expires_at  DATETIME(3)     NOT NULL,
  used_at     DATETIME(3)     NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_pvc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- items
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id                  CHAR(36)        NOT NULL,
  user_id             CHAR(36)        NOT NULL,
  category            VARCHAR(64)     NOT NULL,
  title               VARCHAR(255)    NOT NULL,
  brand               VARCHAR(128)    NULL,
  model               VARCHAR(128)    NULL,
  serial_number_enc   BLOB            NULL,
  serial_number_hash  VARBINARY(32)   NULL,
  imei_enc            BLOB            NULL,
  gtin                VARCHAR(14)     NULL,
  `condition`         ENUM('new','like_new','good','fair') NOT NULL,
  description         TEXT            NOT NULL,
  price_minor         INT             NULL,
  currency            CHAR(3)         NULL,
  extra               JSON            NOT NULL DEFAULT (JSON_OBJECT()),
  status              ENUM('draft','active','revoked') NOT NULL DEFAULT 'draft',
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at          DATETIME(3)     NULL,
  PRIMARY KEY (id),
  KEY idx_items_user_status (user_id, status),
  KEY idx_items_serial_hash (serial_number_hash),
  CONSTRAINT fk_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- item_photos
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_photos (
  id            CHAR(36)        NOT NULL,
  item_id       CHAR(36)        NOT NULL,
  position      TINYINT         NOT NULL,
  s3_key        VARCHAR(512)    NOT NULL,
  thumb_s3_key  VARCHAR(512)    NULL,
  sha256        VARBINARY(32)   NOT NULL,
  width         INT             NOT NULL DEFAULT 0,
  height        INT             NOT NULL DEFAULT 0,
  bytes         INT             NOT NULL DEFAULT 0,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_photos_item (item_id),
  CONSTRAINT fk_photos_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- signing_keys
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signing_keys (
  id              VARCHAR(64)     NOT NULL,
  algorithm       VARCHAR(32)     NOT NULL DEFAULT 'ed25519',
  public_key      VARBINARY(32)   NOT NULL,
  private_key_enc BLOB            NOT NULL,
  activated_at    DATETIME(3)     NOT NULL,
  retired_at      DATETIME(3)     NULL,
  status          ENUM('active','retired','compromised') NOT NULL DEFAULT 'active',
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_signing_keys_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- certificates
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
  id                  CHAR(36)        NOT NULL,
  slug                VARCHAR(16)     NOT NULL,
  item_id             CHAR(36)        NOT NULL,
  user_id             CHAR(36)        NOT NULL,
  version             INT             NOT NULL DEFAULT 1,
  signing_key_id      VARCHAR(64)     NOT NULL,
  payload_canonical   JSON            NOT NULL,
  payload_sha256      VARBINARY(32)   NOT NULL,
  signature           VARBINARY(64)   NOT NULL,
  issued_at           DATETIME(3)     NOT NULL,
  revoked_at          DATETIME(3)     NULL,
  revoke_reason       VARCHAR(255)    NULL,
  qr_s3_key           VARCHAR(512)    NULL,
  pdf_s3_key          VARCHAR(512)    NULL,
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cert_slug (slug),
  KEY idx_cert_user_revoked (user_id, revoked_at),
  KEY idx_cert_item_version (item_id, version),
  CONSTRAINT fk_cert_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_cert_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_cert_key  FOREIGN KEY (signing_key_id) REFERENCES signing_keys(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- scan_events  (append-only, privacy-preserving)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_events (
  id              BIGINT          NOT NULL AUTO_INCREMENT,
  certificate_id  CHAR(36)        NOT NULL,
  at              DATETIME(3)     NOT NULL,
  ip_hash         VARBINARY(32)   NULL,
  country_iso2    CHAR(2)         NULL,
  user_agent_family VARCHAR(128)  NULL,
  referer_host    VARCHAR(255)    NULL,
  PRIMARY KEY (id),
  KEY idx_scan_cert_at (certificate_id, at),
  CONSTRAINT fk_scan_cert FOREIGN KEY (certificate_id) REFERENCES certificates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- audit_log  (append-only)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGINT          NOT NULL AUTO_INCREMENT,
  actor_user_id   CHAR(36)        NULL,
  action          VARCHAR(128)    NOT NULL,
  resource_type   VARCHAR(64)     NULL,
  resource_id     CHAR(36)        NULL,
  metadata        JSON            NULL,
  ip_hash         VARBINARY(32)   NULL,
  at              DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_actor_at (actor_user_id, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- webhook_events  (Stripe idempotency)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id           BIGINT          NOT NULL AUTO_INCREMENT,
  provider     VARCHAR(32)     NOT NULL,
  event_id     VARCHAR(128)    NOT NULL,
  type         VARCHAR(128)    NOT NULL,
  payload      JSON            NOT NULL,
  received_at  DATETIME(3)     NOT NULL,
  processed_at DATETIME(3)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_webhook_event_id (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- reports  (buyer concerns)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id              CHAR(36)        NOT NULL,
  certificate_id  CHAR(36)        NOT NULL,
  kind            VARCHAR(64)     NOT NULL,
  message         TEXT            NOT NULL,
  contact_email   VARCHAR(255)    NULL,
  status          ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  at              DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_reports_cert (certificate_id),
  CONSTRAINT fk_reports_cert FOREIGN KEY (certificate_id) REFERENCES certificates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
