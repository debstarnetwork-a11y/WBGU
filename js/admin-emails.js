/**
 * ============================================================================
 * WB CREDIT UNION - ADMIN EMAIL MANAGEMENT CONTROLLER (js/admin-emails.js)
 * ============================================================================
 * 
 * Manages institutional communications and email delivery telemetry:
 * 1. Email Dashboard Stats (Total Sent Today, Pending, Failed Deliveries)
 * 2. Email Delivery Types Breakdown Canvas Donut Chart
 * 3. Master Email Delivery Logs Table with Search, Multi-Filter, and View HTML
 * 4. Compose Email Engine with Recipient Targeting & Rich Formatting
 * 5. Email Templates Gallery & Live Responsive Previewer
 * 6. Failed Email Queue & Automated Retry Engine
 * ============================================================================
 */

import {
  showToast,
} from './supabase-config.js';
import {
  getAdminUsersList,
} from './admin-users.js';
import {
  wrapEmailHtml,
  getWelcomeEmailHtml,
  getTransactionEmailHtml,
  getWireTransferCodeEmailHtml,
  getOTPEmailHtml,
  getCardIssuedEmailHtml,
} from './notifications-email.js';

const ADMIN_EMAIL_LOGS_STORAGE_KEY = 'wb_email_logs_v2';

/* ----------------------------------------------------------------------------
 * 1. SEED EMAIL LOGS DATASET
 * ---------------------------------------------------------------------------- */
const initialSeedEmailLogs = [
  {
    id: 'eml-1001',
    recipientEmail: 'mizbrymo@gmail.com',
    recipientName: 'Miz Brymo',
    userId: 'usr-101',
    type: 'wire_code',
    subject: 'Wire Transfer Clearance Code Required - Ref #WB-SWIFT-99201',
    body: 'Your international outbound SWIFT wire transfer of EUR 240,000.00 requires entry of your assigned COT (Cost of Transfer) clearance code.',
    status: 'sent',
    error: null,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins ago
    opened: true,
  },
  {
    id: 'eml-1002',
    recipientEmail: 'elena.rostova@vanguardlogistics.ch',
    recipientName: 'Elena Rostova',
    userId: 'usr-102',
    type: 'transaction',
    subject: 'Direct Inward Fedwire Settled - +$18,450,000.00 USD',
    body: 'A direct institutional settlement credit has been deposited into Vanguard Corporate Settlement Account 1102-8849-01.',
    status: 'sent',
    error: null,
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    opened: true,
  },
  {
    id: 'eml-1003',
    recipientEmail: 'treasury@sterlingmerchant.com',
    recipientName: 'Sterling Merchant Trading',
    userId: 'usr-103',
    type: 'security_alert',
    subject: 'Account Security Notice - Compliance Review Hold',
    body: 'Your account 7738-9921-44 has been placed on temporary compliance review hold per AML regulation guidelines.',
    status: 'sent',
    error: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    opened: false,
  },
  {
    id: 'eml-1004',
    recipientEmail: 'chen.wei@singaporebiotech.sg',
    recipientName: 'Chen Wei',
    userId: 'usr-104',
    type: 'card_issued',
    subject: 'Your World Elite Mastercard is in Production',
    body: 'Your physical World Elite Mastercard has been approved and queued for high-security embroidery and courier dispatch.',
    status: 'sent',
    error: null,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    opened: true,
  },
  {
    id: 'eml-1005',
    recipientEmail: 'genevieve.dubois@chateau-dubois.fr',
    recipientName: 'Genevieve Dubois',
    userId: 'usr-105',
    type: 'otp',
    subject: 'One-Time Authorization Passcode: 892014',
    body: 'Use verification passcode 892014 to authorize outbound transfer from your Sovereign Wealth Vault.',
    status: 'sent',
    error: null,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    opened: true,
  },
  {
    id: 'eml-1006',
    recipientEmail: 'marcus.vance@vancecap.com',
    recipientName: 'Marcus Vance',
    userId: 'usr-106',
    type: 'welcome',
    subject: 'Welcome to WB Credit Union - Swiss Wealth Vault Opened',
    body: 'Your institutional account 9901-2244-11 has been successfully provisioned with Level 3 KYC clearance.',
    status: 'sent',
    error: null,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    opened: true,
  },
  {
    id: 'eml-1007',
    recipientEmail: 'invalid-mx-relay@offshore-fail.net',
    recipientName: 'Offshore Holding Co',
    userId: 'usr-103',
    type: 'wire_code',
    subject: 'IMF Clearance Code Notification - Ref #WB-SWIFT-88190',
    body: 'IMF compliance certification code requires validation for international transfer.',
    status: 'failed',
    error: 'SMTP 550 5.1.2: Host server address lookup failed (MX record not found).',
    createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    opened: false,
  },
  {
    id: 'eml-1008',
    recipientEmail: 'timeout-user@geneva-relay.ch',
    recipientName: 'Helene Von Berg',
    userId: 'usr-101',
    type: 'transaction',
    subject: 'Credit Notice - Dividend Settlement CHF 45,000.00',
    body: 'Dividend yield settlement has been posted to your Swiss Sovereign Offshore vault.',
    status: 'failed',
    error: 'Connection timed out after 30000ms connecting to smtp.geneva-relay.ch:465.',
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    opened: false,
  },
  {
    id: 'eml-1009',
    recipientEmail: 'mizbrymo@gmail.com',
    recipientName: 'Miz Brymo',
    userId: 'usr-101',
    type: 'statement',
    subject: 'Monthly Account Statement Ready for Download - Sep 2026',
    body: 'Your audited multi-currency monthly depository statement for September 2026 is now available.',
    status: 'pending',
    error: null,
    createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    opened: false,
  }
];

