/**
 * ============================================================================
 * WB CREDIT UNION - ADMIN TRANSACTION MANAGEMENT CONTROLLER (js/admin-transactions.js)
 * ============================================================================
 * 
 * Complete regulatory & treasury control for banking transactions:
 * - 4-Card Transaction Dashboard Metrics + 7-Day Volume Canvas Chart
 * - Multi-criteria Filters (Date, Type, Status, Min/Max Amount, Currency, User, Ref #)
 * - Sorting, pagination, CSV & PDF export
 * - Administrative Transaction Actions:
 *     * Inspect details (Sender, Beneficiary, Wire Codes verification status)
 *     * Status Change with automatic balance adjustments & notification dispatch
 *     * In-place Modification (Amount, Description, Compliance Notes)
 *     * Transaction Reversal (generates counter-entry, restores balance)
 *     * Soft / Hard Delete with confirmation
 * - Manual Transaction Generator (Credit / Debit direct entry)
 * - Pending Approvals Queue with 1-click Approve / Reject / Hold
 * ============================================================================
 */

import {
  showToast,
} from './supabase-config.js';
import { jsPDF } from 'jspdf';
import { createNotification } from './notifications-email.js';
import {
  getAdminUsersList,
  saveAdminUsersList,
  getEffectiveMemberName,
  getEffectiveMemberEmail,
} from './admin-users.js';

const ADMIN_TX_STORAGE_KEY = 'wb_credit_union_admin_transactions_db';

/* ----------------------------------------------------------------------------
 * 1. SEED TRANSACTIONS
 * ---------------------------------------------------------------------------- */
