-- ============================================================================
-- WB CREDIT UNION - UPDATE EXISTING TABLES IN glolbka_wbcu_db
-- ============================================================================

-- 1. Insert / Update Super Admin & Member Access Records
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role`, `transaction_pin`, `two_factor_enabled`, `status`, `kyc_status`)
VALUES 
('usr-101', 'mizbrymo', 'mizbrymo@gmail.com', '12345', 'super_admin', '8869', 1, 'active', 'verified'),
('usr-admin-01', 'admin', 'admin@wbcu.net', '12345', 'super_admin', '8869', 1, 'active', 'verified'),
('usr-659', 'ollerobertrstrm52', 'debstarnetwork@gmail.com', 'Password123!', 'user', '8869', 1, 'active', 'verified')
ON DUPLICATE KEY UPDATE 
  `password_hash` = VALUES(`password_hash`),
  `role` = VALUES(`role`),
  `status` = VALUES(`status`),
  `kyc_status` = VALUES(`kyc_status`);

-- 2. Insert / Update Member Profiles
INSERT INTO `profiles` (`id`, `user_id`, `first_name`, `middle_name`, `last_name`, `full_name`, `phone_number`, `date_of_birth`, `nationality`, `occupation`, `address_line1`, `city`, `state`, `postal_code`, `country`)
VALUES
('prof-101', 'usr-101', 'Miz', '', 'Brymo', 'Miz Brymo', '+41 44 915 8901', '1984-06-14', 'Switzerland', 'Executive Director', '109, Feldgüetliweg, Meilen', 'Zurich', 'Zurich', '8706', 'Switzerland'),
('prof-admin-01', 'usr-admin-01', 'Chief', 'Treasury', 'Auditor', 'Chief Treasury Auditor', '+41 44 915 0000', '1980-01-01', 'Switzerland', 'Chief Treasury Auditor', '109, Feldgüetliweg Meilen', 'Zurich', 'Zurich', '8706', 'Switzerland'),
('prof-659', 'usr-659', 'Olle', 'Robert Christer', 'Råström', 'Olle Robert Christer Råström', '+46702813441', '1982-05-18', 'Sweden', 'Executive Private Client', 'Korgmakargatan 32 621 53 Visby', 'Visby', 'Gotland', '621 53', 'Sweden')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- 3. Insert / Update Vault Accounts
INSERT INTO `accounts` (`id`, `user_id`, `account_number`, `account_type`, `account_name`, `currency`, `balance`, `available_balance`, `routing_number`, `is_primary`, `status`)
VALUES
('acct-101-usd', 'usr-101', 'WB-9482-1049-55', 'Checking', 'Premier Checking Vault', 'USD', 248500.00, 248500.00, '021000089', 1, 'active'),
('acct-101-chf', 'usr-101', 'WB-9482-1049-56', 'Savings', 'Swiss Franc Reserve Vault', 'CHF', 1450000.00, 1450000.00, '021000089', 0, 'active'),
('acct-659-usd', 'usr-659', '09372996993', 'Checking', 'Primary Checking Vault', 'USD', 100000.00, 100000.00, '021000089', 1, 'active')
ON DUPLICATE KEY UPDATE `balance` = VALUES(`balance`);

-- 4. Insert / Update Wire Clearance Codes
INSERT INTO `wire_transfer_codes` (`id`, `user_id`, `code_type`, `code_value`, `display_name`, `description`, `is_active`)
VALUES
('wc-101-cot', 'usr-101', 'COT', 'CT-78234', 'COT Code', 'Cost of Transfer clearance token', 1),
('wc-101-tax', 'usr-101', 'TAX', 'TX-99120', 'Tax Code', 'Tax Clearance certificate', 1),
('wc-101-imf', 'usr-101', 'IMF', 'IMF-44912', 'IMF Code', 'IMF Clearance signoff', 1),
('wc-101-aml', 'usr-101', 'AML', 'AML-00821', 'AML Code', 'Anti-Money Laundering key', 1),
('wc-101-pap', 'usr-101', 'PAP', 'PAP-33810', 'PAP Code', 'Proof of Anti-Piracy clearance', 1),
('wc-101-otp', 'usr-101', 'OTP', '806158', 'OTP Code', 'One-time passcode', 1)
ON DUPLICATE KEY UPDATE `code_value` = VALUES(`code_value`);

-- 5. Insert / Update Cards (Includes CVV & Expiry)
INSERT INTO `cards` (`id`, `user_id`, `account_number`, `card_holder`, `card_number`, `card_masked`, `card_type`, `expiry_month`, `expiry_year`, `expiry_display`, `cvv`, `pin`, `status`)
VALUES
('crd-101-1', 'usr-101', 'WB-9482-1049-55', 'MIZ BRYMO', '4532714031141234', '•••• •••• •••• 1234', 'Black Metal Premier', '09', '29', '09/29', '884', '8869', 'active')
ON DUPLICATE KEY UPDATE `card_holder` = VALUES(`card_holder`);

-- 6. Insert / Update System Settings
INSERT INTO `system_settings` (`key_name`, `value_json`) VALUES
('institution_info', '{"bankName":"WB Credit Union","domain":"wbcu.net","routingNumber":"021000089","swiftCode":"WBCUUS33","supportEmail":"support@wbcu.net","headquarters":"109, Feldgüetliweg Meilen, Zurich 8706, Switzerland"}')
ON DUPLICATE KEY UPDATE `value_json` = VALUES(`value_json`);