/* ----------------------------------------------------------------------------
 * 2. STORAGE CONTROLLERS
 * ---------------------------------------------------------------------------- */
export function getAdminEmailLogs() {
  const stored = localStorage.getItem(ADMIN_EMAIL_LOGS_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fallback
    }
  }
  localStorage.setItem(ADMIN_EMAIL_LOGS_STORAGE_KEY, JSON.stringify(initialSeedEmailLogs));
  return initialSeedEmailLogs;
}

export function saveAdminEmailLogs(logs) {
  localStorage.setItem(ADMIN_EMAIL_LOGS_STORAGE_KEY, JSON.stringify(logs));
}

/* ----------------------------------------------------------------------------
 * 3. STATE & CONTROLLER VARIABLES
 * ---------------------------------------------------------------------------- */
let currentEmailLogs = [];
let filteredEmailLogs = [];
let currentEmailSubTab = 'logs'; // 'logs' | 'compose' | 'templates' | 'failed'
let activePreviewEmail = null;

/* ----------------------------------------------------------------------------
 * 4. INITIALIZATION
 * ---------------------------------------------------------------------------- */
export function initAdminEmailManagement() {
  currentEmailLogs = getAdminEmailLogs();
  filteredEmailLogs = [...currentEmailLogs];

  setupEmailSubTabs();
  setupEmailSearchAndFilters();
  setupEmailComposeForm();
  setupEmailTemplatesGallery();
  setupFailedEmailRetry();
  setupEmailPreviewModal();

  renderEmailDashboardMetrics();
  renderEmailTypesDonutChart();
  renderEmailLogsTable();
  renderFailedEmailQueue();
}

/* ----------------------------------------------------------------------------
 * 5. DASHBOARD METRICS & TYPES DONUT CHART
 * ---------------------------------------------------------------------------- */
function renderEmailDashboardMetrics() {
  const totalSentEl = document.getElementById('emailStatSentToday');
  const pendingEl = document.getElementById('emailStatPending');
  const failedEl = document.getElementById('emailStatFailed');
  const rateEl = document.getElementById('emailStatDeliveryRate');

  const sentCount = currentEmailLogs.filter((e) => e.status === 'sent').length;
  const pendingCount = currentEmailLogs.filter((e) => e.status === 'pending').length;
  const failedCount = currentEmailLogs.filter((e) => e.status === 'failed').length;
  const total = currentEmailLogs.length;
  const rate = total > 0 ? ((sentCount / (sentCount + failedCount || 1)) * 100).toFixed(1) : '100.0';

  if (totalSentEl) totalSentEl.textContent = `${sentCount + 140} Sent`;
  if (pendingEl) pendingEl.textContent = pendingCount.toString();
  if (failedEl) failedEl.textContent = failedCount.toString();
  if (rateEl) rateEl.textContent = `${rate}%`;
}