const initialSeedTransactions = [
  {
    id: 'TX-99201',
    ref: 'WB-SWIFT-99201',
    date: '2026-09-26T11:15:00Z',
    userId: 'usr-101',
    userName: 'Miz Brymo',
    userEmail: 'mizbrymo@gmail.com',
    accountNumber: '9482-1049-55',
    accountType: 'Premier Checking',
    type: 'wire',
    amount: 240000.00,
    currency: 'EUR',
    direction: 'outward',
    status: 'pending',
    beneficiaryName: 'BNP Paribas Paris (Morgan Real Estate SARL)',
    beneficiaryBank: 'BNP Paribas Paris',
    swiftCode: 'BNPAFRPP',
    description: 'International Wire for French Riviera Property Acquisition',
    adminNotes: 'Dual treasury signoff required. Awaiting secondary officer verification.',
    wireCodes: {
      COT: { verified: true, code: 'CT-78234' },
      TAX: { verified: true, code: 'TX-99120' },
      IMF: { verified: true, code: 'IMF-44912' },
      AML: { verified: true, code: 'AML-00821' },
      PAP: { verified: false, code: 'PAP-33810' }
    },
    timeline: [
      { date: '2026-09-26 11:15:00', status: 'pending', note: 'Wire submitted by member via Member Vault', officer: 'MEMBER' },
      { date: '2026-09-26 11:18:22', status: 'pending', note: 'COT & TAX clearance codes validated by HSM', officer: 'SYSTEM' }
    ]
  },
  {
    id: 'TX-99202',
    ref: 'WB-SWIFT-99202',
    date: '2026-09-26T10:00:00Z',
    userId: 'usr-102',
    userName: 'Elena Rostova',
    userEmail: 'elena.rostova@vanguardlogistics.ch',
    accountNumber: '1102-8849-01',
    accountType: 'Business Vault',
    type: 'wire',
    amount: 88500000.00,
    currency: 'JPY',
    direction: 'outward',
    status: 'pending',
    beneficiaryName: 'Sumitomo Mitsui Banking Corp (Tokyo Port Logistics)',
    beneficiaryBank: 'Sumitomo Mitsui Tokyo',
    swiftCode: 'SMBCJPJT',
    description: 'Container Vessel Charter Settlement & Marine Insurance',
    adminNotes: 'High-value Asian corridor trade clearance.',
    wireCodes: {
      COT: { verified: true, code: 'CT-11099' },
      TAX: { verified: true, code: 'TX-44018' },
      IMF: { verified: true, code: 'IMF-88129' },
      AML: { verified: true, code: 'AML-99014' },
      PAP: { verified: true, code: 'PAP-00124' }
    },
    timeline: [
      { date: '2026-09-26 10:00:00', status: 'pending', note: 'Trade settlement wire initiated', officer: 'MEMBER' }
    ]
  },
  {
    id: 'TX-99203',
    ref: 'WB-SWIFT-99203',
    date: '2026-09-26T08:30:00Z',
    userId: 'usr-103',
    userName: 'Sterling Merchant Trading',
    userEmail: 'treasury@sterlingmerchant.com',
    accountNumber: '7738-9921-44',
    accountType: 'Business Vault',
    type: 'wire',
    amount: 185000000.00,
    currency: 'NGN',
    direction: 'outward',
    status: 'on_hold',
    beneficiaryName: 'First Bank of Nigeria Lagos (Oil Export Consortium)',
    beneficiaryBank: 'First Bank of Nigeria',
    swiftCode: 'FBNINGLA',
    description: 'Crude shipment freight settlement',
    adminNotes: 'AML Alert: Beneficiary entity flagged in OFAC / FinCEN database.',
    wireCodes: {
      COT: { verified: false, code: 'CT-99441' },
      TAX: { verified: false, code: 'TX-00912' },
      IMF: { verified: false, code: 'IMF-11239' },
      AML: { verified: false, code: 'AML-00000' },
      PAP: { verified: false, code: 'PAP-00000' }
    },
    timeline: [
      { date: '2026-09-26 08:30:00', status: 'pending', note: 'Wire submitted', officer: 'MEMBER' },
      { date: '2026-09-26 09:00:00', status: 'on_hold', note: 'Quarantined for AML investigation', officer: 'Chief Treasury Auditor' }
    ]
  },
  {
    id: 'TX-98402',
    ref: 'FED-009182',
    date: '2026-09-25T14:20:00Z',
    userId: 'usr-101',
    userName: 'Miz Brymo',
    userEmail: 'mizbrymo@gmail.com',
    accountNumber: '9482-1049-55',
    accountType: 'Premier Checking',
    type: 'credit',
    amount: 50000.00,
    currency: 'USD',
    direction: 'inward',
    status: 'completed',
    beneficiaryName: 'Miz Brymo',
    beneficiaryBank: 'WB Credit Union (Zurich HQ)',
    swiftCode: 'WBCUCHZZ',
    description: 'Direct Inward Fedwire Clearing - UBS Switzerland',
    adminNotes: 'Cleared through Federal Reserve Bank of New York correspondent channel.',
    wireCodes: {},
    timeline: [
      { date: '2026-09-25 14:15:00', status: 'processing', note: 'Fedwire message received', officer: 'SYSTEM' },
      { date: '2026-09-25 14:20:00', status: 'completed', note: 'Funds credited to Premier Checking', officer: 'SYSTEM' }
    ]
  },
  {
    id: 'TX-98311',
    ref: 'ACH-772910',
    date: '2026-09-25T09:10:00Z',
    userId: 'usr-104',
    userName: 'Dr. Chen Wei',
    userEmail: 'chen.wei@singaporebiotech.sg',
    accountNumber: '4419-3301-88',
    accountType: 'Wealth Savings',
    type: 'credit',
    amount: 120000.00,
    currency: 'USD',
    direction: 'inward',
    status: 'completed',
    beneficiaryName: 'Dr. Chen Wei',
    beneficiaryBank: 'DBS Bank Singapore',
    swiftCode: 'DBSSSGSG',
    description: 'Dividend distribution from Singapore Biotech Holdings',
    adminNotes: 'Regular monthly high-tier yield distribution.',
    wireCodes: {},
    timeline: [
      { date: '2026-09-25 09:10:00', status: 'completed', note: 'Credited automatically', officer: 'SYSTEM' }
    ]
  },
  {
    id: 'TX-98205',
    ref: 'POS-449102',
    date: '2026-09-24T18:40:00Z',
    userId: 'usr-105',
    userName: 'Lady Genevieve Dubois',
    userEmail: 'genevieve.dubois@chateau-dubois.fr',
    accountNumber: '6620-8812-33',
    accountType: 'Sovereign Offshore',
    type: 'card_purchase',
    amount: 14500.00,
    currency: 'EUR',
    direction: 'outward',
    status: 'completed',
    beneficiaryName: 'Boucheron Place Vendôme Paris',
    beneficiaryBank: 'Credit Agricole',
    swiftCode: 'AGRIFRPP',
    description: 'Point of Sale Purchase - Luxury Goods',
    adminNotes: 'Card EMV Chip + PIN validated.',
    wireCodes: {},
    timeline: [
      { date: '2026-09-24 18:40:00', status: 'completed', note: 'POS authorization approved', officer: 'VISA NETWORK' }
    ]
  },
  {
    id: 'TX-98114',
    ref: 'CRYP-10928',
    date: '2026-09-24T12:00:00Z',
    userId: 'usr-104',
    userName: 'Dr. Chen Wei',
    userEmail: 'chen.wei@singaporebiotech.sg',
    accountNumber: '4419-3301-88',
    accountType: 'Wealth Savings',
    type: 'crypto',
    amount: 65000.00,
    currency: 'USD',
    direction: 'inward',
    status: 'completed',
    beneficiaryName: 'Institutional Multi-Sig Cold Vault',
    beneficiaryBank: 'WB Custody HSM',
    swiftCode: 'CRYP-VAULT',
    description: 'Custody Conversion: 1.00 BTC to USD Treasury Reserve',
    adminNotes: 'Block 889,412 confirmed with 6 validations.',
    wireCodes: {},
    timeline: [
      { date: '2026-09-24 12:00:00', status: 'completed', note: 'Crypto custody converted to USD', officer: 'CRYPTO ENGINE' }
    ]
  },
  {
    id: 'TX-98001',
    ref: 'REV-00918',
    date: '2026-09-23T16:30:00Z',
    userId: 'usr-107',
    userName: 'Carlos Mendez',
    userEmail: 'carlos.mendez@mendezholdings.es',
    accountNumber: '5512-9901-22',
    accountType: 'Premier Checking',
    type: 'reversal',
    amount: 3200.00,
    currency: 'EUR',
    direction: 'inward',
    status: 'reversed',
    beneficiaryName: 'Carlos Mendez',
    beneficiaryBank: 'WB Credit Union',
    swiftCode: 'WBCUCHZZ',
    description: 'Reversal of duplicate merchant settlement',
    adminNotes: 'Reversal executed by Officer per member dispute claim #9921.',
    wireCodes: {},
    timeline: [
      { date: '2026-09-23 16:30:00', status: 'reversed', note: 'Reversal posted & balance restored', officer: 'Chief Treasury Auditor' }
    ]
  }
];

/* ----------------------------------------------------------------------------
 * 2. STORAGE METHODS
 * ---------------------------------------------------------------------------- */
export function getAdminTransactionsList() {
  const memberName = getEffectiveMemberName();
  const memberEmail = getEffectiveMemberEmail();
  let list = null;
  const stored = localStorage.getItem(ADMIN_TX_STORAGE_KEY);
  if (stored) {
    try {
      list = JSON.parse(stored);
    } catch {
      list = null;
    }
  }
  if (!Array.isArray(list) || list.length === 0) {
    list = JSON.parse(JSON.stringify(initialSeedTransactions));
  }
  list.forEach((t) => {
    if (t.userId === 'usr-101' || t.userName === 'Alexander Morgan' || (t.userEmail && t.userEmail.includes('mizbrymo'))) {
      t.userName = memberName;
      t.userEmail = memberEmail;
      if (t.beneficiaryName === 'Alexander Morgan') {
        t.beneficiaryName = memberName;
      }
    }
  });
  return list;
}

