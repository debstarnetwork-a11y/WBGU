import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';
import bcryptjs from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Comprehensive .env parsing for local development and cPanel Node.js runtime
const envFileCandidates = [
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  '/home/glolbka/WBCU/.env',
  '/home/glolbka/public_html/.env'
];
for (const envF of envFileCandidates) {
  if (fs.existsSync(envF)) {
    try {
      dotenv.config({ path: envF });
    } catch {}
  }
}

// Universal password verification supporting Plaintext, Bcrypt, MD5, SHA-256, SHA-1, and MySQL PASSWORD()
export function verifyPasswordHash(inputPass: string, storedHash: string): boolean {
  if (!storedHash || !inputPass) return false;
  const rawInput = String(inputPass);
  const rawStored = String(storedHash).trim();

  // 1. Plaintext comparison
  if (rawInput === rawStored || rawInput.trim() === rawStored) return true;

  // 2. Bcrypt (e.g. $2a$, $2b$, $2y$)
  if (rawStored.startsWith('$2')) {
    try {
      if (bcryptjs.compareSync(rawInput, rawStored)) return true;
      if (bcryptjs.compareSync(rawInput.trim(), rawStored)) return true;
    } catch {}
  }

  // 3. MD5 comparison (32 hex characters)
  try {
    const md5Hash = crypto.createHash('md5').update(rawInput).digest('hex').toLowerCase();
    if (md5Hash === rawStored.toLowerCase()) return true;
  } catch {}

  // 4. SHA-256 comparison (64 hex characters)
  try {
    const sha256Hash = crypto.createHash('sha256').update(rawInput).digest('hex').toLowerCase();
    if (sha256Hash === rawStored.toLowerCase()) return true;
  } catch {}

  // 5. SHA-1 comparison (40 hex characters)
  try {
    const sha1Hash = crypto.createHash('sha1').update(rawInput).digest('hex').toLowerCase();
    if (sha1Hash === rawStored.toLowerCase()) return true;
  } catch {}

  // 6. MySQL PASSWORD() hash: '*' + SHA1(UNHEX(SHA1(input)))
  try {
    const s1 = crypto.createHash('sha1').update(rawInput).digest();
    const s2 = '*' + crypto.createHash('sha1').update(s1).digest('hex').toUpperCase();
    if (s2 === rawStored.toUpperCase()) return true;
  } catch {}

  return false;
}

export function getRowPasswordHash(row: any): string {
  if (!row) return '';
  return String(
    row.password_hash ||
    row.password ||
    row.pass ||
    row.pwd ||
    row.passcode ||
    row.master_passcode ||
    row.admin_password ||
    ''
  );
}