function renderEmailTypesDonutChart() {
  const canvas = document.getElementById('canvasEmailTypesDonut');
  if (!canvas) return;

  const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : null;
  const width = rect && rect.width > 20 ? rect.width : (canvas.clientWidth || 240);
  const height = rect && rect.height > 20 ? rect.height : (canvas.clientHeight || 180);
  if (width <= 20 || height <= 20) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const segments = [
    { label: 'Transaction Notices', percent: 38, color: '#3b82f6' },
    { label: 'Wire Clearance Codes', percent: 26, color: '#f59e0b' },
    { label: 'Security & OTP', percent: 18, color: '#ef4444' },
    { label: 'Card Fulfillment', percent: 10, color: '#10b981' },
    { label: 'Welcome / Onboarding', percent: 8, color: '#8b5cf6' }
  ];

  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.max(15, Math.min(centerX, centerY) - 10);
  const innerRadius = Math.max(5, outerRadius * 0.58);

  let currentAngle = -Math.PI / 2;

  segments.forEach((seg) => {
    const sliceAngle = (seg.percent / 100) * (Math.PI * 2);

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, currentAngle, currentAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
    ctx.closePath();

    ctx.fillStyle = seg.color;
    ctx.fill();

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    currentAngle += sliceAngle;
  });

  // Center text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px Poppins, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('99.4%', centerX, centerY - 3);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '8px Poppins, sans-serif';
  ctx.fillText('SMTP Uptime', centerX, centerY + 11);
}

/* ----------------------------------------------------------------------------
 * 6. SUB-TABS NAVIGATION
 * ---------------------------------------------------------------------------- */
function setupEmailSubTabs() {
  const tabs = [
    { id: 'emailTabLogs', view: 'logs', panelId: 'panelEmailLogs' },
    { id: 'emailTabCompose', view: 'compose', panelId: 'panelEmailCompose' },
    { id: 'emailTabTemplates', view: 'templates', panelId: 'panelEmailTemplates' },
    { id: 'emailTabFailed', view: 'failed', panelId: 'panelEmailFailed' }
  ];

  tabs.forEach((tab) => {
    const btn = document.getElementById(tab.id);
    if (btn) {
      btn.addEventListener('click', () => {
        tabs.forEach((t) => {
          document.getElementById(t.id)?.classList.remove('active');
          const panel = document.getElementById(t.panelId);
          if (panel) panel.style.display = 'none';
        });

        btn.classList.add('active');
        currentEmailSubTab = tab.view;
        const activePanel = document.getElementById(tab.panelId);
        if (activePanel) activePanel.style.display = 'block';

        if (tab.view === 'failed') {
          renderFailedEmailQueue();
        }
      });
    }
  });
}

/* ----------------------------------------------------------------------------
 * 7. EMAIL LOGS SEARCH & FILTERING
 * ---------------------------------------------------------------------------- */
function setupEmailSearchAndFilters() {
  const searchInput = document.getElementById('emailSearchInput');
  const typeFilter = document.getElementById('emailTypeFilter');
  const statusFilter = document.getElementById('emailStatusFilter');
  const clearBtn = document.getElementById('btnClearEmailFilters');

  let timer = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(applyEmailFilters, 250);
    });
  }

  [typeFilter, statusFilter].forEach((sel) => {
    if (sel) sel.addEventListener('change', applyEmailFilters);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (typeFilter) typeFilter.value = 'all';
      if (statusFilter) statusFilter.value = 'all';
      applyEmailFilters();
    });
  }
}

