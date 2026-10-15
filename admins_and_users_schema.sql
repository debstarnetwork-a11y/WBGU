-- ============================================================================
-- WB CREDIT UNION - COMPLETE DATABASE SCHEMA WITH SEPARATE ADMINS TABLE
-- Database: glolbka_wbcu_db
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. SEPARATE ADMINS TABLE (For Super Admin, Chief Auditors, System Officers)
CREATE TABLE IF NOT EXISTS `admins` (
  `id` varchar(64) NOT NULL,
  `username` varchar(100) NOT NULL UNIQUE,
  `email` varchar(255) NOT NULL UNIQUE,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(255) DEFAULT 'Chief Treasury Auditor',
  `role` enum('admin','super_admin','auditor') NOT NULL DEFAULT 'super_admin',
  `status` enum('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial Super Admin Account
INSERT INTO `admins` (`id`, `username`, `email`, `password_hash`, `full_name`, `role`, `status`)
VALUES ('adm-001', 'admin', 'admin@wbcu.net', '$2y$10$e8N8yQ1jG8G6k5O/Zf5O..8x2X5Q8V2B5G8H2J8K2L2M2N2O2P2Q2', 'Chief Treasury Auditor', 'super_admin', 'active')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `role` = VALUES(`role`);


-- 2. USERS TABLE (For Bank Members / Account Holders)
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(64) NOT NULL,
  `username` varchar(100) NOT NULL UNIQUE,
  `email` varchar(255) NOT NULL UNIQUE,
  `password_hash` varchar(255) DEFAULT '12345',
  `role` enum('user','admin','super_admin','auditor') NOT NULL DEFAULT 'user',
  `transaction_pin` varchar(10) DEFAULT '1234',
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `two_factor_secret` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive','suspended','frozen','pending_approval') NOT NULL DEFAULT 'active',
  `status_reason` text DEFAULT NULL,
  `kyc_status` enum('unverified','pending','verified','rejected') NOT NULL DEFAULT 'verified',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL UNIQUE,
  `first_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` varchar(20) DEFAULT 'Not Specified',
  `nationality` varchar(100) DEFAULT 'Switzerland',
  `occupation` varchar(150) DEFAULT 'Executive Private Client',
  `address_line1` text DEFAULT NULL,
  `address_line2` text DEFAULT NULL,
  `city` varchar(100) DEFAULT 'Zurich',
  `state` varchar(100) DEFAULT 'Zurich',
  `postal_code` varchar(30) DEFAULT '8706',
  `country` varchar(100) DEFAULT 'Switzerland',
  `profile_photo_url` text DEFAULT NULL,
  `passport_photo_url` longtext DEFAULT NULL,
  `avatar_color` varchar(100) DEFAULT 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
  `id_type` varchar(50) DEFAULT 'Passport',
  `id_number` varchar(100) DEFAULT NULL,
  `id_card_front_url` text DEFAULT NULL,
  `id_card_back_url` text DEFAULT NULL,
  `proof_of_address_url` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 4. ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `account_number` varchar(30) NOT NULL UNIQUE,
  `account_type` enum('Checking','Savings','Business','Offshore','Fixed Deposit','Money Market') NOT NULL DEFAULT 'Checking',
  `account_name` varchar(100) DEFAULT 'Primary Vault',
  `currency` varchar(10) NOT NULL DEFAULT 'USD',
  `balance` decimal(20,2) NOT NULL DEFAULT 0.00,
  `available_balance` decimal(20,2) NOT NULL DEFAULT 0.00,
  `routing_number` varchar(20) DEFAULT '021000089',
  `swift_bic` varchar(20) DEFAULT 'WBCUUS33',
  `status` enum('active','inactive','frozen','closed','dormant') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 5. WIRE TRANSFER CODES TABLE
CREATE TABLE IF NOT EXISTS `wire_transfer_codes` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `code_type` enum('COT','TAX','IMF','AML','PAP','OTP') NOT NULL,
  `code_value` varchar(50) NOT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_code` (`user_id`,`code_type`),
  CONSTRAINT `fk_wire_codes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 6. CARDS TABLE
CREATE TABLE IF NOT EXISTS `cards` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `card_holder` varchar(150) NOT NULL,
  `card_number` varchar(30) NOT NULL,
  `card_masked` varchar(30) DEFAULT '•••• •••• •••• 1234',
  `card_type` varchar(50) DEFAULT 'Visa Platinum Debit',
  `expiry_display` varchar(10) DEFAULT '09/31',
  `cvv` varchar(10) DEFAULT '775',
  `pin` varchar(10) DEFAULT '1234',
  `status` enum('active','inactive','frozen','blocked') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_cards_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