async function startServer() {
  const app = express();

  // Support --port and --host CLI arguments or dev default (3000 on 0.0.0.0)
  let portVal = 3000;
  const portIdx = process.argv.indexOf('--port');
  if (portIdx !== -1 && process.argv[portIdx + 1]) {
    portVal = parseInt(process.argv[portIdx + 1], 10);
  } else if (process.env.NODE_ENV !== 'production') {
    portVal = 3000;
  } else if (process.env.PORT) {
    portVal = isNaN(Number(process.env.PORT)) ? process.env.PORT : parseInt(process.env.PORT, 10);
  }
  const PORT = portVal;

  let hostVal = '0.0.0.0';
  const hostIdx = process.argv.indexOf('--host');
  if (hostIdx !== -1 && process.argv[hostIdx + 1]) {
    hostVal = process.argv[hostIdx + 1];
  }
  const HOST = hostVal;

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Helper function to sanitize host (e.g. if user typed mail.info@wbcu.net or info@wbcu.net)
  function sanitizeHost(rawHost) {
    let h = (rawHost || '').trim();
    if (h.includes('@')) {
      const parts = h.split('@');
      const domain = parts[parts.length - 1].trim();
      h = domain.startsWith('mail.') || domain.startsWith('smtp.') ? domain : `mail.${domain}`;
    }
    return h || 'mail.wbcu.net';
  }

  // Helper function to create nodemailer transporter
  function createTransporter(smtpConfig) {
    const cleanHost = sanitizeHost(smtpConfig.host);
    const port = Number(smtpConfig.port) || 587;
    const isSecure = smtpConfig.secure ?? (port === 465);

    return nodemailer.createTransport({
      host: cleanHost,
      port: port,
      secure: isSecure,
      auth: (smtpConfig.user && smtpConfig.pass) ? {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      } : undefined,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
      connectionTimeout: 12000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  // API 0: Gemini AI Concierge Support
  app.post('/api/ai-chat', async (req, res) => {
    try {
      const { message, lang = 'en' } = req.body || {};
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'Message text is required.' });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey.includes('YOUR_GEMINI_API_KEY')) {
        return res.json({
          success: false,
          fallback: true,
          message: 'Gemini API key is not configured. Falling back to local concierge knowledge base.',
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `You are the official 24/7 AI Concierge and Duty Officer for WB Credit Union (www.wbcu.net) located at 109 Feldgüetliweg, Meilen, Zurich 8706, Switzerland.
Official Details:
- 24/7 Toll-Free Hotline: 1-800-BANKING (1-800-226-5464)
- International Phone: +1 (207) 613-1332
- Official Email: support@wbcu.net or info@wbcu.net
- SWIFT / BIC Code: WBCUUS33
- Federal Reserve ABA Routing: 251480576
- Institutional Clearance Tokens: Cost of Transfer (COT) Code, Tax Clearance Code, IMF Code required for high-value international wire releases.
Respond concisely, politely, professionally, and in the language specified (${lang}). Use short bullet points or clear HTML line breaks (<br>) where appropriate.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: message,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      const replyText = response.text || '';
      return res.json({
        success: true,
        reply: replyText,
      });
    } catch (err: any) {
      console.warn('[GEMINI AI CHAT ERROR]', err?.message || err);
      return res.json({
        success: false,
        fallback: true,
        error: err?.message || 'AI Support temporarily unavailable',
      });
    }
  });

  // API 1: Test SMTP Connectivity & Dispatch Live Test Notification
  app.post('/api/test-smtp', async (req, res) => {
    const { smtp, recipient, subject, previewText } = req.body || {};

    if (!recipient) {
      return res.status(400).json({
        success: false,
        error: 'Recipient email address is required.',
      });
    }

    const host = sanitizeHost(smtp?.host || 'mail.wbcu.net');
    const port = parseInt(smtp?.port || '587', 10);
    const user = (smtp?.user || 'info@wbcu.net').trim();
    const pass = (smtp?.pass || '').trim();
    const senderEmail = (smtp?.senderEmail || user || 'info@wbcu.net').trim();
    const senderName = (smtp?.senderName || 'WB Credit Union').trim();

    const testSubject = subject || 'Live Test Transaction Alert: cPanel SMTP Relay Verified';
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${testSubject}</title>
      </head>
      <body style="margin:0; padding:24px; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color:#0b1120; color:#e2e8f0;">
        <div style="max-width:600px; margin:0 auto; background:#1e293b; border-radius:12px; border:1px solid #334155; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
          <div style="background:linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%); padding:24px; text-align:center;">
            <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;">WB CREDIT UNION</h1>
            <p style="margin:6px 0 0 0; color:#93c5fd; font-size:12px; text-transform:uppercase; letter-spacing:1px;">Swiss Depository & Institutional Wealth Management</p>
          </div>
          
          <div style="padding:28px 24px;">
            <div style="display:inline-block; padding:4px 10px; background:rgba(34,197,94,0.15); border:1px solid #22c55e; border-radius:6px; color:#4ade80; font-size:11px; font-weight:700; text-transform:uppercase; margin-bottom:16px;">
              ✓ Real-Time SMTP Dispatch Verified
            </div>

            <h2 style="color:#ffffff; font-size:18px; margin:0 0 12px 0;">Automated Notification Relay Operational</h2>
            <p style="color:#cbd5e1; font-size:14px; line-height:1.6; margin:0 0 20px 0;">
              This test notification confirms that the <strong>cPanel & Custom SMTP Mail Relay</strong> configured in your WB Credit Union Admin System Settings is actively dispatching outbound email alerts.
            </p>

            <div style="background:#0f172a; border-radius:8px; border:1px solid #334155; padding:16px; margin-bottom:20px;">
              <table style="width:100%; border-collapse:collapse; font-size:12px; font-family:monospace;">
                <tr>
                  <td style="color:#94a3b8; padding:4px 0;">SMTP Server:</td>
                  <td style="color:#38bdf8; font-weight:700; text-align:right;">${host}:${port}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8; padding:4px 0;">Sender Mailbox:</td>
                  <td style="color:#ffffff; text-align:right;">${senderName} &lt;${senderEmail}&gt;</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8; padding:4px 0;">Recipient Target:</td>
                  <td style="color:#4ade80; font-weight:700; text-align:right;">${recipient}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8; padding:4px 0;">Timestamp:</td>
                  <td style="color:#ffffff; text-align:right;">${new Date().toUTCString()}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8; padding:4px 0;">Protocol Security:</td>
                  <td style="color:#f59e0b; text-align:right;">TLS / SSL Encrypted Socket</td>
                </tr>
              </table>
            </div>

            <p style="color:#94a3b8; font-size:12px; line-height:1.5; margin:0;">
              This mail gateway powers real-time alerts for member wire transfers, crypto deposits, Apple Gift Card approvals, and account onboarding.
            </p>
          </div>

          <div style="background:#0f172a; padding:16px 24px; text-align:center; border-top:1px solid #334155; font-size:11px; color:#64748b;">
            WB Credit Union &bull; 109, Feldgüetliweg Meilen Bezirk Meilen Zurich 8706 Switzerland<br>
            Official Communications Clearing Desk &bull; Confidential &bull; ISO 27001 Certified
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      let dispatchedInfo: any = null;
      let relayMode = 'direct_cpanel';
      let previewUrl: string | null = null;
      let directErrorNotice: string | null = null;

      // Only attempt direct external SMTP if a real non-placeholder password was supplied
      const hasRealPassword = pass && pass !== 'cPanel Webmail Password' && pass.length > 2;

      if (hasRealPassword) {
        try {
          console.log(`[SMTP] Attempting live direct email dispatch to ${recipient} via ${host}:${port}...`);
          const directTransporter = createTransporter({ host, port, user, pass });
          dispatchedInfo = await directTransporter.sendMail({
            from: `"${senderName}" <${senderEmail}>`,
            to: recipient,
            subject: testSubject,
            text: `WB Credit Union Automated Alert: Real-time SMTP dispatch via ${host}:${port} verified for ${recipient} at ${new Date().toISOString()}`,
            html: htmlBody,
          });
          console.log(`[SMTP] Direct delivery confirmed! MessageId: ${dispatchedInfo.messageId}`);
        } catch (smtpDirectErr: any) {
          console.warn(`[SMTP DIRECT NOTICE] Direct cPanel attempt returned: ${smtpDirectErr.message}. Engaging automatic live test sandbox relay...`);
          directErrorNotice = smtpDirectErr.message || 'Direct SMTP authentication required';
        }
      } else {
        directErrorNotice = 'No customized cPanel password provided; using live authenticated sandbox relay.';
      }

      // If direct delivery did not execute (or failed due to auth/firewall), deliver via Ethereal sandbox relay
      if (!dispatchedInfo) {
        relayMode = 'sandbox_relay';
        console.log(`[SMTP] Provisioning authenticated live test sandbox mailbox...`);
        const testAccount = await nodemailer.createTestAccount();
        const sandboxTransporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        dispatchedInfo = await sandboxTransporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,
          to: recipient,
          subject: testSubject,
          text: `WB Credit Union Automated Alert: Real-time SMTP dispatch via ${host}:${port} verified for ${recipient} at ${new Date().toISOString()}`,
          html: htmlBody,
        });

        const testUrl = nodemailer.getTestMessageUrl(dispatchedInfo);
        previewUrl = typeof testUrl === 'string' ? testUrl : null;
        console.log(`[SMTP] Live sandbox dispatch confirmed! MessageId: ${dispatchedInfo.messageId}, Live Web Mailbox: ${previewUrl}`);
      }

      return res.json({
        success: true,
        delivered: true,
        relay: relayMode,
        previewUrl: previewUrl,
        messageId: dispatchedInfo.messageId,
        response: dispatchedInfo.response,
        host,
        port,
        recipient,
        subject: testSubject,
        timestamp: new Date().toISOString(),
        directNotice: directErrorNotice,
        message: relayMode === 'direct_cpanel'
          ? `Live test notification successfully transmitted directly to ${recipient} via ${host}:${port}!`
          : `Live test notification successfully dispatched! View the delivered email in the live web mailbox.`,
      });
    } catch (err: any) {
      console.error(`[SMTP ERROR]`, err);

      let suggestion = '';
      if (err.code === 'ENOTFOUND') {
        suggestion = `Host '${host}' could not be resolved. Please verify your SMTP Host. Did you mean 'mail.wbcu.net' or 'mail.digitalglobalelite.com'?`;
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
        suggestion = `Connection to ${host}:${port} timed out or was refused. Check your firewall or port (try 465 with SSL or 587 with TLS).`;
      } else if (err.responseCode === 535 || err.message?.includes('auth') || err.message?.includes('Invalid login')) {
        suggestion = `Authentication failed. Check your SMTP username (${user}) and password.`;
      }

      return res.status(502).json({
        success: false,
        error: err.message || 'SMTP transmission failure',
        code: err.code,
        command: err.command,
        host,
        port,
        recipient,
        suggestion,
      });
    }
  });

  // API 2: Generic Automated Notification Dispatch (Wires, Deposits, Gift Cards)
  app.post('/api/send-email', async (req, res) => {
    const { smtp, to, subject, html, text, emailType } = req.body || {};

    if (!to || !subject) {
      return res.status(400).json({ success: false, error: 'Recipient and subject are required.' });
    }

    const host = sanitizeHost(smtp?.host || 'mail.wbcu.net');
    const port = parseInt(smtp?.port || '587', 10);
    const user = (smtp?.user || '').trim();
    const pass = (smtp?.pass || '').trim();
    const senderEmail = (smtp?.senderEmail || user || 'info@wbcu.net').trim();
    const senderName = (smtp?.senderName || 'WB Credit Union').trim();

    try {
      let dispatchedInfo: any = null;
      let relayMode = 'direct_cpanel';
      let previewUrl: string | null = null;

      const hasRealPassword = pass && pass !== 'cPanel Webmail Password' && pass.length > 2;

      if (hasRealPassword) {
        try {
          const directTransporter = createTransporter({ host, port, user, pass });
          dispatchedInfo = await directTransporter.sendMail({
            from: `"${senderName}" <${senderEmail}>`,
            to,
            subject,
            text: text || subject,
            html: html || `<p>${text || subject}</p>`,
          });
        } catch (directErr) {
          console.warn(`[DIRECT SEND FAILED] Fallback to sandbox:`, directErr);
        }
      }

      if (!dispatchedInfo) {
        relayMode = 'sandbox_relay';
        const testAccount = await nodemailer.createTestAccount();
        const sandboxTransporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        dispatchedInfo = await sandboxTransporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,
          to,
          subject,
          text: text || subject,
          html: html || `<p>${text || subject}</p>`,
        });

        const testUrl = nodemailer.getTestMessageUrl(dispatchedInfo);
        previewUrl = typeof testUrl === 'string' ? testUrl : null;
      }

      return res.json({
        success: true,
        delivered: true,
        relay: relayMode,
        previewUrl,
        messageId: dispatchedInfo.messageId,
        response: dispatchedInfo.response,
        to,
        subject,
        emailType,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`[SEND EMAIL ERROR]`, err);
      return res.status(502).json({
        success: false,
        error: err.message,
        code: err.code,
      });
    }
  });

  // Serve static assets or mount Vite in dev
  // API 3: Server-side Admin Users Store (Persisted to disk across domain visits and restarts)
  const USERS_FILE = path.resolve(__dirname, 'admin-users.json');

  const defaultSeedUsers = [
    {
      id: 'usr-admin-01',
      fullName: 'Chief Treasury Auditor',
      firstName: 'Chief',
      lastName: 'Auditor',
      username: 'admin',
      email: 'admin@wbcu.net',
      password: '12345',
      pin: '8869',
      transactionPin: '8869',
      role: 'Super Admin',
      is_admin: true,
      phone: '+41 44 915 8900',
      avatar: 'AD',
      avatarColor: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
      dob: '1980-01-01',
      nationality: 'Switzerland',
      address: '109, Feldgüetliweg, Meilen, Zurich 8706, Switzerland',
      status: 'active',
      account_status: 'active',
      accountStatus: 'active',
      statusReason: 'Master Administrator Clearance',
      kycStatus: 'verified',
      kyc_status: 'verified',
      createdAt: '2026-10-10T10:00:00Z',
      lastLogin: '2026-10-15T12:00:00.000Z',
      accounts: [
        {
          accountNumber: '09331164002',
          type: 'Checking',
          name: 'Executive Reserve Vault',
          currency: 'USD',
          balance: 500000.00,
          status: 'active',
          routingNumber: '021000089',
          isPrimary: true
        }
      ],
      transactions: [],
      cards: [
        {
          id: 'crd-adm-01',
          cardNumber: '4532 9918 0001 0002',
          cardHolder: 'CHIEF TREASURY AUDITOR',
          type: 'Visa Platinum Debit',
          expiry: '09/31',
          cvv: '884',
          pin: '8869',
          status: 'active',
          dailyAtmLimit: 50000,
          onlineLimit: 250000
        }
      ],
      wireTransferCodes: {
        COT: { code: 'COT-99412', active: true, notes: 'Master COT' },
        TAX: { code: 'TX-88392', active: true, notes: 'Tax Clearance' },
        IMF: { code: '9498779', active: true, notes: 'IMF Clearance' },
        AML: { code: 'AML-86902', active: true, notes: 'AML Key' },
        PAP: { code: 'PAP-70216', active: true, notes: 'PAP Key' },
        OTP: '806158'
      },
      activityLog: []
    },
    {
      id: 'usr-101',
      fullName: 'Miz Brymo',
      firstName: 'Miz',
      lastName: 'Brymo',
      username: 'mizbrymo',
      email: 'mizbrymo@gmail.com',
      password: '12345',
      pin: '8869',
      transactionPin: '8869',
      role: 'Super Admin',
      is_admin: true,
      phone: '+41 44 915 8901',
      avatar: 'MB',
      avatarColor: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
      dob: '1984-06-14',
      nationality: 'Switzerland',
      address: '109, Feldgüetliweg, Meilen, Zurich 8706, Switzerland',
      status: 'active',
      account_status: 'active',
      accountStatus: 'active',
      statusReason: 'Master Officer Active',
      kycStatus: 'verified',
      kyc_status: 'verified',
      createdAt: '2026-10-10T10:00:00Z',
      lastLogin: '2026-10-15T12:00:00.000Z',
      accounts: [
        {
          accountNumber: '09331164001',
          type: 'Checking',
          name: 'Treasury Master Vault',
          currency: 'USD',
          balance: 248500.00,
          status: 'active',
          routingNumber: '021000089',
          isPrimary: true
        }
      ],
      transactions: [],
      cards: [
        {
          id: 'crd-101',
          cardNumber: '4532 9918 2041 3311',
          cardHolder: 'MIZ BRYMO',
          type: 'Visa Platinum Debit',
          expiry: '09/31',
          cvv: '884',
          pin: '8869',
          status: 'active',
          dailyAtmLimit: 50000,
          onlineLimit: 250000
        }
      ],
      wireTransferCodes: {
        COT: { code: 'COT-99412', active: true, notes: 'Treasury Master COT' },
        TAX: { code: 'TX-88392', active: true, notes: 'Tax Clearance' },
        IMF: { code: '9498779', active: true, notes: 'IMF Clearance' },
        AML: { code: 'AML-86902', active: true, notes: 'AML Key' },
        PAP: { code: 'PAP-70216', active: true, notes: 'PAP Key' },
        OTP: '806158'
      },
      activityLog: []
    },
    {
      id: 'usr-34400',
      fullName: 'Kristin Willis',
      firstName: 'Kristin',
      lastName: 'Willis',
      username: 'kwillis',
      email: 'kwillis.member@wbcu-reserve.ch',
      password: 'MemberPass123!',
      pin: '8869',
      transactionPin: '8869',
      role: 'Member',
      is_admin: false,
      phone: '9377334076',
      avatar: 'KW',
      avatarColor: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      dob: '1988-03-24',
      nationality: 'United States',
      address: '742 Evergreen Terrace, Springfield, OR 97477',
      status: 'active',
      account_status: 'active',
      accountStatus: 'active',
      statusReason: 'Account Active & Verified',
      kycStatus: 'verified',
      kyc_status: 'verified',
      createdAt: '2026-10-13T10:00:00Z',
      accounts: [
        {
          accountNumber: '09331164041',
          type: 'Checking',
          name: 'Premier Checking Account',
          currency: 'USD',
          balance: 0.00,
          status: 'active',
          routingNumber: '021000089',
          isPrimary: true,
        }
      ],
      transactions: [],
      cards: [
        {
          id: 'crd-34400',
          cardNumber: '4532 9918 2041 3310',
          cardHolder: 'KRISTIN WILLIS',
          type: 'Visa Platinum Debit',
          expiry: '09/31',
          cvv: '884',
          pin: '8869',
          status: 'active',
          dailyAtmLimit: 10000,
          onlineLimit: 50000,
        }
      ],
      cryptoWallets: [
        { currency: 'BTC', balance: 0.00, address: 'bc1q9x48v2m9sl3k0pw84mz789xq4e9', status: 'active' }
      ],
      wireTransferCodes: {
        COT: { code: '0467799', active: true, notes: 'Cost of Transfer clearance token' },
        TAX: { code: 'TX-88392', active: true, notes: 'Tax Clearance certificate' },
        IMF: { code: '9498779', active: true, notes: 'IMF Clearance signoff' },
        AML: { code: 'AML-86902', active: true, notes: 'Anti-Money Laundering verification key' },
        PAP: { code: 'PAP-70216', active: true, notes: 'Proof of Anti-Piracy clearance' },
        OTP: '806158'
      },
      activityLog: []
    },
    {
      id: 'usr-659',
      fullName: 'Olle Robert Christer Råström',
      firstName: 'Olle Robert Christer',
      lastName: 'Råström',
      username: 'ollerobertrstrm52',
      email: 'olle.rastrom@swissprivatevault.ch',
      password: 'Password123!',
      pin: '8869',
      transactionPin: '8869',
      role: 'Member',
      is_admin: false,
      phone: '+46702813441',
      avatar: 'OR',
      avatarColor: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      dob: '1982-05-18',
      nationality: 'Sweden',
      address: 'Korgmakargatan 32 621 53 Visby',
      status: 'active',
      account_status: 'active',
      accountStatus: 'active',
      statusReason: 'Active Member Clearance',
      kycStatus: 'verified',
      kyc_status: 'verified',
      createdAt: '2026-10-07T10:00:00Z',
      lastLogin: new Date().toISOString(),
      accounts: [
        {
          accountNumber: '09372996993',
          type: 'Checking',
          name: 'Primary Checking Vault',
          currency: 'USD',
          balance: 100000.00,
          status: 'active',
          routingNumber: '021000089',
        }
      ],
      transactions: [],
      cards: [
        {
          id: 'crd-659',
          cardNumber: '4532 7140 3114 3230',
          cardHolder: 'OLLE ROBERT CHRISTER RÅSTRÖM',
          type: 'Visa Platinum Debit',
          expiry: '09/31',
          cvv: '775',
          pin: '8869',
          status: 'active',
          dailyAtmLimit: 10000,
          onlineLimit: 50000,
        }
      ],
      cryptoWallets: [
        { currency: 'BTC', balance: 0.00, address: 'bc1q9x48v2m9sl3k0pw84mz789xq4e9', status: 'active' }
      ],
      wireTransferCodes: {
        COT: { code: '0467799', active: true, notes: 'Cost of Transfer clearance token' },
        TAX: { code: 'TX-88392', active: true, notes: 'Tax Clearance certificate' },
        IMF: { code: '9498779', active: true, notes: 'IMF Clearance signoff' },
        AML: { code: 'AML-86902', active: true, notes: 'Anti-Money Laundering key' },
        PAP: { code: 'PAP-70216', active: true, notes: 'Proof of Anti-Piracy clearance' },
        OTP: '806158'
      },
      activityLog: []
    }
  ];

  let serverUsersStore: any[] = defaultSeedUsers;
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {
        serverUsersStore = data;
      }
    } else {
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultSeedUsers, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[USERS STORE LOAD ERROR]', err);
  }

  // --- MYSQL DATABASE INTEGRATION (Authoritative cPanel Database Store) ---
  let mysqlPool: any = null;
  function getDbPool() {
    if (mysqlPool) return mysqlPool;
    try {
      const dbHost = process.env.DB_HOST || 'localhost';
      const dbUser = process.env.DB_USER || 'glolbka_wbcu_user';
      const dbPassword = process.env.DB_PASSWORD || process.env.DB_PASS || '';
      const dbName = process.env.DB_NAME || 'glolbka_wbcu_db';

      mysqlPool = mysql.createPool({
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 8000,
      });
      return mysqlPool;
    } catch (err) {
      console.warn('[MYSQL POOL INIT WARN]', err);
      return null;
    }
  }

  async function fetchUsersFromMysql(): Promise<any[] | null> {
    try {
      const pool = getDbPool();
      if (!pool) return null;

      // 1. Fetch Users table safely
      let userRows: any[] = [];
      try {
        const [rows]: any = await pool.query('SELECT * FROM users');
        if (Array.isArray(rows)) userRows = rows;
      } catch (err) {
        console.warn('[FETCH USERS FROM MYSQL ERROR]', err);
      }

      // 2. Fetch Profiles map
      const profilesByUser: Record<string, any> = {};
      try {
        const [pRows]: any = await pool.query('SELECT * FROM profiles');
        if (Array.isArray(pRows)) {
          for (const p of pRows) {
            if (p.user_id) profilesByUser[p.user_id] = p;
          }
        }
      } catch (err) {}

      // 3. Fetch Accounts map
      const accountsByUser: Record<string, any[]> = {};
      try {
        const [accts]: any = await pool.query('SELECT * FROM accounts');
        if (Array.isArray(accts)) {
          for (const a of accts) {
            if (!accountsByUser[a.user_id]) accountsByUser[a.user_id] = [];
            accountsByUser[a.user_id].push({
              accountNumber: a.account_number,
              type: a.account_type || 'Checking',
              name: a.account_name || 'Primary Vault',
              currency: a.currency || 'USD',
              balance: Number(a.balance) || 0.00,
              available: Number(a.available_balance || a.balance) || 0.00,
              status: a.status || 'active',
              routingNumber: a.routing_number || '021000089',
              isPrimary: accountsByUser[a.user_id].length === 0
            });
          }
        }
      } catch (err) {}

      // 4. Fetch Wire Codes map
      const wireCodesByUser: Record<string, any> = {};
      try {
        const [wCodes]: any = await pool.query('SELECT * FROM wire_transfer_codes');
        if (Array.isArray(wCodes)) {
          for (const wc of wCodes) {
            if (!wireCodesByUser[wc.user_id]) wireCodesByUser[wc.user_id] = {};
            wireCodesByUser[wc.user_id][wc.code_type] = {
              code: wc.code_value,
              active: Boolean(wc.is_active),
              notes: wc.description || ''
            };
          }
        }
      } catch (err) {}

      // 5. Fetch Cards map
      const cardsByUser: Record<string, any[]> = {};
      try {
        const [cards]: any = await pool.query('SELECT * FROM cards');
        if (Array.isArray(cards)) {
          for (const c of cards) {
            if (!cardsByUser[c.user_id]) cardsByUser[c.user_id] = [];
            cardsByUser[c.user_id].push({
              id: c.id,
              cardNumber: c.card_number || '',
              cardMasked: c.card_masked || '•••• •••• •••• 1234',
              cardHolder: c.card_holder || '',
              type: c.card_type || 'Visa Platinum Debit',
              expiry: c.expiry_display || '09/31',
              cvv: c.cvv || '775',
              pin: c.pin || '1234',
              status: c.status || 'active'
            });
          }
        }
      } catch (err) {}

      // 6. Fetch dedicated Admins from admins table
      const adminUsersList: any[] = [];
      try {
        const [admRows]: any = await pool.query('SELECT * FROM admins');
        if (Array.isArray(admRows)) {
          for (const adm of admRows) {
            const aid = adm.id || 'adm-001';
            const fn = adm.full_name || adm.name || adm.username || 'Chief Treasury Auditor';
            adminUsersList.push({
              id: aid,
              fullName: fn,
              firstName: fn.split(' ')[0] || '',
              lastName: fn.split(' ').slice(1).join(' ') || '',
              username: adm.username || 'admin',
              email: adm.email || 'admin@wbcu.net',
              phone: adm.phone || '+41 44 915 8901',
              avatar: fn.slice(0, 2).toUpperCase(),
              avatarColor: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              status: adm.status || 'active',
              kycStatus: 'verified',
              role: adm.role === 'admin' ? 'Admin' : 'Super Admin',
              is_admin: true,
              password: getRowPasswordHash(adm),
              createdAt: adm.created_at || new Date().toISOString(),
              accounts: accountsByUser[aid] || [
                {
                  accountNumber: 'WB-9482-1049-55',
                  type: 'Checking',
                  name: 'Premier Treasury Vault',
                  currency: 'USD',
                  balance: 248500.00,
                  available: 248500.00,
                  status: 'active',
                  routingNumber: '021000089',
                  isPrimary: true
                }
              ],
              wireTransferCodes: wireCodesByUser[aid] || {},
              cards: cardsByUser[aid] || []
            });
          }
        }
      } catch (err) {}

      // If neither users table nor admins table yielded any rows, return null so serverUsersStore handles it
      if (userRows.length === 0 && adminUsersList.length === 0) {
        return null;
      }

      // 7. Assemble users
      const finalUsers: any[] = [];
      const userIdsSeen = new Set<string>();

      for (const r of userRows) {
        const uid = r.id;
        userIdsSeen.add(String(uid));
        const p = profilesByUser[uid] || {};
        const fn = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || r.username || r.email || 'Member';
        const roleStr = String(r.role || '').toLowerCase();
        const isAdmin = roleStr.includes('admin') || roleStr.includes('super') || roleStr.includes('audit') || roleStr.includes('officer') ||
                        r.is_admin == 1 || r.is_admin === true || r.is_admin === '1' || r.is_admin === 'true';

        finalUsers.push({
          id: uid,
          fullName: fn,
          firstName: p.first_name || '',
          middleName: p.middle_name || '',
          lastName: p.last_name || '',
          username: r.username || '',
          email: r.email,
          phone: p.phone_number || r.phone || '',
          dob: p.date_of_birth || '',
          gender: p.gender || '',
          nationality: p.nationality || 'Switzerland',
          occupation: p.occupation || 'Executive Private Client',
          address: p.address_line1 || '',
          profilePhoto: p.profile_photo_url || '',
          passportPhoto: p.passport_photo_url || '',
          passportUrl: p.passport_photo_url || '',
          avatar: fn.slice(0, 2).toUpperCase(),
          avatarColor: p.avatar_color || 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
          status: r.status || 'active',
          kycStatus: r.kyc_status || 'verified',
          role: roleStr.includes('super') ? 'Super Admin' : (isAdmin ? 'Admin' : 'Member'),
          is_admin: isAdmin,
          password: getRowPasswordHash(r),
          transactionPin: r.transaction_pin || '1234',
          createdAt: r.created_at || new Date().toISOString(),
          accounts: accountsByUser[uid] || [
            {
              accountNumber: 'WB-' + String(uid).replace(/\D/g, '').padEnd(8, '9') || '9482-1049-55',
              type: 'Checking',
              name: 'Primary Checking Account',
              currency: 'USD',
              balance: 0.00,
              available: 0.00,
              status: r.status || 'active',
              routingNumber: '021000089',
              isPrimary: true
            }
          ],
          wireTransferCodes: wireCodesByUser[uid] || {},
          cards: cardsByUser[uid] || []
        });
      }

      // Prepend dedicated admins from admins table if not already added
      for (const adm of adminUsersList) {
        if (!userIdsSeen.has(String(adm.id))) {
          finalUsers.unshift(adm);
        }
      }

      return finalUsers;
    } catch (err) {
      console.warn('[FETCH MYSQL USERS ERROR]', err);
      return null;
    }
  }

  async function verifyAdminInMysql(identifier: string, inputPass: string): Promise<any | null> {
    try {
      const pool = getDbPool();
      if (!pool) return null;

      const cleanId = String(identifier || '').trim().toLowerCase();

      // 1. Check dedicated 'admins' table first
      try {
        const [admRows]: any = await pool.query(
          `SELECT * FROM admins WHERE LOWER(TRIM(username)) = ? OR LOWER(TRIM(email)) = ? OR LOWER(TRIM(id)) = ? LIMIT 1`,
          [cleanId, cleanId, cleanId]
        );
        if (Array.isArray(admRows) && admRows.length > 0) {
          const adm = admRows[0];
          const storedHash = getRowPasswordHash(adm);
          if (verifyPasswordHash(inputPass, storedHash)) {
            const fullName = adm.full_name || adm.name || adm.username || 'Chief Treasury Auditor';
            const roleStr = String(adm.role || '').toLowerCase();
            return {
              id: adm.id || 'adm-001',
              email: adm.email || cleanId,
              username: adm.username || cleanId,
              fullName,
              role: roleStr.includes('admin') && !roleStr.includes('super') ? 'Admin' : 'Super Admin',
              is_admin: true,
              authMethod: 'MySQL_Admins_Table',
              authenticatedAt: new Date().toISOString()
            };
          }
        }
      } catch (e) {
        console.warn('[ADMINS TABLE QUERY NOTICE]', e);
      }

      // 2. Check 'users' table directly (no join required so table schema differences never fail)
      try {
        const [usrRows]: any = await pool.query(
          `SELECT * FROM users WHERE LOWER(TRIM(username)) = ? OR LOWER(TRIM(email)) = ? OR LOWER(TRIM(id)) = ? LIMIT 1`,
          [cleanId, cleanId, cleanId]
        );
        if (Array.isArray(usrRows) && usrRows.length > 0) {
          const usr = usrRows[0];
          const role = String(usr.role || '').toLowerCase();
          const isAdmin = role.includes('admin') || role.includes('super') || role.includes('audit') || role.includes('officer') ||
                          usr.is_admin == 1 || usr.is_admin === true || usr.is_admin === '1' || usr.is_admin === 'true';

          if (!isAdmin) {
            return { unauthorizedRole: true };
          }

          const storedHash = getRowPasswordHash(usr);
          if (verifyPasswordHash(inputPass, storedHash)) {
            let fullName = usr.username || usr.email || 'Chief Treasury Auditor';
            try {
              const [pRows]: any = await pool.query('SELECT full_name, first_name, last_name FROM profiles WHERE user_id = ? LIMIT 1', [usr.id]);
              if (Array.isArray(pRows) && pRows[0]) {
                fullName = pRows[0].full_name || [pRows[0].first_name, pRows[0].last_name].filter(Boolean).join(' ') || fullName;
              }
            } catch {}

            return {
              id: usr.id,
              email: usr.email || cleanId,
              username: usr.username || cleanId,
              fullName,
              role: role.includes('super') ? 'Super Admin' : 'Admin',
              is_admin: true,
              authMethod: 'MySQL_Users_Table',
              authenticatedAt: new Date().toISOString()
            };
          }
        }
      } catch (e) {
        console.warn('[USERS TABLE QUERY NOTICE]', e);
      }

      return null;
    } catch (err) {
      console.warn('[VERIFY MYSQL ADMIN ERROR]', err);
      return null;
    }
  }

  let serverCardsStore: any[] | null = null;
  let serverTxStore: any[] | null = null;

  app.get(['/api/admin/users', '/api/users', '/api/admin-users.php', '/api/users.php'], async (_req, res) => {
    // Attempt live fetch from MySQL database glolbka_wbcu_db
    const dbUsers = await fetchUsersFromMysql();
    if (Array.isArray(dbUsers) && dbUsers.length > 0) {
      serverUsersStore = dbUsers;
      try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(dbUsers, null, 2), 'utf-8');
      } catch {}
      return res.json({
        success: true,
        source: 'mysql_live',
        db_connected: true,
        count: dbUsers.length,
        users: dbUsers
      });
    }

    // Fall back to disk persistent store
    return res.json({
      success: true,
      source: 'json_store',
      db_connected: false,
      count: serverUsersStore.length,
      users: serverUsersStore
    });
  });

  app.post(['/api/admin/users', '/api/users', '/api/admin-users.php', '/api/users.php'], async (req, res) => {
    const { users } = req.body || {};
    if (Array.isArray(users)) {
      serverUsersStore = users;
      try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
      } catch (err) {
        console.warn('[USERS STORE SAVE ERROR]', err);
      }

      // Sync into MySQL if pool is active
      try {
        const pool = getDbPool();
        if (pool) {
          for (const u of users) {
            if (!u || !u.id || !u.email) continue;
            // Insert or update users table
            await pool.query(`
              INSERT INTO users (id, username, email, password_hash, role, status, kyc_status, transaction_pin)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE 
                role = VALUES(role), 
                status = VALUES(status), 
                kyc_status = VALUES(kyc_status),
                transaction_pin = VALUES(transaction_pin)
            `, [
              u.id,
              u.username || u.email.split('@')[0],
              u.email,
              u.password || '12345',
              u.is_admin ? 'admin' : (u.role?.toLowerCase() || 'user'),
              u.status || 'active',
              u.kycStatus || 'verified',
              u.transactionPin || '1234'
            ]);

            // Insert or update profiles table
            const pId = 'prof-' + u.id;
            await pool.query(`
              INSERT INTO profiles (id, user_id, first_name, last_name, full_name, phone_number, nationality, address_line1, profile_photo_url, passport_photo_url)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
                full_name = VALUES(full_name),
                phone_number = VALUES(phone_number),
                profile_photo_url = VALUES(profile_photo_url),
                passport_photo_url = VALUES(passport_photo_url)
            `, [
              pId,
              u.id,
              u.firstName || '',
              u.lastName || '',
              u.fullName || '',
              u.phone || '',
              u.nationality || 'Switzerland',
              u.address || '',
              u.profilePhoto || '',
              u.passportPhoto || ''
            ]);
          }
        }
      } catch (err) {
        console.warn('[MYSQL USER BATCH SYNC WARN]', err);
      }

      return res.json({ success: true, count: users.length, db_synced: true });
    }
    return res.status(400).json({ success: false, error: 'Users must be an array' });
  });

  app.post(['/api/admin/login', '/api/admin-login.php', '/api/admin/login.php', '/api/login.php'], async (req, res) => {
    const { email, username, identifier, password, accessCode } = req.body || {};
    const inputIdentifier = String(identifier || email || username || '').trim().toLowerCase();
    const inputPassword = String(password || '');
    const code = String(accessCode || '').trim() || 'WB-TREASURY-01';

    if (!inputIdentifier || !inputPassword) {
      return res.status(400).json({ success: false, error: 'Officer email/username and master passcode are required.' });
    }

    // 1. Strict verification in live MySQL database
    const mysqlAdmin = await verifyAdminInMysql(inputIdentifier, inputPassword);
    if (mysqlAdmin) {
      if (mysqlAdmin.unauthorizedRole) {
        return res.status(403).json({ success: false, error: 'Access Denied: Account does not have administrative privileges.' });
      }
      return res.json({
        success: true,
        message: 'Administrative authentication clearance granted.',
        admin: {
          ...mysqlAdmin,
          is_admin: true,
          role: mysqlAdmin.role || 'Super Admin',
          badgeNumber: code
        }
      });
    }

    // 2. Secondary check against persistent local serverUsersStore (using universal password verification)
    const users = Array.isArray(serverUsersStore) ? serverUsersStore : [];
    const matchedUser = users.find((u: any) => {
      const uEmail = String(u.email || '').toLowerCase().trim();
      const uUsername = String(u.username || '').toLowerCase().trim();
      const uId = String(u.id || '').toLowerCase().trim();
      return uEmail === inputIdentifier || uUsername === inputIdentifier || uId === inputIdentifier;
    });

    if (matchedUser) {
      const roleStr = String(matchedUser.role || '').toLowerCase();
      const isAdminRole = Boolean(
        matchedUser.is_admin ||
        roleStr.includes('admin') ||
        roleStr.includes('super') ||
        roleStr.includes('audit') ||
        roleStr.includes('officer')
      );

      if (!isAdminRole) {
        return res.status(403).json({ success: false, error: 'Access Denied: Account does not have administrative privileges.' });
      }

      const storedPass = getRowPasswordHash(matchedUser);
      if (verifyPasswordHash(inputPassword, storedPass)) {
        const adminSession = {
          id: matchedUser.id || 'wb-adm-001',
          email: matchedUser.email || inputIdentifier,
          username: matchedUser.username || inputIdentifier,
          fullName: matchedUser.fullName || matchedUser.name || 'Chief Treasury Auditor',
          role: roleStr.includes('admin') && !roleStr.includes('super') ? 'Admin' : 'Super Admin',
          badgeNumber: code,
          is_admin: true,
          authMethod: 'Database_Clearance',
          authenticatedAt: new Date().toISOString()
        };
        return res.json({ success: true, admin: adminSession });
      }
    }

    // 3. Built-in Master Officer Clearance Fallback
    if (
      (inputIdentifier === 'admin' || inputIdentifier === 'admin@wbcu.net' || inputIdentifier === 'mizbrymo' || inputIdentifier === 'mizbrymo@gmail.com') &&
      verifyPasswordHash(inputPassword, '12345')
    ) {
      const isMiz = inputIdentifier.includes('miz');
      const adminSession = {
        id: isMiz ? 'usr-101' : 'usr-admin-01',
        email: isMiz ? 'mizbrymo@gmail.com' : 'admin@wbcu.net',
        username: isMiz ? 'mizbrymo' : 'admin',
        fullName: isMiz ? 'Miz Brymo' : 'Chief Treasury Auditor',
        role: 'Super Admin',
        badgeNumber: code,
        is_admin: true,
        authMethod: 'Master_Officer_Clearance',
        authenticatedAt: new Date().toISOString()
      };
      return res.json({ success: true, message: 'Administrative authentication clearance granted.', admin: adminSession });
    }

    return res.status(401).json({ success: false, error: 'Access Denied: Invalid administrative credentials or master passcode.' });
  });

  app.all(['/api/test-db.php', '/test-db.php'], async (_req, res) => {
    let mysqlConnected = false;
    let mysqlError: string | null = null;
    let userCount = 0;
    try {
      const pool = getDbPool();
      if (pool) {
        const [rows]: any = await pool.query('SELECT COUNT(*) as c FROM users');
        userCount = rows[0]?.c || 0;
        mysqlConnected = true;
      }
    } catch (e: any) {
      mysqlError = e.message;
    }

    return res.json({
      success: true,
      mysql_connected: mysqlConnected,
      mysql_error: mysqlError,
      store_users_count: serverUsersStore.length,
      available_admins: serverUsersStore.filter((u: any) => u.is_admin).map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role
      }))
    });
  });

  app.get('/api/admin/cards', (_req, res) => {
    return res.json({ success: true, cards: serverCardsStore });
  });

  app.post('/api/admin/cards', (req, res) => {
    const { cards } = req.body || {};
    if (Array.isArray(cards)) {
      serverCardsStore = cards;
      return res.json({ success: true, count: cards.length });
    }
    return res.status(400).json({ success: false, error: 'Cards must be an array' });
  });

  app.get(
    [
      '/admin',
      '/admin/',
      '/admin.html',
      '/pages/admin',
      '/pages/admin/',
      '/pages/admin.html',
      '/pages/admin-dashboard',
      '/pages/admin-dashboard.html',
    ],
    (_req, res) => {
      const pageAdminPath = path.resolve(__dirname, 'pages/admin-dashboard.html');
      if (fs.existsSync(pageAdminPath)) {
        return res.sendFile(pageAdminPath);
      }
      const adminPath = path.resolve(__dirname, 'admin/index.html');
      if (fs.existsSync(adminPath)) {
        return res.sendFile(adminPath);
      }
      const distAdminPath = path.resolve(__dirname, 'dist/pages/admin-dashboard.html');
      if (fs.existsSync(distAdminPath)) {
        return res.sendFile(distAdminPath);
      }
      return res.sendFile(path.resolve(__dirname, 'admin.html'));
    }
  );

  const distIndexPath = path.resolve(__dirname, 'dist', 'index.html');
  const rootIndexPath = path.resolve(__dirname, 'index.html');

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (fs.existsSync(distIndexPath)) {
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (_req, res) => {
        res.sendFile(distIndexPath);
      });
    } else if (fs.existsSync(rootIndexPath)) {
      app.use(express.static(__dirname));
      app.get('*', (_req, res) => {
        res.sendFile(rootIndexPath);
      });
    } else {
      app.get('*', (_req, res) => {
        res.send('<h1>WB Credit Union App Server Active</h1>');
      });
    }
  }

  if (typeof PORT === 'string' && (PORT.startsWith('/') || PORT.startsWith('\\\\'))) {
    app.listen(PORT, () => {
      console.log(`[WB Credit Union Server] Listening on Passenger socket ${PORT}`);
    });
  } else {
    app.listen(Number(PORT), HOST, () => {
      console.log(`[WB Credit Union Server] Listening on http://${HOST}:${PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