function applyEmailFilters() {
  const query = (document.getElementById('emailSearchInput')?.value || '').trim().toLowerCase();
  const typeVal = document.getElementById('emailTypeFilter')?.value || 'all';
  const statusVal = document.getElementById('emailStatusFilter')?.value || 'all';

  filteredEmailLogs = currentEmailLogs.filter((e) => {
    const matchesQuery = !query ||
      e.recipientEmail.toLowerCase().includes(query) ||
      e.recipientName.toLowerCase().includes(query) ||
      e.subject.toLowerCase().includes(query);

    const matchesType = typeVal === 'all' || e.type === typeVal;
    const matchesStatus = statusVal === 'all' || e.status === statusVal;

    return matchesQuery && matchesType && matchesStatus;
  });

  renderEmailLogsTable();
}

/* ----------------------------------------------------------------------------
 * 8. RENDER EMAIL LOGS TABLE
 * ---------------------------------------------------------------------------- */
export function renderEmailLogsTable() {
  const tbody = document.getElementById('adminEmailLogsTableBody');
  const countBadge = document.getElementById('emailLogsCountBadge');

  if (countBadge) countBadge.textContent = `${filteredEmailLogs.length} Records`;
  if (!tbody) return;

  if (filteredEmailLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center p-5 text-muted">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📧</div>
          <div class="font-bold text-white mb-1">No email delivery logs found</div>
          <div class="text-xs">Adjust your search parameters or category filter.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredEmailLogs.map((item) => {
    const dateFormatted = new Date(item.createdAt).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return `
      <tr class="admin-user-row" data-email-id="${item.id}">
        <td>
          <div class="font-mono text-xs text-white font-bold">${dateFormatted}</div>
          <div class="text-xs text-muted font-mono">${item.id}</div>
        </td>
        <td>
          <div class="font-bold text-white text-xs">${escapeHtml(item.recipientName)}</div>
          <div class="text-xs text-muted font-mono">${escapeHtml(item.recipientEmail)}</div>
        </td>
        <td>
          <span class="admin-tx-type-tag">${formatEmailTypeTag(item.type)}</span>
        </td>
        <td>
          <div class="text-xs font-semibold text-white">${escapeHtml(item.subject)}</div>
          <div class="text-xs text-muted text-truncate" style="max-width: 320px;">${escapeHtml(item.body)}</div>
        </td>
        <td>
          <span class="action-chip badge-email-${item.status}">
            ${item.status.toUpperCase()}
          </span>
        </td>
        <td class="text-right" onclick="event.stopPropagation()">
          <div class="d-flex items-center justify-end gap-1">
            <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-preview-email-log" data-email-id="${item.id}">
              👁️ View
            </button>
            <button type="button" class="admin-btn admin-btn-primary admin-btn-sm btn-resend-email-log" data-email-id="${item.id}">
              🔄 Resend
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // View preview clicks
  tbody.querySelectorAll('.btn-preview-email-log').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-email-id');
      const log = currentEmailLogs.find((l) => l.id === id);
      if (log) openEmailPreviewModal(log.subject, log.body, log.recipientName, log.recipientEmail);
    });
  });

  // Resend clicks
  tbody.querySelectorAll('.btn-resend-email-log').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-email-id');
      const log = currentEmailLogs.find((l) => l.id === id);
      if (log) {
        log.status = 'sent';
        log.error = null;
        log.createdAt = new Date().toISOString();
        saveAdminEmailLogs(currentEmailLogs);
        renderEmailDashboardMetrics();
        applyEmailFilters();
        showToast(`Email successfully re-dispatched to ${log.recipientEmail}.`, 'success', 'Email Dispatched');
      }
    });
  });
}

function formatEmailTypeTag(type) {
  const map = {
    wire_code: '🔐 Wire Clearance',
    transaction: '💰 Transaction Alert',
    security_alert: '🛡️ Security Notice',
    card_issued: '💳 Card Fulfillment',
    otp: '🔒 2FA OTP Passcode',
    welcome: '🎉 Welcome Onboard',
    statement: '📑 Monthly Statement',
    custom: '📢 Direct Notice'
  };
  return map[type] || '📧 Operational Notice';
}

/* ----------------------------------------------------------------------------
 * 9. COMPOSE EMAIL ENGINE
 * ---------------------------------------------------------------------------- */
function setupEmailComposeForm() {
  const form = document.getElementById('adminComposeEmailForm');
  const recipientTypeSelect = document.getElementById('composeRecipientType');
  const userSelectWrap = document.getElementById('composeUserSelectWrap');
  const userSelect = document.getElementById('composeUserSelect');
  const manualEmailWrap = document.getElementById('composeManualEmailWrap');
  const templateSelect = document.getElementById('composeTemplateSelect');
  const subjectInput = document.getElementById('composeSubjectInput');
  const bodyTextarea = document.getElementById('composeBodyTextarea');
  const previewBtn = document.getElementById('btnPreviewComposedEmail');

  // Populate users in dropdown
  if (userSelect) {
    const users = getAdminUsersList();
    userSelect.innerHTML = users.map((u) => `
      <option value="${u.id}" data-email="${u.email}" data-name="${u.fullName}">${escapeHtml(u.fullName)} (${u.email})</option>
    `).join('');
  }

  // Recipient selector changes
  if (recipientTypeSelect) {
    recipientTypeSelect.addEventListener('change', () => {
      const val = recipientTypeSelect.value;
      if (val === 'single') {
        if (userSelectWrap) userSelectWrap.style.display = 'block';
        if (manualEmailWrap) manualEmailWrap.style.display = 'none';
      } else if (val === 'manual') {
        if (userSelectWrap) userSelectWrap.style.display = 'none';
        if (manualEmailWrap) manualEmailWrap.style.display = 'block';
      } else {
        if (userSelectWrap) userSelectWrap.style.display = 'none';
        if (manualEmailWrap) manualEmailWrap.style.display = 'none';
      }
    });
  }

  // Rich toolbar buttons
  document.querySelectorAll('.admin-editor-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      insertEditorTag(action);
    });
  });

  // Token pills
  document.querySelectorAll('.admin-editor-token-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const token = btn.getAttribute('data-token');
      insertTextAtCursor(bodyTextarea, token);
    });
  });

  // Template change
  if (templateSelect) {
    templateSelect.addEventListener('change', () => {
      loadTemplatePreset(templateSelect.value);
    });
  }

  function loadTemplatePreset(templateKey) {
    if (templateKey === 'welcome') {
      if (subjectInput) subjectInput.value = 'Welcome to WB Credit Union - Swiss Wealth Vault Opened';
      if (bodyTextarea) bodyTextarea.value = 'Dear {first_name},\n\nWe are honored to confirm the successful activation of your private banking vault with WB Credit Union.\n\nAccount Portfolio: {account_number}\nInitial Vault Balance: {amount}\nClearance Tier: Swiss Sovereign Level 3\n\nYour encrypted credentials and access keys are now operational. Please log in to review your consolidated depository holdings.';
    } else if (templateKey === 'credit') {
      if (subjectInput) subjectInput.value = 'Direct Inward Clearance Credit: {amount} Posted to {account_number}';
      if (bodyTextarea) bodyTextarea.value = 'Dear {first_name},\n\nAn institutional credit of {amount} has cleared and been credited to your depository portfolio {account_number}.\n\nTransaction Reference: {reference}\nClearing Channel: SWIFT / Fedwire Real-Time Node\nStatus: Settled & Available for Immediate Withdrawal.';
    } else if (templateKey === 'wire_code') {
      if (subjectInput) subjectInput.value = 'Wire Transfer Clearance Code Required - Ref #{reference}';
      if (bodyTextarea) bodyTextarea.value = 'Dear {first_name},\n\nYour outbound international wire transfer #{reference} of {amount} requires regulatory clearance verification.\n\nPlease enter your assigned COT / TAX / IMF compliance token in the encrypted clearance gate in your portal to release funds for SWIFT broadcast.';
    } else if (templateKey === 'otp') {
      if (subjectInput) subjectInput.value = 'Security Verification Passcode: {code_value}';
      if (bodyTextarea) bodyTextarea.value = 'Dear {first_name},\n\nYour single-use security passcode to authorize your high-value treasury request is:\n\n{code_value}\n\nThis verification key expires in 10 minutes. Never share this code with anyone.';
    } else if (templateKey === 'card') {
      if (subjectInput) subjectInput.value = 'Your WB Credit Union Payment Card Has Been Issued';
      if (bodyTextarea) bodyTextarea.value = 'Dear {first_name},\n\nYour new physical debit card has been embossed and queued for Swiss courier dispatch to your registered address.\n\nLinked Account: {account_number}\nTracking Number: {reference}\nFulfillment Hub: Zurich Central Vault.';
    } else {
      if (subjectInput) subjectInput.value = 'Institutional Depository Notice - WB Credit Union';
      if (bodyTextarea) bodyTextarea.value = 'Dear {first_name},\n\nPlease review this important treasury communication regarding your sovereign banking vault {account_number}.';
    }
  }

  function insertEditorTag(action) {
    if (!bodyTextarea) return;
    const start = bodyTextarea.selectionStart;
    const end = bodyTextarea.selectionEnd;
    const selected = bodyTextarea.value.substring(start, end) || 'text';
    let wrapped = selected;

    if (action === 'bold') wrapped = `**${selected}**`;
    if (action === 'italic') wrapped = `*${selected}*`;
    if (action === 'code') wrapped = `\`${selected}\``;
    if (action === 'list') wrapped = `\n• ${selected}`;

    bodyTextarea.setRangeText(wrapped, start, end, 'select');
  }

  function insertTextAtCursor(textarea, text) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText(text, start, end, 'end');
    textarea.focus();
  }

  // Preview composed email
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      const subject = subjectInput?.value || 'Institutional Banking Notice';
      const rawBody = bodyTextarea?.value || 'Message content here...';
      const users = getAdminUsersList();
      const firstUser = users[0] || { fullName: 'Miz Brymo', email: 'mizbrymo@gmail.com' };

      openEmailPreviewModal(subject, rawBody, firstUser.fullName, firstUser.email);
    });
  }

  // Submit compose email
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const recipientType = recipientTypeSelect?.value || 'single';
      const subject = subjectInput?.value.trim() || 'Institutional Notice';
      const body = bodyTextarea?.value.trim() || '';
      const template = templateSelect?.value || 'custom';

      let recipients = [];
      const users = getAdminUsersList();

      if (recipientType === 'single') {
        const uId = userSelect?.value;
        const u = users.find((user) => user.id === uId) || users[0];
        recipients.push({ name: u.fullName, email: u.email, id: u.id });
      } else if (recipientType === 'manual') {
        const email = document.getElementById('composeManualEmailInput')?.value.trim();
        recipients.push({ name: 'External Client', email, id: 'usr-ext' });
      } else if (recipientType === 'active') {
        users.filter((u) => u.status === 'active').forEach((u) => recipients.push({ name: u.fullName, email: u.email, id: u.id }));
      } else {
        // all
        users.forEach((u) => recipients.push({ name: u.fullName, email: u.email, id: u.id }));
      }

      recipients.forEach((r) => {
        const newLog = {
          id: `eml-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`,
          recipientEmail: r.email,
          recipientName: r.name,
          userId: r.id,
          type: template,
          subject: subject.replace('{first_name}', r.name.split(' ')[0]),
          body: body.replace('{first_name}', r.name.split(' ')[0]),
          status: 'sent',
          error: null,
          createdAt: new Date().toISOString(),
          opened: false,
        };
        currentEmailLogs.unshift(newLog);
      });

      saveAdminEmailLogs(currentEmailLogs);
      renderEmailDashboardMetrics();
      applyEmailFilters();

      form.reset();
      showToast(`Dispatched institutional email to ${recipients.length} recipient(s).`, 'success', 'Email Sent');

      // Switch back to logs tab
      const logsTab = document.getElementById('emailTabLogs');
      if (logsTab) logsTab.click();
    });
  }
}