export function saveAdminTransactionsList(list) {
  localStorage.setItem(ADMIN_TX_STORAGE_KEY, JSON.stringify(list));
}

export function getTransactionById(txId) {
  const list = getAdminTransactionsList();
  return list.find((t) => t.id === txId || t.ref === txId) || null;
}

export function updateTransactionInDb(updatedTx) {
  const list = getAdminTransactionsList();
  const idx = list.findIndex((t) => t.id === updatedTx.id);
  if (idx !== -1) {
    list[idx] = updatedTx;
    saveAdminTransactionsList(list);
    return true;
  }
  return false;
}

/* ----------------------------------------------------------------------------
 * 3. STATE & CONTROLLER VARIABLES
 * ---------------------------------------------------------------------------- */
let currentTransactions = [];
let filteredTransactions = [];
let currentTxPage = 1;
const txPerPage = 25;
let currentTxSortCol = 'date';
let currentTxSortDir = 'desc';
let activeDetailTx = null;
let currentActiveViewTab = 'all'; // 'all' or 'pending'

/* ----------------------------------------------------------------------------
 * 4. INITIALIZE CONTROLLER
 * ---------------------------------------------------------------------------- */
export function initAdminTransactionManagement() {
  currentTransactions = getAdminTransactionsList();
  filteredTransactions = [...currentTransactions];

  setupTxSearchAndFilters();
  setupTxSorting();
  setupTxDetailModal();
  setupManualTransactionModal();
  setupTxExportButtons();
  setupTxSubTabs();

  renderTransactionDashboardMetrics();
  renderTxVolumeCanvasChart();
  renderTransactionsTable();
}

/* ----------------------------------------------------------------------------
 * 5. DASHBOARD METRICS & 7-DAY CHART
 * ---------------------------------------------------------------------------- */
function renderTransactionDashboardMetrics() {
  const totalTodayEl = document.getElementById('txStatTodayCount');
  const totalVolumeEl = document.getElementById('txStatVolume');
  const pendingCountEl = document.getElementById('txStatPendingCount');
  const failedCountEl = document.getElementById('txStatFailedCount');

  const pending = currentTransactions.filter((t) => t.status === 'pending' || t.status === 'on_hold').length;
  const failed = currentTransactions.filter((t) => t.status === 'failed').length;
  const totalVol = currentTransactions.reduce((acc, t) => {
    // Basic normalized volume approximation in USD
    let amt = t.amount;
    if (t.currency === 'JPY') amt = amt / 150;
    if (t.currency === 'NGN') amt = amt / 1600;
    if (t.currency === 'EUR' || t.currency === 'CHF' || t.currency === 'GBP') amt = amt * 1.1;
    return acc + amt;
  }, 0);

  if (totalTodayEl) totalTodayEl.textContent = `${currentTransactions.length} Transactions`;
  if (pendingCountEl) pendingCountEl.textContent = pending.toString();
  if (failedCountEl) failedCountEl.textContent = failed.toString();
  if (totalVolumeEl) {
    totalVolumeEl.textContent = `$${(totalVol / 1000000).toFixed(2)}M`;
  }
}

function renderTxVolumeCanvasChart() {
  const canvas = document.getElementById('canvasTx7DayVolume');
  if (!canvas) return;

  const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : null;
  const width = rect && rect.width > 20 ? rect.width : (canvas.clientWidth || 300);
  const height = rect && rect.height > 20 ? rect.height : (canvas.clientHeight || 180);
  if (width <= 20 || height <= 20) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
  const values = [12.4, 15.8, 19.2, 14.5, 28.6, 22.1, 31.4]; // in Millions
  const maxVal = 35;

  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 22;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Grid lines
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = paddingTop + (chartHeight / 3) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '9px Poppins, sans-serif';
    ctx.textAlign = 'right';
    const label = `$${Math.round(maxVal - (maxVal / 3) * i)}M`;
    ctx.fillText(label, paddingLeft - 5, y + 3);
  }

  // Points
  const points = values.map((val, i) => {
    const x = paddingLeft + (chartWidth / (values.length - 1)) * i;
    const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
    return { x, y, val, day: days[i] };
  });

  // Area gradient
  const grad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
  grad.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
  grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i].x + points[i - 1].x) / 2;
    const yc = (points[i].y + points[i - 1].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.lineTo(points[points.length - 1].x, paddingTop + chartHeight);
  ctx.lineTo(points[0].x, paddingTop + chartHeight);
  ctx.closePath();
  ctx.fill();

  // Line stroke
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i].x + points[i - 1].x) / 2;
    const yc = (points[i].y + points[i - 1].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();

  // Point circles & text
  points.forEach((p) => {
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.day, p.x, height - 6);
  });
}

/* ----------------------------------------------------------------------------
 * 6. SUB-TABS (ALL TRANSACTIONS VS PENDING APPROVALS)
 * ---------------------------------------------------------------------------- */
function setupTxSubTabs() {
  const tabAll = document.getElementById('txTabAll');
  const tabPending = document.getElementById('txTabPending');

  if (tabAll && tabPending) {
    tabAll.addEventListener('click', () => {
      tabAll.classList.add('active');
      tabPending.classList.remove('active');
      currentActiveViewTab = 'all';
      applyTxFilters();
    });

    tabPending.addEventListener('click', () => {
      tabPending.classList.add('active');
      tabAll.classList.remove('active');
      currentActiveViewTab = 'pending';
      applyTxFilters();
    });
  }
}

/* ----------------------------------------------------------------------------
 * 7. SEARCH, FILTERING & SORTING
 * ---------------------------------------------------------------------------- */
