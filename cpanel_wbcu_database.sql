-- ============================================================================
-- WB CREDIT UNION (www.wbcu.net) - PHPMYADMIN / CPANEL MYSQL SETUP SCRIPT
-- ============================================================================
-- Compatible with cPanel phpMyAdmin, MySQL 5.7 / 8.0+, MariaDB 10.3+
-- Target Database: glolbka_wbcu_db (or your cPanel database)
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- ----------------------------------------------------------------------------
-- 1. USERS & AUTHENTICATION TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL DEFAULT '12345',
  `role` VARCHAR(50) NOT NULL DEFAULT 'super_admin',
  `is_admin` TINYINT(1) NOT NULL DEFAULT 1,
  `transaction_pin` VARCHAR(10) DEFAULT '8869',
  `two_factor_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `status_reason` TEXT DEFAULT NULL,
  `kyc_status` VARCHAR(50) NOT NULL DEFAULT 'verified',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. MEMBER PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100) DEFAULT '',
  `last_name` VARCHAR(100) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `date_of_birth` VARCHAR(50) DEFAULT NULL,
  `gender` VARCHAR(20) DEFAULT 'Not Specified',
  `nationality` VARCHAR(100) DEFAULT 'Switzerland',
  `occupation` VARCHAR(150) DEFAULT 'Executive Private Client',
  `address_line1` TEXT DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT 'Zurich',
  `state` VARCHAR(100) DEFAULT 'Zurich',
  `postal_code` VARCHAR(30) DEFAULT '8706',
  `country` VARCHAR(100) DEFAULT 'Switzerland',
  `profile_photo_url` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_profiles_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. BANK VAULT ACCOUNTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `account_number` VARCHAR(30) NOT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Checking',
  `account_name` VARCHAR(150) NOT NULL DEFAULT 'Primary Vault',
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `balance` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `available_balance` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `routing_number` VARCHAR(30) NOT NULL DEFAULT '021000089',
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_accounts_number` (`account_number`),
  KEY `idx_accounts_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. WIRE TRANSFER CLEARANCE CODES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `wire_transfer_codes` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `code_type` VARCHAR(20) NOT NULL,
  `code_value` VARCHAR(50) NOT NULL,
  `display_name` VARCHAR(150) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wire_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. DEBIT & CREDIT CARDS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cards` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `account_number` VARCHAR(30) DEFAULT NULL,
  `card_holder` VARCHAR(150) NOT NULL,
  `card_number` VARCHAR(30) NOT NULL,
  `card_masked` VARCHAR(30) NOT NULL,
  `card_type` VARCHAR(100) NOT NULL DEFAULT 'Visa Platinum Debit',
  `theme` VARCHAR(50) DEFAULT 'obsidian',
  `expiry_month` VARCHAR(5) DEFAULT '09',
  `expiry_year` VARCHAR(5) DEFAULT '29',
  `expiry_display` VARCHAR(10) DEFAULT '09/29',
  `cvv` VARCHAR(10) DEFAULT '884',
  `pin` VARCHAR(10) DEFAULT '8869',
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `daily_atm_limit` DECIMAL(12,2) DEFAULT 10000.00,
  `daily_pos_limit` DECIMAL(12,2) DEFAULT 50000.00,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cards_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. SYSTEM SETTINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
  `key_name` VARCHAR(100) NOT NULL,
  `value_json` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. SEED DATA FOR ADMIN & MEMBER ACCESS