/* ----------------------------------------------------------------------------
 * 10. EMAIL TEMPLATES GALLERY
 * ---------------------------------------------------------------------------- */
function setupEmailTemplatesGallery() {
  document.querySelectorAll('.btn-use-template').forEach((btn) => {
    btn.addEventListener('click', () => {
      const templateKey = btn.getAttribute('data-template-key');
      const composeTab = document.getElementById('emailTabCompose');
      const templateSelect = document.getElementById('composeTemplateSelect');

      if (composeTab) composeTab.click();
      if (templateSelect) {
        templateSelect.value = templateKey;
        templateSelect.dispatchEvent(new Event('change'));
      }
    });
  });

  document.querySelectorAll('.btn-preview-template').forEach((btn) => {
    btn.addEventListener('click', () => {
      const templateKey = btn.getAttribute('data-template-key');
      renderTemplatePreview(templateKey);
    });
  });
}

function renderTemplatePreview(templateKey) {
  let html = '';
  let subject = 'WB Credit Union Notice';

  if (templateKey === 'welcome') {
    subject = 'Welcome to WB Credit Union - Swiss Wealth Vault Opened';
    html = getWelcomeEmailHtml({
      firstName: 'Alexander',
      accountNumber: 'WB-9482-1049-55',
      accountType: 'Premier Wealth Checking',
      currency: 'USD',
      initialBalance: '50,000.00'
    });
  } else if (templateKey === 'credit') {
    subject = 'Direct Inward Fedwire Settled: $50,000.00 USD';
    html = getTransactionEmailHtml({
      direction: 'credit',
      amount: '50,000.00',
      currency: 'USD',
      accountNumber: 'WB-9482-1049-55',
      accountName: 'Premier Checking',
      description: 'Inward Wire Clearance from UBS Zurich AG',
      reference: 'WBCU-TX-98402',
      availableBalance: '948,250.00'
    });
  } else if (templateKey === 'wire_code') {
    subject = 'Wire Transfer Clearance Code Required - Ref #WB-SWIFT-99201';
    html = getWireTransferCodeEmailHtml({
      reference: 'WB-SWIFT-99201',
      amount: '240,000.00',
      currency: 'EUR',
      beneficiary: 'BNP Paribas Paris S.A.',
      requiredCodeTypes: 'COT (Cost of Transfer) & IMF Token'
    });
  } else if (templateKey === 'otp') {
    subject = 'One-Time Authorization Passcode: 892014';
    html = getOTPEmailHtml({
      otpCode: '892014',
      email: 'alexander.morgan@wbcu.net',
      type: 'international wire dispatch'
    });
  } else if (templateKey === 'card') {
    subject = 'Black Metal Premier Debit Card Issued';
    html = getCardIssuedEmailHtml({
      maskedCardNumber: '•••• •••• •••• 1234',
      cardType: 'Black Metal Premier',
      firstName: 'Miz',
      accountNumber: 'WB-9482-1049-55',
      dailyLimit: '10,000'
    });
  } else {
    subject = 'Institutional Depository Compliance Notice';
    html = wrapEmailHtml(`
      <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">Institutional Compliance Statement</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">Dear Miz,</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6;">Please review your consolidated portfolio metrics for the Swiss sovereign clearing cycle.</p>
    `, subject);
  }

  openEmailPreviewModal(subject, html, 'Miz Brymo', 'mizbrymo@gmail.com', true);
}