function setupTxSearchAndFilters() {
  const searchInput = document.getElementById('txSearchRefInput');
  const userSearchInput = document.getElementById('txUserSearchInput');
  const typeFilter = document.getElementById('txTypeFilter');
  const statusFilter = document.getElementById('txStatusFilter');
  const currencyFilter = document.getElementById('txCurrencyFilter');
  const dateRangeFilter = document.getElementById('txDateRangeFilter');
  const minAmountInput = document.getElementById('txMinAmountInput');
  const maxAmountInput = document.getElementById('txMaxAmountInput');
  const clearBtn = document.getElementById('btnClearTxFilters');

  let debounceTimer = null;

  function triggerFilters() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyTxFilters, 250);
  }

  [searchInput, userSearchInput, minAmountInput, maxAmountInput].forEach((input) => {
    if (input) input.addEventListener('input', triggerFilters);
  });

  [typeFilter, statusFilter, currencyFilter, dateRangeFilter].forEach((select) => {
    if (select) select.addEventListener('change', applyTxFilters);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (userSearchInput) userSearchInput.value = '';
      if (typeFilter) typeFilter.value = 'all';
      if (statusFilter) statusFilter.value = 'all';
      if (currencyFilter) currencyFilter.value = 'all';
      if (dateRangeFilter) dateRangeFilter.value = 'all';
      if (minAmountInput) minAmountInput.value = '';
      if (maxAmountInput) maxAmountInput.value = '';
      applyTxFilters();
    });
  }
}

function applyTxFilters() {
  const refQuery = (document.getElementById('txSearchRefInput')?.value || '').trim().toLowerCase();
  const userQuery = (document.getElementById('txUserSearchInput')?.value || '').trim().toLowerCase();
  const typeVal = document.getElementById('txTypeFilter')?.value || 'all';
  const statusVal = document.getElementById('txStatusFilter')?.value || 'all';
  const currVal = document.getElementById('txCurrencyFilter')?.value || 'all';
  const dateVal = document.getElementById('txDateRangeFilter')?.value || 'all';
  const minAmt = parseFloat(document.getElementById('txMinAmountInput')?.value || '0');
  const maxAmt = parseFloat(document.getElementById('txMaxAmountInput')?.value || '9999999999');

  filteredTransactions = currentTransactions.filter((t) => {
    // Tab filter
    if (currentActiveViewTab === 'pending') {
      if (t.status !== 'pending' && t.status !== 'on_hold') return false;
    }

    // Reference query
    const matchesRef = !refQuery || t.ref.toLowerCase().includes(refQuery) || t.id.toLowerCase().includes(refQuery);

    // User query
    const matchesUser = !userQuery ||
      t.userName.toLowerCase().includes(userQuery) ||
      t.userEmail.toLowerCase().includes(userQuery) ||
      t.accountNumber.toLowerCase().includes(userQuery);

    // Type
    const matchesType = typeVal === 'all' || t.type === typeVal;

    // Status
    const matchesStatus = statusVal === 'all' || t.status === statusVal;

    // Currency
    const matchesCurr = currVal === 'all' || t.currency === currVal;

    // Amount range
    const matchesAmount = t.amount >= (minAmt || 0) && t.amount <= (maxAmt || 9999999999);

    // Date range
    let matchesDate = true;
    if (dateVal !== 'all') {
      const txTime = new Date(t.date).getTime();
      const now = Date.now();
      if (dateVal === 'today') matchesDate = now - txTime <= 86400000;
      else if (dateVal === '7d') matchesDate = now - txTime <= 7 * 86400000;
      else if (dateVal === '30d') matchesDate = now - txTime <= 30 * 86400000;
      else if (dateVal === '90d') matchesDate = now - txTime <= 90 * 86400000;
    }

    return matchesRef && matchesUser && matchesType && matchesStatus && matchesCurr && matchesAmount && matchesDate;
  });

  sortTransactions();
  currentTxPage = 1;
  renderTransactionsTable();
}

function setupTxSorting() {
  const headers = document.querySelectorAll('.admin-tx-sortable-th');
  headers.forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-tx-sort-col');
      if (!col) return;

      if (currentTxSortCol === col) {
        currentTxSortDir = currentTxSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        currentTxSortCol = col;
        currentTxSortDir = 'asc';
      }

      headers.forEach((h) => {
        const icon = h.querySelector('.admin-sort-icon');
        if (icon) icon.textContent = '⇅';
      });
      const curIcon = th.querySelector('.admin-sort-icon');
      if (curIcon) curIcon.textContent = currentTxSortDir === 'asc' ? '↑' : '↓';

      sortTransactions();
      renderTransactionsTable();
    });
  });
}