-- ----------------------------------------------------------------------------
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role`, `is_admin`, `transaction_pin`, `two_factor_enabled`, `status`, `kyc_status`)
VALUES 
('usr-101', 'mizbrymo', 'mizbrymo@gmail.com', '12345', 'super_admin', 1, '8869', 1, 'active', 'verified'),
('usr-admin-01', 'admin', 'admin@wbcu.net', '12345', 'super_admin', 1, '8869', 1, 'active', 'verified'),
('usr-659', 'ollerobertrstrm52', 'debstarnetwork@gmail.com', 'Password123!', 'user', 0, '8869', 1, 'active', 'verified')
ON DUPLICATE KEY UPDATE 
  `password_hash` = VALUES(`password_hash`),
  `role` = VALUES(`role`),
  `is_admin` = VALUES(`is_admin`),
  `status` = VALUES(`status`);

INSERT INTO `profiles` (`id`, `user_id`, `first_name`, `middle_name`, `last_name`, `full_name`, `phone_number`, `date_of_birth`, `nationality`, `occupation`, `address_line1`, `city`, `state`, `postal_code`, `country`)
VALUES
('prof-101', 'usr-101', 'Miz', '', 'Brymo', 'Miz Brymo', '+41 44 915 8901', '1984-06-14', 'Switzerland', 'Executive Director', '109, Feldgüetliweg, Meilen', 'Zurich', 'Zurich', '8706', 'Switzerland'),
('prof-admin-01', 'usr-admin-01', 'Chief', 'Treasury', 'Auditor', 'Chief Treasury Auditor', '+41 44 915 0000', '1980-01-01', 'Switzerland', 'Chief Treasury Auditor', '109, Feldgüetliweg Meilen', 'Zurich', 'Zurich', '8706', 'Switzerland'),
('prof-659', 'usr-659', 'Olle', 'Robert Christer', 'Råström', 'Olle Robert Christer Råström', '+46702813441', '1982-05-18', 'Sweden', 'Executive Private Client', 'Korgmakargatan 32 621 53 Visby', 'Visby', 'Gotland', '621 53', 'Sweden')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

INSERT INTO `accounts` (`id`, `user_id`, `account_number`, `account_type`, `account_name`, `currency`, `balance`, `available_balance`, `routing_number`, `is_primary`, `status`)
VALUES
('acct-101-usd', 'usr-101', 'WB-9482-1049-55', 'Checking', 'Premier Checking Vault', 'USD', 248500.00, 248500.00, '021000089', 1, 'active'),
('acct-101-chf', 'usr-101', 'WB-9482-1049-56', 'Savings', 'Swiss Franc Reserve Vault', 'CHF', 1450000.00, 1450000.00, '021000089', 0, 'active'),
('acct-659-usd', 'usr-659', '09372996993', 'Checking', 'Primary Checking Vault', 'USD', 100000.00, 100000.00, '021000089', 1, 'active')
ON DUPLICATE KEY UPDATE `balance` = VALUES(`balance`);

INSERT INTO `wire_transfer_codes` (`id`, `user_id`, `code_type`, `code_value`, `display_name`, `description`, `is_active`)
VALUES
('wc-101-cot', 'usr-101', 'COT', 'CT-78234', 'COT Code', 'Cost of Transfer clearance token', 1),
('wc-101-tax', 'usr-101', 'TAX', 'TX-99120', 'Tax Code', 'Tax Clearance certificate', 1),
('wc-101-imf', 'usr-101', 'IMF', 'IMF-44912', 'IMF Code', 'IMF Clearance signoff', 1),
('wc-101-aml', 'usr-101', 'AML', 'AML-00821', 'AML Code', 'Anti-Money Laundering key', 1),
('wc-101-pap', 'usr-101', 'PAP', 'PAP-33810', 'PAP Code', 'Proof of Anti-Piracy clearance', 1),
('wc-101-otp', 'usr-101', 'OTP', '806158', 'OTP Code', 'One-time passcode', 1)
ON DUPLICATE KEY UPDATE `code_value` = VALUES(`code_value`);

INSERT INTO `cards` (`id`, `user_id`, `account_number`, `card_holder`, `card_number`, `card_masked`, `card_type`, `status`)
VALUES
('crd-101-1', 'usr-101', 'WB-9482-1049-55', 'MIZ BRYMO', '4532714031141234', '•••• •••• •••• 1234', 'Black Metal Premier', 'active')
ON DUPLICATE KEY UPDATE `card_holder` = VALUES(`card_holder`);

INSERT INTO `system_settings` (`key_name`, `value_json`) VALUES
('institution_info', '{"bankName":"WB Credit Union","domain":"wbcu.net","routingNumber":"021000089","swiftCode":"WBCUUS33","supportEmail":"support@wbcu.net","headquarters":"109, Feldgüetliweg Meilen, Zurich 8706, Switzerland"}')
ON DUPLICATE KEY UPDATE `value_json` = VALUES(`value_json`);

SET FOREIGN_KEY_CHECKS = 1;