/* ----------------------------------------------------------------------------
 * 11. FAILED EMAIL QUEUE & RETRY ENGINE
 * ---------------------------------------------------------------------------- */
function setupFailedEmailRetry() {
  const retryAllBtn = document.getElementById('btnRetryAllFailedEmails');
  if (retryAllBtn) {
    retryAllBtn.addEventListener('click', () => {
      const failed = currentEmailLogs.filter((e) => e.status === 'failed');
      if (failed.length === 0) {
        showToast('No failed emails currently in queue.', 'info', 'Retry Queue');
        return;
      }

      failed.forEach((e) => {
        e.status = 'sent';
        e.error = null;
        e.createdAt = new Date().toISOString();
      });

      saveAdminEmailLogs(currentEmailLogs);
      renderEmailDashboardMetrics();
      applyEmailFilters();
      renderFailedEmailQueue();
      showToast(`Batch retried ${failed.length} failed emails successfully.`, 'success', 'Retry Complete');
    });
  }
}

function renderFailedEmailQueue() {
  const container = document.getElementById('failedEmailQueueTableBody');
  const countSpan = document.getElementById('failedEmailBadgeCount');
  const failed = currentEmailLogs.filter((e) => e.status === 'failed');

  if (countSpan) countSpan.textContent = `${failed.length} Failed`;
  if (!container) return;

  if (failed.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="text-center p-5 text-muted">
          <div style="font-size: 2rem; margin-bottom: 0.5rem; color:#34d399;">✓</div>
          <div class="font-bold text-white mb-1">Zero Failed Deliveries</div>
          <div class="text-xs">All outbound SMTP relay nodes are operating with 100% deliverability.</div>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = failed.map((item) => `
    <tr>
      <td>
        <div class="font-mono text-xs text-white font-bold">${new Date(item.createdAt).toLocaleTimeString()}</div>
        <div class="text-xs text-muted font-mono">${item.id}</div>
      </td>
      <td>
        <div class="font-bold text-white text-xs">${escapeHtml(item.recipientName)}</div>
        <div class="text-xs text-muted font-mono">${escapeHtml(item.recipientEmail)}</div>
      </td>
      <td>
        <div class="text-xs font-semibold text-white">${escapeHtml(item.subject)}</div>
        <div class="text-xs text-muted font-mono">${formatEmailTypeTag(item.type)}</div>
      </td>
      <td>
        <div class="p-2" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:6px;">
          <span class="font-mono text-xs text-danger font-bold">${escapeHtml(item.error || 'SMTP Relay Rejected')}</span>
        </div>
      </td>
      <td class="text-right">
        <button type="button" class="admin-btn admin-btn-emerald admin-btn-sm btn-retry-single-failed" data-email-id="${item.id}">
          🔄 Retry Send
        </button>
      </td>
    </tr>
  `).join('');

  container.querySelectorAll('.btn-retry-single-failed').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-email-id');
      const item = currentEmailLogs.find((l) => l.id === id);
      if (item) {
        item.status = 'sent';
        item.error = null;
        item.createdAt = new Date().toISOString();
        saveAdminEmailLogs(currentEmailLogs);
        renderEmailDashboardMetrics();
        applyEmailFilters();
        renderFailedEmailQueue();
        showToast(`Retried delivery to ${item.recipientEmail}. Status: SENT.`, 'success', 'Dispatched');
      }
    });
  });
}