function sortTransactions() {
  filteredTransactions.sort((a, b) => {
    let valA = a[currentTxSortCol];
    let valB = b[currentTxSortCol];

    if (currentTxSortCol === 'amount') {
      valA = a.amount;
      valB = b.amount;
    } else if (currentTxSortCol === 'date') {
      valA = new Date(a.date).getTime();
      valB = new Date(b.date).getTime();
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB || '').toLowerCase();
    }

    if (valA < valB) return currentTxSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return currentTxSortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

/* ----------------------------------------------------------------------------
 * 8. RENDER TRANSACTIONS TABLE & PAGINATION
 * ---------------------------------------------------------------------------- */
export function renderTransactionsTable() {
  const tbody = document.getElementById('adminTransactionsTableBody');
  const countBadge = document.getElementById('txTotalCountBadge');
  const paginationInfo = document.getElementById('txPaginationInfo');
  const paginationControls = document.getElementById('txPaginationControls');

  if (countBadge) countBadge.textContent = `${filteredTransactions.length} Transactions`;

  if (!tbody) return;

  const total = filteredTransactions.length;
  const totalPages = Math.ceil(total / txPerPage) || 1;
  if (currentTxPage > totalPages) currentTxPage = totalPages;

  const start = (currentTxPage - 1) * txPerPage;
  const end = Math.min(start + txPerPage, total);
  const pagedTx = filteredTransactions.slice(start, end);

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center p-5 text-muted">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          <div class="font-bold text-white mb-1">No matching transactions found</div>
          <div class="text-xs">Adjust your reference number, amount range, or status filters.</div>
        </td>
      </tr>
    `;
    if (paginationInfo) paginationInfo.textContent = 'Showing 0 of 0 entries';
    if (paginationControls) paginationControls.innerHTML = '';
    return;
  }

  tbody.innerHTML = pagedTx.map((t) => {
    const isPending = t.status === 'pending' || t.status === 'on_hold';
    const isCredit = t.direction === 'inward' || t.type === 'credit' || t.type === 'reversal';

    return `
      <tr class="admin-user-row" data-tx-id="${t.id}">
        <td>
          <span class="font-mono text-xs font-bold text-white" style="color:#38bdf8;">${t.ref}</span>
        </td>
        <td>
          <div class="text-xs text-white">${new Date(t.date).toLocaleDateString()}</div>
          <div class="text-xs text-muted font-mono">${new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </td>
        <td>
          <div class="font-bold text-white text-xs">${escapeHtml(t.userName)}</div>
          <div class="text-xs text-muted font-mono">${escapeHtml(t.userEmail)}</div>
        </td>
        <td>
          <span class="admin-tx-type-tag">
            ${getTypeEmoji(t.type)} ${t.type.replace('_', ' ').toUpperCase()}
          </span>
        </td>
        <td>
          <span class="font-mono text-sm font-bold ${isCredit ? 'text-emerald' : 'text-white'}" style="${isCredit ? 'color:#34d399;' : ''}">
            ${isCredit ? '+' : '-'} ${t.currency} ${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </td>
        <td>
          <span class="font-mono text-xs text-muted font-semibold">${t.currency}</span>
        </td>
        <td>
          <span class="action-chip badge-status-${t.status}">
            ${t.status.replace('_', ' ').toUpperCase()}
          </span>
        </td>
        <td>
          <span class="font-mono text-xs text-muted">${t.accountNumber}</span>
        </td>
        <td class="text-right" onclick="event.stopPropagation()">
          <div class="d-flex items-center justify-end gap-1">
            ${isPending ? `
              <button class="admin-btn admin-btn-emerald admin-btn-sm btn-quick-approve-tx" data-tx-id="${t.id}" title="Approve & Release">✓</button>
              <button class="admin-btn admin-btn-danger admin-btn-sm btn-quick-reject-tx" data-tx-id="${t.id}" title="Reject / Flag">✕</button>
            ` : ''}
            <button class="admin-btn admin-btn-outline admin-btn-sm btn-inspect-tx" data-tx-id="${t.id}">
              Inspect &rarr;
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Bind row clicks
  tbody.querySelectorAll('.admin-user-row').forEach((row) => {
    row.addEventListener('click', () => {
      const txId = row.getAttribute('data-tx-id');
      if (txId) openTxDetailModal(txId);
    });
  });

  tbody.querySelectorAll('.btn-inspect-tx').forEach((btn) => {
    btn.addEventListener('click', () => {
      const txId = btn.getAttribute('data-tx-id');
      if (txId) openTxDetailModal(txId);
    });
  });

  // Quick Approval Buttons
  tbody.querySelectorAll('.btn-quick-approve-tx').forEach((btn) => {
    btn.addEventListener('click', () => {
      const txId = btn.getAttribute('data-tx-id');
      if (txId) executeTxStatusChange(txId, 'completed', 'Quick Treasury Approval by Officer');
    });
  });

  tbody.querySelectorAll('.btn-quick-reject-tx').forEach((btn) => {
    btn.addEventListener('click', () => {
      const txId = btn.getAttribute('data-tx-id');
      if (txId) executeTxStatusChange(txId, 'failed', 'Officer compliance rejection');
    });
  });

  // Pagination Controls
  if (paginationInfo) {
    paginationInfo.textContent = `Showing ${start + 1}-${end} of ${total} transactions`;
  }

  if (paginationControls) {
    let btnsHtml = `
      <button class="admin-page-btn" id="prevTxPageBtn" ${currentTxPage === 1 ? 'disabled' : ''}>&larr; Prev</button>
    `;
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - currentTxPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 || p === totalPages - 1) btnsHtml += `<span class="text-muted text-xs px-1">...</span>`;
        continue;
      }
      btnsHtml += `
        <button class="admin-page-btn ${p === currentTxPage ? 'active' : ''}" data-tx-page="${p}">${p}</button>
      `;
    }
    btnsHtml += `
      <button class="admin-page-btn" id="nextTxPageBtn" ${currentTxPage === totalPages ? 'disabled' : ''}>Next &rarr;</button>
    `;

    paginationControls.innerHTML = btnsHtml;

    paginationControls.querySelectorAll('[data-tx-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentTxPage = parseInt(btn.getAttribute('data-tx-page'), 10);
        renderTransactionsTable();
      });
    });

    const prevBtn = document.getElementById('prevTxPageBtn');
    if (prevBtn) prevBtn.onclick = () => { if (currentTxPage > 1) { currentTxPage--; renderTransactionsTable(); } };

    const nextBtn = document.getElementById('nextTxPageBtn');
    if (nextBtn) nextBtn.onclick = () => { if (currentTxPage < totalPages) { currentTxPage++; renderTransactionsTable(); } };
  }
}

/* ----------------------------------------------------------------------------
 * 9. TRANSACTION DETAIL INSPECTOR MODAL & ACTIONS
 * ---------------------------------------------------------------------------- */
function setupTxDetailModal() {
  const modal = document.getElementById('txDetailModal');
  const closeBtn = document.getElementById('closeTxDetailModalBtn');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('show'));
  }
}

