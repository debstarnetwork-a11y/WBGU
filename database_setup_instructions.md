# WB CREDIT UNION (www.wbcu.net) - CPANEL DATABASE SETUP GUIDE

This guide walks you through importing the complete SQL schema and database for **wbcu.net** onto your cPanel hosting using your exact database credentials.

---

## 📌 Your Database Credentials
- **cPanel Database**: `glolbka_wbcu_db`
- **cPanel Database User**: `glolbka_wbcu_user`
- **Host**: `localhost`
- **Target Domain**: `wbcu.net`

---

## 1. How to Save as a `.sql` File in Notepad

1. Open **Notepad** (or VS Code, Notepad++, Sublime Text).
2. Copy the entire SQL script from `cpanel_wbcu_database.sql`.
3. Paste it into Notepad.
4. Click **File** > **Save As...**
5. In the save dialog:
   - **File name:** `wbcu_database.sql`
   - **Save as type:** Select **All Files (*.*)** *(Important: do not leave it as "Text Documents (*.txt)")*
   - **Encoding:** Select **UTF-8**
6. Click **Save**.

---

## 2. Should you compress it into `.rar` or `.zip`?

❌ **NO, do NOT compress it to a `.rar` file.**
- phpMyAdmin **does not support `.rar`** files.
- You can upload the uncompressed **`.sql` file directly** (it is only ~21 KB and uploads instantly).
- *(Optional)* If your host restricts file sizes, only `.zip` or `.gzip` (`.sql.gz`) are supported, but for a 21 KB file, plain **`.sql`** is the standard, safest, and easiest format.

---

## 3. Step-by-Step phpMyAdmin Import

1. Log into your **cPanel** (`https://wbcu.net:2083` or your hosting portal).
2. In cPanel, scroll to the **Databases** section and click **phpMyAdmin**.
3. In the left-hand sidebar of phpMyAdmin, click on your database: **`glolbka_wbcu_db`**.
4. Click on the **Import** tab on the top horizontal navigation menu.
5. Under **File to import**:
   - Click **Choose File** (or **Browse**).
   - Select your saved `wbcu_database.sql` file.
6. Leave the Character set as **utf-8** / **utf8mb4** and Format as **SQL**.
7. Scroll down to the bottom and click **Import** (or **Go**).
8. You will see a green success banner:
   > *"Import has been successfully finished, queries executed."*

---

## 4. Database Tables Created

| Table Name | Description |
|---|---|
| `users` | Member credentials, access roles, 4-digit security PINs, KYC & status |
| `profiles` | Full legal identity, Swiss/international addresses, and KYC documents |
| `accounts` | Multi-currency bank vaults (USD, CHF, EUR, GBP, CAD, AUD, JPY, NGN) |
| `transactions` | Complete double-entry transfer, wire, credit, and settlement ledgers |
| `wire_transfer_codes` | Dynamic COT, TAX, IMF, AML, PAP, and 2FA clearance keys |
| `cards` | Sovereign Visa / Mastercard debit & credit cards with dynamic themes |
| `crypto_wallets` | Air-gapped cryptocurrency vaults (BTC, ETH, USDT, SOL) |
| `crypto_transactions` | On-chain hashes, network gas fees, and broadcast logs |
| `email_logs` | Automated dispatch logs for transactions, COT codes, and alerts |
| `activity_logs` | Real-time security, IP tracking, and audit trails |
| `support_tickets` | Member care tickets and inquiry categorization |
| `support_ticket_messages` | Bi-directional messaging between officers and members |
| `system_settings` | Core banking configurations, domain rails, and FX rates |

---

## 5. Web App Configuration (`.env` or Server Config)

When connecting your Node.js or PHP backend on cPanel:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=glolbka_wbcu_db
DB_USER=glolbka_wbcu_user
DB_PASSWORD=YOUR_CPANEL_DATABASE_PASSWORD
APP_DOMAIN=wbcu.net
SUPPORT_EMAIL=support@wbcu.net
---

## 6. Troubleshooting Common Errors

### ❌ Error: Unknown column 'profile_photo_url' in 'users'
If you see this error when trying to add the passport photo column, it's because you are targeting the wrong table. Profile photos and Passport photos are stored in the `profiles` table, not the `users` table.

**✅ Correct SQL Fix:**
```sql
ALTER TABLE profiles ADD COLUMN passport_photo_url LONGTEXT NULL AFTER profile_photo_url;
```

### ❌ User Management Board is Empty
1. **Clear Browser Cache:** The admin dashboard uses aggressive caching. Press `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac) to force a fresh load.
2. **Check Database Connection:** Ensure your database credentials in `api/admin-users.php` are correct. If the database is offline, the system will fallback to `admin-users.json`.
3. **Storage Quota:** If you have over 1,000 members, the local storage might be full. We have updated the code to handle large user bases, so ensure you have the latest `js/admin-users.js`.