/* ----------------------------------------------------------------------------
 * 12. EMAIL PREVIEW MODAL
 * ---------------------------------------------------------------------------- */
function setupEmailPreviewModal() {
  const modal = document.getElementById('emailPreviewModal');
  const closeBtn = document.getElementById('closeEmailPreviewModalBtn');
  if (closeBtn && modal) {
    closeBtn.onclick = () => modal.classList.remove('show');
  }
}

export function openEmailPreviewModal(subject, bodyHtmlOrText, recipientName = 'Member', recipientEmail = 'member@wbcu.net', isPreFormatted = false) {
  const modal = document.getElementById('emailPreviewModal');
  const frame = document.getElementById('emailPreviewFrame');
  const subjectDisplay = document.getElementById('previewModalSubject');
  const recipientDisplay = document.getElementById('previewModalRecipient');

  if (!modal || !frame) return;

  if (subjectDisplay) subjectDisplay.textContent = subject;
  if (recipientDisplay) recipientDisplay.textContent = `To: ${recipientName} <${recipientEmail}>`;

  let finalHtml = '';
  if (isPreFormatted) {
    finalHtml = bodyHtmlOrText;
  } else {
    const formattedParagraphs = bodyHtmlOrText
      .split('\n\n')
      .map((p) => `<p style="margin: 0 0 16px 0; font-family: 'Poppins', Arial, sans-serif; font-size: 14px; line-height: 22px; color: #334155;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
      .join('');

    finalHtml = wrapEmailHtml(`
      <h2 style="margin: 0 0 16px 0; font-family: 'Poppins', Arial, sans-serif; font-size: 20px; font-weight: 700; color: #0f172a;">
        ${escapeHtml(subject)}
      </h2>
      ${formattedParagraphs}
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px;">
        <tr>
          <td align="center">
            <a href="https://www.wbcu.net/#dashboard" style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; font-family: 'Poppins', Arial, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 30px; border-radius: 8px; text-transform: uppercase;">
              Access Sovereign Banking Portal &rarr;
            </a>
          </td>
        </tr>
      </table>
    `, subject);
  }

  frame.innerHTML = finalHtml;
  modal.classList.add('show');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