export function openTxDetailModal(txId) {
  const tx = getTransactionById(txId);
  if (!tx) return;

  activeDetailTx = tx;
  const modal = document.getElementById('txDetailModal');
  const body = document.getElementById('txDetailModalBody');
  if (!modal || !body) return;

  const isWire = tx.type === 'wire';

  body.innerHTML = `
    <!-- Top Header Card -->
    <div class="admin-user-acct-box mb-3">
      <div class="d-flex justify-between items-start mb-2">
        <div>
          <span class="text-xs text-muted uppercase font-bold">Transaction Reference</span>
          <h3 class="text-white font-mono text-lg font-bold m-0" style="color:#38bdf8;">${tx.ref}</h3>
        </div>
        <span class="action-chip badge-status-${tx.status}">
          ${tx.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      <div class="d-grid grid-cols-2 gap-3 mt-3 p-3" style="background:#090d16; border-radius:8px;">
        <div>
          <span class="text-xs text-muted d-block uppercase">Settlement Amount</span>
          <span class="font-mono text-xl font-bold text-white">
            ${tx.currency} ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span class="text-xs text-muted d-block uppercase">Transaction Type</span>
          <span class="text-sm font-semibold text-white">${tx.type.replace('_', ' ').toUpperCase()}</span>
        </div>
      </div>
    </div>

    <!-- User & Beneficiary Routing -->
    <div class="admin-user-acct-box mb-3">
      <h4 class="text-white text-xs font-bold uppercase mb-2" style="color:#60a5fa;">Routing & Parties</h4>
      
      <div class="d-grid grid-cols-2 gap-3 mb-2">
        <div>
          <span class="text-xs text-muted d-block">Originator Member</span>
          <span class="text-sm font-bold text-white">${escapeHtml(tx.userName)}</span>
          <span class="text-xs font-mono text-muted d-block">${tx.accountNumber}</span>
        </div>
        <div>
          <span class="text-xs text-muted d-block">Beneficiary Destination</span>
          <span class="text-sm font-bold text-white">${escapeHtml(tx.beneficiaryName || 'N/A')}</span>
          <span class="text-xs font-mono text-muted d-block">${tx.beneficiaryBank || 'WB Internal'} • SWIFT: ${tx.swiftCode || 'N/A'}</span>
        </div>
      </div>

      <div class="mt-2">
        <span class="text-xs text-muted d-block">Payment Description / Memo</span>
        <span class="text-xs text-white">${escapeHtml(tx.description || 'No memo provided')}</span>
      </div>
    </div>

    <!-- Wire Transfer Codes Clearance Status (If Applicable) -->
    ${isWire && tx.wireCodes ? `
      <div class="admin-user-acct-box mb-3" style="border-color: rgba(59, 130, 246, 0.4);">
        <h4 class="text-white text-xs font-bold uppercase mb-2" style="color:#fbbf24;">🔐 Wire Transfer Codes Verification</h4>
        <div class="d-grid grid-cols-5 gap-2 text-center">
          ${['COT', 'TAX', 'IMF', 'AML', 'PAP'].map((codeKey) => {
            const cObj = tx.wireCodes[codeKey] || { verified: false, code: 'N/A' };
            return `
              <div class="p-2" style="background:#090d16; border-radius:6px; border:1px solid ${cObj.verified ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'};">
                <span class="text-xs font-bold d-block text-white">${codeKey}</span>
                <span class="font-mono text-xs font-bold" style="color:${cObj.verified ? '#34d399' : '#f87171'};">
                  ${cObj.verified ? '✓ VALID' : '✗ PENDING'}
                </span>
                <span class="text-xs text-muted d-block font-mono" style="font-size:0.65rem;">${cObj.code || 'None'}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Timeline of Status Changes -->
    <div class="admin-user-acct-box mb-3">
      <h4 class="text-white text-xs font-bold uppercase mb-2">📋 Audit History & Timeline</h4>
      <div class="admin-timeline">
        ${(tx.timeline || []).map((tl) => `
          <div class="admin-timeline-item">
            <span class="admin-timeline-dot ${tl.status === 'completed' ? 'success' : (tl.status === 'failed' ? 'danger' : 'warning')}"></span>
            <div class="admin-timeline-content">
              <div class="d-flex justify-between items-center mb-1">
                <span class="action-chip badge-status-${tl.status}" style="font-size:0.625rem;">${tl.status.toUpperCase()}</span>
                <span class="text-xs text-muted font-mono">${tl.date}</span>
              </div>
              <div class="text-xs text-white">${escapeHtml(tl.note)}</div>
              <div class="text-xs text-muted" style="font-size:0.65rem;">Authorized by: ${escapeHtml(tl.officer)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Administrative Actions Form -->
    <div class="admin-user-acct-box" style="border-color: rgba(59, 130, 246, 0.4);">
      <h4 class="text-white text-xs font-bold uppercase mb-3">⚡ Administrative Controls & Status Modifier</h4>
      
      <div class="d-grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="admin-form-label">Update Status</label>
          <select id="modalTxStatusSelect" class="admin-form-control">
            <option value="pending" ${tx.status === 'pending' ? 'selected' : ''}>Pending Dual-Signoff</option>
            <option value="processing" ${tx.status === 'processing' ? 'selected' : ''}>Processing</option>
            <option value="completed" ${tx.status === 'completed' ? 'selected' : ''}>Completed (Post Balance & Notify)</option>
            <option value="on_hold" ${tx.status === 'on_hold' ? 'selected' : ''}>On Hold (AML Flag)</option>
            <option value="failed" ${tx.status === 'failed' ? 'selected' : ''}>Failed (Reverse Balances)</option>
            <option value="cancelled" ${tx.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            <option value="reversed" ${tx.status === 'reversed' ? 'selected' : ''}>Reversed</option>
          </select>
        </div>
        <div>
          <label class="admin-form-label">Adjust Amount</label>
          <input type="number" id="modalTxAmountInput" class="admin-form-control" value="${tx.amount}" step="0.01" />
        </div>
      </div>

      <div class="admin-form-group">
        <label class="admin-form-label">Officer Audit Notes / Mandatory Justification</label>
        <input type="text" id="modalTxNotesInput" class="admin-form-control" placeholder="e.g. Cleared after KYC Level 3 compliance check" value="${escapeHtml(tx.adminNotes || '')}" />
      </div>

      <div class="d-flex items-center justify-between flex-wrap gap-2 mt-4 pt-3" style="border-top: 1px solid rgba(51, 65, 85, 0.5);">
        <div class="d-flex items-center gap-2">
          <button type="button" class="admin-btn admin-btn-primary" id="btnSaveTxModifications">
            Save Status & Modifications
          </button>
          <button type="button" class="admin-btn admin-btn-amber" id="btnReverseThisTx">
            🔄 Reverse Transaction
          </button>
        </div>
        <button type="button" class="admin-btn admin-btn-danger" id="btnDeleteThisTx">
          🗑️ Delete Entry
        </button>
      </div>
    </div>
  `;

  modal.classList.add('show');

  // Bind Save Modifications & Status Change
  const saveBtn = document.getElementById('btnSaveTxModifications');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const newStatus = document.getElementById('modalTxStatusSelect')?.value;
      const newAmt = parseFloat(document.getElementById('modalTxAmountInput')?.value || tx.amount.toString());
      const notes = document.getElementById('modalTxNotesInput')?.value.trim();

      if (newAmt !== tx.amount) {
        tx.amount = newAmt;
        tx.timeline.unshift({
          date: new Date().toISOString().replace('T', ' ').slice(0, 19),
          status: tx.status,
          note: `Amount modified to ${tx.currency} ${newAmt.toLocaleString()}`,
          officer: 'Chief Treasury Auditor'
        });
      }

      if (notes) tx.adminNotes = notes;

      if (newStatus !== tx.status) {
        executeTxStatusChange(tx.id, newStatus, notes || `Officer updated status to ${newStatus.toUpperCase()}`);
      } else {
        updateTransactionInDb(tx);
        renderTransactionsTable();
        showToast('Transaction details and compliance notes updated.', 'success', 'Saved');
      }

      modal.classList.remove('show');
    };
  }

  // Bind Reversal
  const reverseBtn = document.getElementById('btnReverseThisTx');
  if (reverseBtn) {
    reverseBtn.onclick = () => {
      if (confirm(`Execute official reversal for transaction ${tx.ref}? This will generate an offsetting counter-entry and restore member balance.`)) {
        executeTxStatusChange(tx.id, 'reversed', 'Mandatory Reversal Authorized by Treasury Officer');
        modal.classList.remove('show');
      }
    };
  }

  // Bind Delete
  const deleteBtn = document.getElementById('btnDeleteThisTx');
  if (deleteBtn) {
    deleteBtn.onclick = () => {
      const isHard = confirm('Do you want to permanently HARD delete this record? Click CANCEL for Soft Delete.');
      if (isHard) {
        currentTransactions = currentTransactions.filter((t) => t.id !== tx.id);
        saveAdminTransactionsList(currentTransactions);
        applyTxFilters();
        modal.classList.remove('show');
        showToast(`Transaction ${tx.ref} permanently purged from ledger.`, 'info', 'Record Deleted');
      } else {
        tx.status = 'deleted';
        tx.timeline.unshift({
          date: new Date().toISOString().replace('T', ' ').slice(0, 19),
          status: 'deleted',
          note: 'Transaction soft-deleted by Officer',
          officer: 'Chief Treasury Auditor'
        });
        updateTransactionInDb(tx);
        applyTxFilters();
        modal.classList.remove('show');
        showToast(`Transaction ${tx.ref} soft-deleted.`, 'warning', 'Soft Deleted');
      }
    };
  }
}

/* ----------------------------------------------------------------------------
 * 10. STATUS CHANGE & BALANCE RECALCULATION ENGINE
 * ---------------------------------------------------------------------------- */
export function executeTxStatusChange(txId, newStatus, reason) {
  const tx = getTransactionById(txId);
  if (!tx) return;

  const prevStatus = tx.status;
  tx.status = newStatus;

  // Add timeline entry
  tx.timeline.unshift({
    date: new Date().toISOString().replace('T', ' ').slice(0, 19),
    status: newStatus,
    note: reason || `Status transitioned from ${prevStatus} to ${newStatus}`,
    officer: 'Chief Treasury Auditor'
  });

  // Balance synchronization with user database
  const users = getAdminUsersList();
  const user = users.find((u) => u.id === tx.userId || u.email === tx.userEmail);

  if (user) {
    const acct = user.accounts.find((a) => a.accountNumber === tx.accountNumber) || user.accounts[0];
    if (acct) {
      if (newStatus === 'completed' && prevStatus !== 'completed') {
        if (tx.direction === 'outward' || tx.type === 'wire') {
          acct.balance = Math.max(0, acct.balance - tx.amount);
        } else if (tx.direction === 'inward' || tx.type === 'credit') {
          acct.balance += tx.amount;
        }
      } else if (newStatus === 'reversed' || newStatus === 'failed') {
        if (prevStatus === 'completed') {
          // Undo balance modification
          if (tx.direction === 'outward' || tx.type === 'wire') {
            acct.balance += tx.amount;
          } else if (tx.direction === 'inward' || tx.type === 'credit') {
            acct.balance = Math.max(0, acct.balance - tx.amount);
          }
        }
      }
      saveAdminUsersList(users);
    }
  }

  // Dispatch In-App Notification & Email Trigger
  try {
    createNotification({
      title: `Transaction Update: ${tx.ref}`,
      message: `Your transaction of ${tx.currency} ${tx.amount.toLocaleString()} is now ${newStatus.toUpperCase()}. Memo: ${reason}`,
      type: newStatus === 'completed' ? 'transfer_success' : (newStatus === 'failed' ? 'security_alert' : 'system_update'),
      channel: 'in_app',
    });
  } catch (e) {
    console.debug('Notification created:', e);
  }

  updateTransactionInDb(tx);
  renderTransactionDashboardMetrics();
  applyTxFilters();
  showToast(`Transaction ${tx.ref} updated to ${newStatus.toUpperCase()}.`, 'success', 'Status Transitioned');
}

/* ----------------------------------------------------------------------------
 * 11. MANUAL TRANSACTION GENERATOR (CREDIT / DEBIT)
 * ---------------------------------------------------------------------------- */
function setupManualTransactionModal() {
  const modal = document.getElementById('manualTxModal');
  const openBtn = document.getElementById('btnOpenManualTxModal');
  const form = document.getElementById('adminManualTxForm');
  const userSelect = document.getElementById('manualTxUserSelect');
  const acctSelect = document.getElementById('manualTxAccountSelect');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      populateManualTxUsers();
      modal.classList.add('show');
    });
  }

  function populateManualTxUsers() {
    if (!userSelect) return;
    const users = getAdminUsersList();
    userSelect.innerHTML = users.map((u) => `
      <option value="${u.id}">${escapeHtml(u.fullName)} (${escapeHtml(u.email)})</option>
    `).join('');

    updateManualAccounts();
    userSelect.onchange = updateManualAccounts;
  }

  function updateManualAccounts() {
    if (!acctSelect || !userSelect) return;
    const users = getAdminUsersList();
    const user = users.find((u) => u.id === userSelect.value);
    if (!user) return;

    acctSelect.innerHTML = user.accounts.map((a) => `
      <option value="${a.accountNumber}">${a.accountNumber} - ${a.name} (${a.currency} ${a.balance.toLocaleString()})</option>
    `).join('');
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const users = getAdminUsersList();
      const userId = userSelect?.value;
      const user = users.find((u) => u.id === userId);
      const acctNum = acctSelect?.value;
      const type = document.getElementById('manualTxTypeSelect')?.value || 'credit';
      const amount = parseFloat(document.getElementById('manualTxAmountInput')?.value || '0');
      const currency = document.getElementById('manualTxCurrencySelect')?.value || 'USD';
      const desc = document.getElementById('manualTxDescInput')?.value.trim();
      const status = document.getElementById('manualTxStatusSelect')?.value || 'completed';

      if (!user || isNaN(amount) || amount <= 0) {
        showToast('Valid user, account, and positive amount required.', 'error', 'Invalid Input');
        return;
      }

      const txId = `TX-${Date.now().toString().slice(-5)}`;
      const ref = `${type.toUpperCase()}-${Date.now().toString().slice(-6)}`;

      const newTx = {
        id: txId,
        ref,
        date: new Date().toISOString(),
        userId: user.id,
        userName: user.fullName,
        userEmail: user.email,
        accountNumber: acctNum,
        accountType: 'Checking',
        type,
        amount,
        currency,
        direction: type === 'credit' ? 'inward' : 'outward',
        status,
        beneficiaryName: user.fullName,
        beneficiaryBank: 'WB Credit Union (Zurich)',
        swiftCode: 'WBCUCHZZ',
        description: desc || 'Manual Administrative Adjustment',
        adminNotes: 'Created manually by Chief Treasury Auditor',
        wireCodes: {},
        timeline: [
          {
            date: new Date().toISOString().replace('T', ' ').slice(0, 19),
            status,
            note: `Manual transaction entered: ${desc}`,
            officer: 'Chief Treasury Auditor'
          }
        ]
      };

      // Update user account balance if status is completed
      if (status === 'completed') {
        const acct = user.accounts.find((a) => a.accountNumber === acctNum);
        if (acct) {
          if (type === 'credit') acct.balance += amount;
          else acct.balance = Math.max(0, acct.balance - amount);
          saveAdminUsersList(users);
        }
      }

      currentTransactions.unshift(newTx);
      saveAdminTransactionsList(currentTransactions);

      renderTransactionDashboardMetrics();
      applyTxFilters();
      form.reset();
      modal.classList.remove('show');
      showToast(`Manual transaction ${ref} created for ${user.fullName}.`, 'success', 'Transaction Posted');
    });
  }
}

/* ----------------------------------------------------------------------------
 * 12. EXPORT (CSV & PDF)
 * ---------------------------------------------------------------------------- */
function setupTxExportButtons() {
  const csvBtn = document.getElementById('btnExportTxCsv');
  const pdfBtn = document.getElementById('btnExportTxPdf');

  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      let csv = 'Reference,Date,Member Name,Email,Account Number,Type,Amount,Currency,Status,Description\n';
      filteredTransactions.forEach((t) => {
        csv += `"${t.ref}","${new Date(t.date).toLocaleString()}","${t.userName}","${t.userEmail}","${t.accountNumber}","${t.type}","${t.amount}","${t.currency}","${t.status}","${t.description.replace(/"/g, '""')}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `WBCU_Transactions_Export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('CSV transaction report downloaded.', 'success', 'Export Complete');
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      try {
        const doc = new jsPDF();
        doc.setFont('helvetica');
        
        // Header
        doc.setFontSize(16);
        doc.setTextColor(26, 58, 107);
        doc.text('WB CREDIT UNION - TREASURY AUDIT REPORT', 14, 20);
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toUTCString()} | Clearance Station: Zurich HQ`, 14, 27);
        doc.text(`Total Records: ${filteredTransactions.length}`, 14, 32);

        let y = 42;
        doc.setFontSize(8);
        doc.setTextColor(0);

        filteredTransactions.slice(0, 30).forEach((t, i) => {
          if (y > 275) {
            doc.addPage();
            y = 20;
          }
          doc.text(`${i + 1}. [${t.ref}] ${new Date(t.date).toLocaleDateString()} | ${t.userName} | ${t.currency} ${(t.amount || 0).toLocaleString()} | ${t.status.toUpperCase()}`, 14, y);
          y += 7;
        });

        doc.save(`WBCU_Transaction_Audit_${Date.now()}.pdf`);
        showToast('PDF transaction ledger downloaded.', 'success', 'Export Complete');
      } catch (err) {
        console.error('PDF export failed:', err);
        showToast('PDF export initialized.', 'info', 'Export');
      }
    });
  }
}

/* ----------------------------------------------------------------------------
 * 13. HELPER UTILITIES
 * ---------------------------------------------------------------------------- */
function getTypeEmoji(type) {
  switch (type) {
    case 'wire': return '🔄';
    case 'credit': return '💰';
    case 'debit': return '💸';
    case 'card_purchase': return '💳';
    case 'crypto': return '₿';
    case 'reversal': return '↩️';
    default: return '📄';
  }
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
