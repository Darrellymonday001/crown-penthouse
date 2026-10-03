CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash CHAR(128) NOT NULL,
  password_salt CHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  session_token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  INDEX (expires_at)
);

CREATE TABLE IF NOT EXISTS applications (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  application_id VARCHAR(32) NOT NULL UNIQUE,
  access_token_hash CHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(80) NOT NULL,
  residence VARCHAR(255) NOT NULL,
  budget_range VARCHAR(255) NOT NULL,
  purchase_intent VARCHAR(100) NOT NULL,
  payment_preference VARCHAR(40) NOT NULL,
  application_status VARCHAR(40) NOT NULL DEFAULT 'NEW',
  payment_status VARCHAR(50) NOT NULL DEFAULT 'NOT REQUESTED',
  sales_representative VARCHAR(255) NOT NULL DEFAULT 'Unassigned',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (application_status), INDEX (payment_status), INDEX (email)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  application_id VARCHAR(32) NOT NULL,
  sender ENUM('concierge', 'applicant', 'system') NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
  INDEX (application_id, created_at)
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  application_id VARCHAR(32) NOT NULL,
  order_id VARCHAR(80) NOT NULL UNIQUE,
  invoice_id VARCHAR(80) NULL UNIQUE,
  payment_id VARCHAR(80) NULL UNIQUE,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'waiting',
  price_amount DECIMAL(12, 2) NOT NULL,
  price_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  pay_currency VARCHAR(40) NOT NULL,
  invoice_url TEXT NULL,
  provider_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
  INDEX (application_id, created_at)
);

CREATE TABLE IF NOT EXISTS applicant_documents (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  application_id VARCHAR(32) NOT NULL,
  document_type VARCHAR(40) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
  INDEX (application_id, uploaded_at)
);