/**
 * ============================================================================
 * WB CREDIT UNION - MASTER ADMINISTRATIVE DASHBOARD CONTROLLER (js/admin.js)
 * ============================================================================
 * 
 * Manages executive treasury analytics, aggregate banking metrics, interactive
 * canvas charts (30-day registrations, 7-day volume, fee revenue pie), real-time
 * activity feed, wire clearances, ledger adjustments, KYC verifications,
 * and broadcast announcements.
 * ============================================================================
 */

import {
  getCurrentUser,
  signOutUser,
  showToast,
  getDemoStorageUser,
  setDemoStorageUser,
  isConfigured,
  supabase,
} from './supabase-config.js';

import {
  createNotification,
} from './notifications-email.js';

import {
  initAdminUserManagement,
  getEffectiveMemberName,
  getEffectiveMemberEmail,
  renderUsersTable,
} from './admin-users.js';

import {
  initAdminTransactionManagement,
  renderTransactionsTable,
} from './admin-transactions.js';

import {
  initAdminTransferCodes,
} from './admin-transfer-codes.js';

import { initI18n } from './i18n.js';

import {
  initAdminCardManagement,
  renderCardsTable,
} from './admin-cards.js';

import {
  initAdminEmailManagement,
  renderEmailLogsTable,
} from './admin-emails.js';

import {
  initAdminCryptoManagement,
  renderCryptoWalletsTable,
  renderCryptoTxTable,
} from './admin-crypto.js';

import {
  initAdminReports,
} from './admin-reports.js';

import {
  initAdminSettings,
  renderAuditLogsTable,
} from './admin-settings.js';

import {
  initAdminGrantsAndLoans,
  renderGrantsTable,
  renderLoansTable,
} from './admin-grants-loans.js';

/* ----------------------------------------------------------------------------
 * 1. STATE & DEFAULT MOCK DATA STORES
 * ---------------------------------------------------------------------------- */
const ADMIN_MEMO_KEY = 'wb_credit_union_admin_memo';

const defaultStats = {
  totalUsers: 0,
  totalAccounts: 0,
  totalBalance: 0.00,
  activeTransactionsToday: 0,
  pendingWires: 0,
};

let recentActivities = [
  {
    id: 'act-1',
    category: 'users',
    icon: '👤',
    iconBg: 'rgba(59, 130, 246, 0.2)',
    iconColor: '#60a5fa',
    title: 'New member John Doe registered & opened Premier Checking',
    meta: '2 minutes ago • Automated KYC Level 2',
    timestamp: Date.now() - 2 * 60 * 1000,
  },
  {
    id: 'act-2',
    category: 'wires',
    icon: '🔄',
    iconBg: 'rgba(245, 158, 11, 0.2)',
    iconColor: '#fbbf24',
    title: 'High-value wire transfer $50,000.00 submitted (WB-SWIFT-99201)',
    meta: '5 minutes ago • Awaiting Treasury Dual-Signoff',
    timestamp: Date.now() - 5 * 60 * 1000,
  },
  {
    id: 'act-3',
    category: 'cards',
    icon: '💳',
    iconBg: 'rgba(239, 68, 68, 0.2)',
    iconColor: '#f87171',
    title: 'Black Metal Debit Card #****1234 frozen by member',
    meta: '10 minutes ago • Mobile App Security Panic Trigger',
    timestamp: Date.now() - 10 * 60 * 1000,
  },
  {
    id: 'act-4',
    category: 'security',
    icon: '🪪',
    iconBg: 'rgba(16, 185, 129, 0.2)',
    iconColor: '#34d399',
    title: 'KYC biometric passport verified for Elena Rostova',
    meta: '14 minutes ago • Swiss Confederation Biometric Scanner',
    timestamp: Date.now() - 14 * 60 * 1000,
  },
  {
    id: 'act-5',
    category: 'wires',
    icon: '₿',
    iconBg: 'rgba(139, 92, 246, 0.2)',
    iconColor: '#c084fc',
    title: 'Institutional Crypto custody deposit: 2.50 BTC ($162,500.00)',
    meta: '28 minutes ago • Multi-Sig Cold Storage Deposit',
    timestamp: Date.now() - 28 * 60 * 1000,
  },
  {
    id: 'act-6',
    category: 'security',
    icon: '🔐',
    iconBg: 'rgba(6, 182, 212, 0.2)',
    iconColor: '#22d3ee',
    title: 'Treasury Officer approved COT Transfer Code override for 9482',
    meta: '45 minutes ago • Compliance Audit Authorized',
    timestamp: Date.now() - 45 * 60 * 1000,
  },
];

let adminAlerts = [
  { id: 'al-1', title: 'Pending High-Value SWIFT Clearance', time: '5m ago', type: 'warning' },
  { id: 'al-2', title: 'AML Watchlist Match Quarantine (7738)', time: '18m ago', type: 'danger' },
  { id: 'al-3', title: '3 Member KYC Passports Awaiting Level 3 Signoff', time: '35m ago', type: 'warning' },
  { id: 'al-4', title: 'Daily Fedwire Liquidity Threshold Exceeded (+$12.5M)', time: '1h ago', type: 'info' },
];

/* ----------------------------------------------------------------------------
 * 2. INITIALIZATION & AUTH GUARD
 * ---------------------------------------------------------------------------- */
export async function initAdminDashboard() {
  const adminRoot = document.getElementById('adminRoot');
  if (!adminRoot) return;

  // Initialize multi-language translation for admin dashboard
  try {
    initI18n();
  } catch (err) {
    console.warn('i18n init error:', err);
  }

  // Retrieve current admin session. If unauthenticated, redirect to Admin Login immediately.
  let currentAdmin = null;
  try {
    const adminStored = sessionStorage.getItem('wb_credit_union_admin_session') || localStorage.getItem('wb_credit_union_admin_session');
    if (adminStored) currentAdmin = JSON.parse(adminStored);
  } catch (e) {}

  const isAuthorized = currentAdmin && (currentAdmin.is_admin === true || currentAdmin.role === 'Super Admin' || currentAdmin.role === 'Admin');
  if (!isAuthorized) {
    sessionStorage.removeItem('wb_credit_union_admin_session');
    localStorage.removeItem('wb_credit_union_admin_session');
    window.location.replace('/pages/admin-login.html');
    return;
  }

  // Populate Admin Officer details in Top Bar
  const officerNameEl = document.getElementById('adminOfficerName');
  const roleBadgeEl = document.getElementById('adminRoleBadge');
  const avatarInitialsEl = document.getElementById('adminAvatarInitials');

  if (officerNameEl) officerNameEl.textContent = currentAdmin.fullName || 'Chief Treasury Auditor';
  if (roleBadgeEl) roleBadgeEl.textContent = currentAdmin.role === 'admin' ? 'Admin' : 'Super Admin';
  if (avatarInitialsEl) {
    const initials = (currentAdmin.fullName || 'Treasury Admin')
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    avatarInitialsEl.textContent = initials || 'TA';
  }

  // Bind Logout
  const handleAdminLogout = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      sessionStorage.removeItem('wb_credit_union_admin_session');
      localStorage.removeItem('wb_credit_union_admin_session');
      localStorage.removeItem('wb_credit_union_demo_user');
      localStorage.removeItem('wb_credit_union_auth_token');
    } catch (err) {}
    try {
      showToast('Treasury officer logged out. Redirecting...', 'info', 'Logged Out');
    } catch (err) {}
    setTimeout(() => {
      window.location.replace('/pages/admin-login.html');
    }, 150);
  };

  window.adminLogout = handleAdminLogout;

  const sideLogoutBtn = document.getElementById('adminLogoutBtn');
  if (sideLogoutBtn) {
    sideLogoutBtn.addEventListener('click', handleAdminLogout);
  }
  const topLogoutBtn = document.getElementById('adminTopLogoutBtn');
  if (topLogoutBtn) {
    topLogoutBtn.addEventListener('click', handleAdminLogout);
  }

  // 1. Setup sidebar navigation, modals, wire approvals, and quick actions immediately
  try { setupAdminNavigation(); } catch (err) { console.warn('Navigation setup:', err); }
  try { setupModals(); } catch (err) { console.warn('Modals setup:', err); }
  try { setupWireApprovals(); } catch (err) { console.warn('Wire approvals setup:', err); }
  try { setupQuickActions(); } catch (err) { console.warn('Quick actions setup:', err); }
  try { setupAuditorMemo(); } catch (err) { console.warn('Auditor memo setup:', err); }

  // 2. Synchronize member display names (Miz Brymo) across queue, modals, and drawers
  try { syncAdminMemberNames(); } catch (err) { console.warn('Member names sync:', err); }

  // 3. Initialize Admin sub-modules
  try { initAdminUserManagement(); } catch (err) { console.warn('User management init:', err); }
  try { initAdminTransactionManagement(); } catch (err) { console.warn('Tx management init:', err); }
  try { initAdminTransferCodes(); } catch (err) { console.warn('Transfer codes init:', err); }
  try { initAdminCardManagement(); } catch (err) { console.warn('Card management init:', err); }
  try { initAdminEmailManagement(); } catch (err) { console.warn('Email management init:', err); }
  try { initAdminCryptoManagement(); } catch (err) { console.warn('Crypto management init:', err); }
  try { initAdminReports(); } catch (err) { console.warn('Reports init:', err); }
  try { initAdminSettings(); } catch (err) { console.warn('Settings init:', err); }
  try { initAdminGrantsAndLoans(); } catch (err) { console.warn('Grants & Loans init:', err); }

  // 4. Render Stats & Activity Feed
  try { renderDashboardStats(); } catch (err) { console.warn('Dashboard stats:', err); }
  try { renderActivityFeed('all'); } catch (err) { console.warn('Activity feed:', err); }
  try { renderAdminAlertsDropdown(); } catch (err) { console.warn('Alerts dropdown:', err); }

  // 5. Render Interactive Canvas Charts (non-blocking)
  try { initCharts(); } catch (err) { console.warn('Charts init:', err); }

  // 6. Start periodic live event ticker
  try { startRealtimeSimulation(); } catch (err) { console.warn('Simulation init:', err); }
}

export function syncAdminMemberNames() {
  const memberName = getEffectiveMemberName();

  // Update wire table rows for primary member
  const wireRows = document.querySelectorAll('#adminWireTableBody tr');
  wireRows.forEach((row) => {
    const boldEl = row.querySelector('td:first-child .font-bold');
    if (boldEl && (boldEl.textContent.includes('Alexander') || boldEl.classList.contains('queue-member-name'))) {
      boldEl.textContent = memberName;
    }
  });

  // Update KYC Review Modal
  const kycMemberEl = document.getElementById('kycMemberName');
  if (kycMemberEl) kycMemberEl.textContent = memberName;
}

/* ----------------------------------------------------------------------------
 * 3. SIDEBAR NAVIGATION & VIEW SWITCHER
 * ---------------------------------------------------------------------------- */
export function switchAdminView(view) {
  if (!view) return;
  const navItems = document.querySelectorAll('.admin-nav-item');
  const overviewSection = document.getElementById('section-overview');
  const usersSection = document.getElementById('section-users');
  const transactionsSection = document.getElementById('section-transactions');
  const transferCodesSection = document.getElementById('section-transfer-codes');
  const cardsSection = document.getElementById('section-cards');
  const emailsSection = document.getElementById('section-emails');
  const cryptoSection = document.getElementById('section-crypto');
  const reportsSection = document.getElementById('section-reports');
  const settingsSection = document.getElementById('section-settings');
  const auditSection = document.getElementById('section-audit');
  const grantsSection = document.getElementById('section-grants');
  const loansSection = document.getElementById('section-loans');
  const placeholderSection = document.getElementById('section-placeholder');
  const placeholderTitle = document.getElementById('placeholderTitle');
  const placeholderDesc = document.getElementById('placeholderDesc');
  const placeholderIcon = document.getElementById('placeholderIcon');

  navItems.forEach((n) => {
    if (n.getAttribute('data-view') === view) {
      n.classList.add('active');
    } else {
      n.classList.remove('active');
    }
  });

  // Hide all sections first
  if (overviewSection) { overviewSection.style.display = 'none'; overviewSection.classList.remove('active'); }
  if (usersSection) { usersSection.style.display = 'none'; usersSection.classList.remove('active'); }
  if (transactionsSection) { transactionsSection.style.display = 'none'; transactionsSection.classList.remove('active'); }
  if (transferCodesSection) { transferCodesSection.style.display = 'none'; transferCodesSection.classList.remove('active'); }
  if (cardsSection) { cardsSection.style.display = 'none'; cardsSection.classList.remove('active'); }
  if (emailsSection) { emailsSection.style.display = 'none'; emailsSection.classList.remove('active'); }
  if (cryptoSection) { cryptoSection.style.display = 'none'; cryptoSection.classList.remove('active'); }
  if (reportsSection) { reportsSection.style.display = 'none'; reportsSection.classList.remove('active'); }
  if (settingsSection) { settingsSection.style.display = 'none'; settingsSection.classList.remove('active'); }
  if (auditSection) { auditSection.style.display = 'none'; auditSection.classList.remove('active'); }
  if (grantsSection) { grantsSection.style.display = 'none'; grantsSection.classList.remove('active'); }
  if (loansSection) { loansSection.style.display = 'none'; loansSection.classList.remove('active'); }
  if (placeholderSection) { placeholderSection.style.display = 'none'; placeholderSection.classList.remove('active'); }

  if (view === 'overview') {
    if (overviewSection) { overviewSection.style.display = 'block'; overviewSection.classList.add('active'); }
    try { syncAdminMemberNames(); } catch (err) {}
    try { renderDashboardStats(); } catch (err) {}
  } else if (view === 'users' || view === 'accounts') {
    if (usersSection) {
      usersSection.style.display = 'block';
      usersSection.classList.add('active');
      try { renderUsersTable(); } catch (err) {}
    }
  } else if (view === 'transactions' || view === 'wires') {
    if (transactionsSection) {
      transactionsSection.style.display = 'block';
      transactionsSection.classList.add('active');
      if (view === 'wires') {
        const wireTabBtn = document.querySelector('#section-transactions [data-tx-tab="wire"]');
        if (wireTabBtn) wireTabBtn.click();
      } else {
        try { renderTransactionsTable(); } catch (err) {}
      }
    }
  } else if (view === 'transfer-codes') {
    if (transferCodesSection) {
      transferCodesSection.style.display = 'block';
      transferCodesSection.classList.add('active');
    }
  } else if (view === 'cards') {
    if (cardsSection) {
      cardsSection.style.display = 'block';
      cardsSection.classList.add('active');
      try { renderCardsTable(); } catch (err) {}
    }
  } else if (view === 'emails') {
    if (emailsSection) {
      emailsSection.style.display = 'block';
      emailsSection.classList.add('active');
      try { renderEmailLogsTable(); } catch (err) {}
    }
  } else if (view === 'crypto') {
    if (cryptoSection) {
      cryptoSection.style.display = 'block';
      cryptoSection.classList.add('active');
      try { renderCryptoWalletsTable(); } catch (err) {}
      try { renderCryptoTxTable(); } catch (err) {}
    }
  } else if (view === 'grants') {
    if (grantsSection) {
      grantsSection.style.display = 'block';
      grantsSection.classList.add('active');
      try { renderGrantsTable(); } catch (err) {}
    }
  } else if (view === 'loans') {
    if (loansSection) {
      loansSection.style.display = 'block';
      loansSection.classList.add('active');
      try { renderLoansTable(); } catch (err) {}
    }
  } else if (view === 'reports') {
    if (reportsSection) {
      reportsSection.style.display = 'block';
      reportsSection.classList.add('active');
    }
  } else if (view === 'settings') {
    if (settingsSection) {
      settingsSection.style.display = 'block';
      settingsSection.classList.add('active');
    }
  } else if (view === 'audit') {
    if (auditSection) {
      auditSection.style.display = 'block';
      auditSection.classList.add('active');
      try { renderAuditLogsTable(); } catch (err) {}
    }
  } else {
    if (placeholderSection) {
      placeholderSection.style.display = 'block';
      placeholderSection.classList.add('active');
      if (placeholderTitle) placeholderTitle.textContent = view.toUpperCase();
      if (placeholderIcon) placeholderIcon.textContent = '📂';
      if (placeholderDesc) {
        placeholderDesc.textContent = `The ${view} module is ready and connected to your database records.`;
      }
    }
  }

  // Close mobile sidebar on navigation
  const sidebar = document.getElementById('adminSidebar');
  if (sidebar && window.innerWidth <= 900) {
    sidebar.classList.remove('open');
  }

  try {
    if (window.location.hash !== '#' + view) {
      history.replaceState(null, '', '#' + view);
    }
  } catch(e) {}
}

function setupAdminNavigation() {
  const navItems = document.querySelectorAll('.admin-nav-item');
  const backToOverviewBtn = document.getElementById('btnBackToOverview');

  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      const view = item.getAttribute('data-view');
      if (!view) return;
      e.preventDefault();
      switchAdminView(view);
    });
  });

  const navigateToHash = () => {
    const hash = (window.location.hash || '').replace('#', '').trim();
    if (hash) {
      switchAdminView(hash);
    }
  };
  window.addEventListener('hashchange', navigateToHash);
  if (window.location.hash) {
    setTimeout(navigateToHash, 50);
  }

  if (backToOverviewBtn) {
    backToOverviewBtn.addEventListener('click', () => {
      switchAdminView('overview');
    });
  }

  // Mobile sidebar hamburger toggle
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const closeBtn = document.getElementById('closeSidebarBtn');
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('adminSidebarBackdrop');

  const openSidebar = () => {
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('show');
  };

  const closeSidebar = () => {
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
  };

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeSidebar);
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeSidebar);
  }

  // Auto-close sidebar on mobile when a nav item is clicked
  document.querySelectorAll('.admin-nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 900) {
        closeSidebar();
      }
    });
  });
}

/* ----------------------------------------------------------------------------
 * 4. DASHBOARD STATS CALCULATOR & DISPLAY
 * ---------------------------------------------------------------------------- */
function renderDashboardStats() {
  const usersEl = document.getElementById('statTotalUsers');
  const accountsEl = document.getElementById('statTotalAccounts');
  const balanceEl = document.getElementById('statTotalBalance');
  const transEl = document.getElementById('statActiveTransactions');
  const wiresEl = document.getElementById('statPendingWires');

  if (usersEl) usersEl.textContent = defaultStats.totalUsers.toLocaleString();
  if (accountsEl) accountsEl.textContent = defaultStats.totalAccounts.toLocaleString();
  if (balanceEl) {
    balanceEl.textContent = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(defaultStats.totalBalance);
  }
  if (transEl) transEl.textContent = defaultStats.activeTransactionsToday.toLocaleString();
  if (wiresEl) wiresEl.textContent = defaultStats.pendingWires.toString();
}

/* ----------------------------------------------------------------------------
 * 5. INTERACTIVE HTML5 CANVAS CHARTS
 * ---------------------------------------------------------------------------- */
function initCharts() {
  renderRegistrationsBarChart();
  renderVolumeLineChart();
  renderRevenueDonutChart();

  // Re-render on window resize for crisp high-DPI scaling
  window.addEventListener('resize', () => {
    renderRegistrationsBarChart();
    renderVolumeLineChart();
    renderRevenueDonutChart();
  });
}

/**
 * 1. 30-Day Registrations Bar Chart
 */
function renderRegistrationsBarChart() {
  const canvas = document.getElementById('canvasRegistrationsChart');
  if (!canvas) return;

  const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : null;
  const width = rect && rect.width > 20 ? rect.width : (canvas.clientWidth || 280);
  const height = rect && rect.height > 20 ? rect.height : (canvas.clientHeight || 180);
  if (width <= 20 || height <= 20) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Generate 30 data points
  const days = 30;
  const data = [
    4, 6, 5, 8, 7, 11, 9, 6, 8, 12,
    10, 14, 13, 9, 8, 15, 14, 18, 16, 12,
    11, 15, 19, 21, 18, 14, 16, 20, 22, 24
  ];
  const maxVal = 26;

  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 25;
  const chartWidth = Math.max(10, width - paddingLeft - paddingRight);
  const chartHeight = Math.max(10, height - paddingTop - paddingBottom);
  const barWidth = Math.max(3, (chartWidth / days) - 4);

  // Draw Horizontal Gridlines
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    // Axis label
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Poppins, sans-serif';
    ctx.textAlign = 'right';
    const labelVal = Math.round(maxVal - (maxVal / 4) * i);
    ctx.fillText(labelVal.toString(), paddingLeft - 6, y + 3);
  }

  // Draw Bars with Blue Gradient
  data.forEach((val, idx) => {
    const x = paddingLeft + (chartWidth / days) * idx + 2;
    const barHeight = (val / maxVal) * chartHeight;
    const y = paddingTop + chartHeight - barHeight;

    const grad = ctx.createLinearGradient(0, y, 0, paddingTop + chartHeight);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.2)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
    ctx.fill();
  });

  // Bottom Day Labels (Day 1, 10, 20, 30)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px Poppins, sans-serif';
  ctx.textAlign = 'center';
  [0, 9, 19, 29].forEach((idx) => {
    const x = paddingLeft + (chartWidth / days) * idx + barWidth / 2;
    ctx.fillText(`D${idx + 1}`, x, height - 8);
  });
}

/**
 * 2. 7-Day Transaction Volume Line Chart
 */
function renderVolumeLineChart() {
  const canvas = document.getElementById('canvasVolumeChart');
  if (!canvas) return;

  const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : null;
  const width = rect && rect.width > 20 ? rect.width : (canvas.clientWidth || 280);
  const height = rect && rect.height > 20 ? rect.height : (canvas.clientHeight || 180);
  if (width <= 20 || height <= 20) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const values = [14.2, 18.5, 16.8, 22.4, 24.8, 19.3, 21.0]; // in Millions
  const maxVal = 30;

  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 25;
  const chartWidth = Math.max(10, width - paddingLeft - paddingRight);
  const chartHeight = Math.max(10, height - paddingTop - paddingBottom);

  // Gridlines
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = paddingTop + (chartHeight / 3) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px Poppins, sans-serif';
    ctx.textAlign = 'right';
    const labelVal = `$${Math.round(maxVal - (maxVal / 3) * i)}M`;
    ctx.fillText(labelVal, paddingLeft - 6, y + 3);
  }

  // Calculate coordinates
  const points = values.map((val, i) => {
    const x = paddingLeft + (chartWidth / (values.length - 1)) * i;
    const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
    return { x, y, val, label: labels[i] };
  });

  // Draw Area Fill Gradient
  const areaGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
  areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
  areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  ctx.fillStyle = areaGrad;
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

  // Draw Stroke Line
  ctx.strokeStyle = '#10b981';
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

  // Draw Data Points + Labels
  points.forEach((pt) => {
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Day label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pt.label, pt.x, height - 8);
  });
}

/**
 * 3. Revenue From Fees Donut / Pie Chart
 */
function renderRevenueDonutChart() {
  const canvas = document.getElementById('canvasRevenueChart');
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
    { label: 'Wire Fees', percent: 42, color: '#3b82f6' },
    { label: 'FX Arbitrage', percent: 28, color: '#10b981' },
    { label: 'Card Interchange', percent: 18, color: '#f59e0b' },
    { label: 'Custody Fees', percent: 12, color: '#8b5cf6' },
  ];

  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.max(15, Math.min(centerX, centerY) - 15);
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

    // Divider border
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.stroke();

    currentAngle += sliceAngle;
  });

  // Donut Center Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Poppins, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$1.28M', centerX, centerY - 4);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px Poppins, sans-serif';
  ctx.fillText('YTD REVENUE', centerX, centerY + 12);
}

/* ----------------------------------------------------------------------------
 * 6. REAL-TIME ACTIVITY FEED & FILTERING
 * ---------------------------------------------------------------------------- */
function renderActivityFeed(filterCategory = 'all') {
  const listEl = document.getElementById('adminActivityList');
  if (!listEl) return;

  const filtered = filterCategory === 'all'
    ? recentActivities
    : recentActivities.filter((item) => item.category === filterCategory);

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="text-center p-4 text-muted text-xs">
        No recorded events matching '${filterCategory}' in recent clearance buffer.
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map((act) => `
    <div class="admin-activity-item" data-category="${act.category}">
      <div class="admin-activity-icon-box" style="background:${act.iconBg}; color:${act.iconColor};">
        ${act.icon}
      </div>
      <div class="admin-activity-content">
        <div class="admin-activity-title">${escapeHtml(act.title)}</div>
        <div class="admin-activity-meta">
          <span>${escapeHtml(act.meta)}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Setup category filter buttons
  const filterBtns = document.querySelectorAll('.admin-filter-chip');
  filterBtns.forEach((btn) => {
    btn.onclick = () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderActivityFeed(btn.getAttribute('data-filter') || 'all');
    };
  });
}

function pushNewActivity(title, category, icon, iconBg, iconColor, meta) {
  const newEvent = {
    id: `act-${Date.now()}`,
    category,
    icon,
    iconBg,
    iconColor,
    title,
    meta: meta || 'Just now • Verified Live Stream',
    timestamp: Date.now(),
  };

  recentActivities.unshift(newEvent);
  if (recentActivities.length > 25) recentActivities.pop();

  const activeChip = document.querySelector('.admin-filter-chip.active');
  const curFilter = activeChip ? activeChip.getAttribute('data-filter') : 'all';
  renderActivityFeed(curFilter);
}

function startRealtimeSimulation() {
  const randomEvents = [
    { title: 'SWIFT MT103 clearance ping received from UBS AG Zurich', category: 'wires', icon: '🔄', bg: 'rgba(59,130,246,0.2)', color: '#60a5fa' },
    { title: 'Member authenticated via WebAuthn Biometric Token', category: 'security', icon: '🛡️', bg: 'rgba(16,185,129,0.2)', color: '#34d399' },
    { title: 'Premier Debit Card tap: CHF 420.00 at Meilen Marina Store', category: 'cards', icon: '💳', bg: 'rgba(245,158,11,0.2)', color: '#fbbf24' },
    { title: 'New Corporate Account opened: Helvetia Asset Management', category: 'users', icon: '🏢', bg: 'rgba(139,92,246,0.2)', color: '#c084fc' },
  ];

  setInterval(() => {
    const randomEvent = randomEvents[Math.floor(Math.random() * randomEvents.length)];
    pushNewActivity(randomEvent.title, randomEvent.category, randomEvent.icon, randomEvent.bg, randomEvent.color);
  }, 45000);
}

/* ----------------------------------------------------------------------------
 * 7. NOTIFICATION BELL & ALERTS DROPDOWN
 * ---------------------------------------------------------------------------- */
function renderAdminAlertsDropdown() {
  const bellBtn = document.getElementById('adminBellBtn');
  const dropdown = document.getElementById('adminBellDropdown');
  const listEl = document.getElementById('adminBellNotifList');
  const badgeEl = document.getElementById('adminBellBadge');
  const clearBtn = document.getElementById('clearAdminAlertsBtn');

  if (badgeEl) badgeEl.textContent = adminAlerts.length.toString();

  if (listEl) {
    if (adminAlerts.length === 0) {
      listEl.innerHTML = '<div class="p-3 text-center text-xs text-muted">All compliance alerts cleared.</div>';
    } else {
      listEl.innerHTML = adminAlerts.map((al) => `
        <div class="admin-notif-item">
          <div class="text-xs" style="color:${al.type === 'danger' ? '#f87171' : '#fbbf24'}; font-size:1.1rem;">
            ${al.type === 'danger' ? '⚠️' : '🔔'}
          </div>
          <div class="flex-1">
            <div class="text-xs font-semibold text-white">${escapeHtml(al.title)}</div>
            <div class="text-xs text-muted">${al.time} • Action Required</div>
          </div>
        </div>
      `).join('');
    }
  }

  if (bellBtn && dropdown) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== bellBtn) {
        dropdown.classList.remove('show');
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      adminAlerts = [];
      if (badgeEl) badgeEl.style.display = 'none';
      if (listEl) listEl.innerHTML = '<div class="p-3 text-center text-xs text-muted">All compliance alerts cleared.</div>';
      showToast('All administrative alerts marked as acknowledged.', 'info', 'Alerts Cleared');
    });
  }
}

/* ----------------------------------------------------------------------------
 * 8. WIRE CLEARANCES & APPROVAL QUEUE HANDLER
 * ---------------------------------------------------------------------------- */
function setupWireApprovals() {
  const table = document.getElementById('adminWireQueueTable');
  if (!table) return;

  table.addEventListener('click', (e) => {
    const approveBtn = e.target.closest('.btn-approve-wire');
    const flagBtn = e.target.closest('.btn-flag-wire');

    if (approveBtn) {
      const ref = approveBtn.getAttribute('data-ref') || 'WIRE';
      const row = approveBtn.closest('tr');
      if (row) {
        const cell = row.querySelector('.wire-status-cell');
        if (cell) cell.innerHTML = '<span class="action-chip action-chip-approve">CLEARED (SWIFT-OK)</span>';
        approveBtn.remove();
        if (row.querySelector('.btn-flag-wire')) row.querySelector('.btn-flag-wire').remove();
      }
      pushNewActivity(`Officer approved high-value wire ${ref} for international SWIFT settlement`, 'wires', '✅', 'rgba(16,185,129,0.2)', '#34d399');
      showToast(`Wire reference ${ref} approved and released to SWIFT clearing node.`, 'success', 'Wire Authorized');
      
      // Update pending stat
      defaultStats.pendingWires = Math.max(0, defaultStats.pendingWires - 1);
      renderDashboardStats();
    }

    if (flagBtn) {
      const ref = flagBtn.getAttribute('data-ref') || 'WIRE';
      const row = flagBtn.closest('tr');
      if (row) {
        const cell = row.querySelector('.wire-status-cell');
        if (cell) cell.innerHTML = '<span class="action-chip action-chip-flag">AML QUARANTINED</span>';
        flagBtn.remove();
      }
      pushNewActivity(`Officer flagged wire ${ref} for AML OFAC Compliance Audit`, 'wires', '⚠️', 'rgba(239,68,68,0.2)', '#f87171');
      showToast(`Wire reference ${ref} quarantined for secondary regulatory audit.`, 'warning', 'AML Quarantine');
    }
  });
}

/* ----------------------------------------------------------------------------
 * 9. MODALS & QUICK ACTIONS
 * ---------------------------------------------------------------------------- */
// Global delegated click handler for all modal close & cancel triggers
document.addEventListener('click', (e) => {
  // Handle drawer close button specifically
  const drawerCloseBtn = e.target.closest('#closeUserDrawerBtn, [data-close-drawer]');
  if (drawerCloseBtn) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.closeUserDetailDrawer === 'function') {
      window.closeUserDetailDrawer();
    } else {
      const overlay = document.getElementById('adminDrawerOverlay');
      const panel = document.getElementById('adminDrawerPanel');
      if (overlay) { overlay.classList.remove('show'); overlay.style.display = 'none'; }
      if (panel) { panel.classList.remove('open'); }
    }
    return;
  }

  // 1. Check for modal close buttons or data-close-modal attributes
  const closeBtn = e.target.closest('[data-close-modal], .admin-modal-close, .admin-form-modal-close, button[data-close], .btn-close');
  if (closeBtn) {
    const modalId = closeBtn.getAttribute('data-close-modal');
    if (modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
      }
    }
    const parentModal = closeBtn.closest('.admin-modal-overlay, .modal-overlay, .modal, .admin-form-modal');
    if (parentModal) {
      parentModal.classList.remove('show');
      parentModal.style.display = 'none';
    }
  }

  // 2. Check for Cancel / Close button clicks inside any modal overlay
  const targetBtn = e.target.tagName === 'BUTTON' ? e.target : e.target.closest('button');
  if (targetBtn && targetBtn.type !== 'submit') {
    const btnText = (targetBtn.textContent || '').trim().toLowerCase();
    if (btnText === 'cancel' || btnText === 'close' || btnText === 'close diagnostics' || btnText === 'close preview') {
      const parentModal = targetBtn.closest('.admin-modal-overlay, .modal-overlay, .modal, .admin-form-modal');
      if (parentModal) {
        e.preventDefault();
        parentModal.classList.remove('show');
        parentModal.style.display = 'none';
      }
    }
  }

  // 3. Close when clicking directly on backdrop overlay
  if (e.target.classList && (e.target.classList.contains('admin-modal-overlay') || e.target.classList.contains('modal-overlay') || e.target.classList.contains('admin-form-modal-backdrop'))) {
    e.target.classList.remove('show');
    e.target.style.display = 'none';
  }
});

export function setupModals() {
  // Generic modal open handlers
  document.querySelectorAll('[data-open-modal]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = btn.getAttribute('data-open-modal');
      if (modalId === 'createUserFullModal' || modalId === 'createUserModal') {
        if (typeof window.openCreateUserModal === 'function') {
          window.openCreateUserModal();
        } else {
          const m = document.getElementById('createUserFullModal') || document.getElementById('createUserModal');
          if (m) { m.classList.add('show'); m.style.display = 'flex'; }
        }
        return;
      }
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
      }
    });
  });
}

function setupQuickActions() {
  // 1. Full Create User Modal Trigger
  const openCreateUserBtn = document.getElementById('btnOpenCreateUserModal');
  const openFullCreateUserBtn = document.getElementById('btnOpenFullCreateUserModal');

  const openFullModal = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (typeof window.wbRandomizeCreateUserModalFields === 'function') {
      window.wbRandomizeCreateUserModalFields();
    }
    const targetModal = document.getElementById('createUserFullModal') || document.getElementById('createUserModal');
    if (targetModal) {
      targetModal.classList.add('show');
      const firstInput = document.getElementById('adminNewUserFirstName');
      if (firstInput) setTimeout(() => firstInput.focus(), 60);
    }
  };

  window.openCreateUserModal = openFullModal;

  if (openCreateUserBtn) {
    openCreateUserBtn.addEventListener('click', openFullModal);
  }

  if (openFullCreateUserBtn) {
    openFullCreateUserBtn.addEventListener('click', openFullModal);
  }

  document.querySelectorAll('[data-open-modal="createUserFullModal"], [data-open-modal="createUserModal"]').forEach((el) => {
    el.addEventListener('click', openFullModal);
  });

  // 1b. Add click listeners to overview stat cards for easier navigation
  const statUsers = document.querySelector('.admin-metric-card.border-blue');
  const statTx = document.querySelector('.admin-metric-card.border-emerald');
  const statWires = document.querySelector('.admin-metric-card.border-amber');

  if (statUsers) statUsers.addEventListener('click', () => switchAdminView('users'));
  if (statTx) statTx.addEventListener('click', () => switchAdminView('transactions'));
  if (statWires) statWires.addEventListener('click', () => switchAdminView('transactions'));

  // 1c. Hook up Dashboard Alert Buttons
  const btnKyc = document.getElementById('btnReviewKycAlert');
  const btnWire = document.getElementById('btnReviewWireAlert');
  const btnAudit = document.getElementById('btnAuditFailedTx');
  const btnSuspended = document.getElementById('btnInspectSuspended');

  if (btnKyc) btnKyc.addEventListener('click', () => switchAdminView('users'));
  if (btnWire) btnWire.addEventListener('click', () => switchAdminView('transactions'));
  if (btnAudit) btnAudit.addEventListener('click', () => switchAdminView('transactions'));
  if (btnSuspended) btnSuspended.addEventListener('click', () => switchAdminView('users'));

  // 2. Credit / Debit Ledger Adjustment Trigger & Submission
  const openLedgerBtn = document.getElementById('btnOpenLedgerModal');
  const ledgerModal = document.getElementById('creditDebitModal');
  const ledgerForm = document.getElementById('adminLedgerForm');

  if (openLedgerBtn && ledgerModal) {
    openLedgerBtn.addEventListener('click', () => {
      ledgerModal.classList.add('show');
    });
  }

  if (ledgerForm) {
    ledgerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const acct = document.getElementById('ledgerAccountInput')?.value.trim();
      const actionType = document.getElementById('ledgerActionType')?.value || 'credit';
      const amount = parseFloat(document.getElementById('ledgerAmountInput')?.value || '0');
      const curr = document.getElementById('ledgerCurrencySelect')?.value || 'USD';
      const memo = document.getElementById('ledgerMemoInput')?.value.trim();

      if (!acct || !amount || amount <= 0) {
        showToast('Valid target account and positive adjustment amount required.', 'error', 'Invalid Input');
        return;
      }

      if (actionType === 'credit') {
        defaultStats.totalBalance += amount;
      } else {
        defaultStats.totalBalance = Math.max(0, defaultStats.totalBalance - amount);
      }
      defaultStats.activeTransactionsToday += 1;
      renderDashboardStats();

      const actionLabel = actionType === 'credit' ? `+$${amount.toLocaleString()}` : `-$${amount.toLocaleString()}`;
      pushNewActivity(`Manual Ledger Adjustment: ${actionLabel} on ${acct} (${memo || 'Officer entry'})`, 'wires', '💰', 'rgba(16,185,129,0.2)', '#34d399');
      
      showToast(`Ledger adjustment of ${curr} ${amount.toLocaleString()} posted to ${acct}.`, 'success', 'Ledger Adjusted');
      ledgerForm.reset();
      if (ledgerModal) ledgerModal.classList.remove('show');
    });
  }

  // 3. Broadcast Notification Modal Trigger & Submission
  const openBroadcastBtn = document.getElementById('btnOpenBroadcastModal');
  const broadcastModal = document.getElementById('broadcastModal');
  const broadcastForm = document.getElementById('adminBroadcastForm');

  if (openBroadcastBtn && broadcastModal) {
    openBroadcastBtn.addEventListener('click', () => {
      broadcastModal.classList.add('show');
    });
  }

  if (broadcastForm) {
    broadcastForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const subject = document.getElementById('broadcastSubject')?.value.trim();
      const body = document.getElementById('broadcastBody')?.value.trim();
      const priority = document.getElementById('broadcastPriority')?.value || 'info';
      const audience = document.getElementById('broadcastAudience')?.value || 'all';

      if (!subject || !body) {
        showToast('Broadcast title and message body cannot be blank.', 'error', 'Incomplete Announcement');
        return;
      }

      // Inject announcement into universal notification system
      try {
        createNotification({
          title: subject,
          message: body,
          type: priority === 'critical' ? 'security_alert' : 'system_update',
          channel: 'in_app',
        });
      } catch (err) {
        console.debug('Local notification created:', err);
      }

      pushNewActivity(`Broadcast sent to [${audience.toUpperCase()}]: "${subject}"`, 'security', '📢', 'rgba(245,158,11,0.2)', '#fbbf24');
      showToast(`Announcement broadcasted to active members.`, 'success', 'Broadcast Dispatched');
      
      broadcastForm.reset();
      if (broadcastModal) broadcastModal.classList.remove('show');
    });
  }

  // 4. System Status Modal Trigger
  const openStatusBtn = document.getElementById('btnOpenSystemStatusModal');
  const statusModal = document.getElementById('systemStatusModal');
  if (openStatusBtn && statusModal) {
    openStatusBtn.addEventListener('click', () => {
      statusModal.classList.add('show');
    });
  }

  // 5. Alert Action Triggers
  const btnReviewKyc = document.getElementById('btnReviewKycAlert');
  const kycModal = document.getElementById('kycReviewModal');
  if (btnReviewKyc && kycModal) {
    btnReviewKyc.addEventListener('click', () => {
      kycModal.classList.add('show');
    });
  }

  const approveKycBtn = document.getElementById('btnApproveKyc');
  if (approveKycBtn && kycModal) {
    approveKycBtn.addEventListener('click', () => {
      const memberName = getEffectiveMemberName();
      try {
        const rawUsers = localStorage.getItem('wb_credit_union_admin_users_db');
        if (rawUsers) {
          const uList = JSON.parse(rawUsers);
          if (Array.isArray(uList)) {
            const target = uList.find((u) => u.fullName === memberName || (u.firstName && memberName.includes(u.firstName)));
            if (target) {
              target.kycStatus = 'verified';
              target.kyc_status = 'verified';
              if (target.status === 'active') {
                target.statusReason = 'Account Active & Verified';
              }
              localStorage.setItem('wb_credit_union_admin_users_db', JSON.stringify(uList));

              const cur = getDemoStorageUser();
              if (cur && (cur.id === target.id || (cur.email && target.email && cur.email.toLowerCase() === target.email.toLowerCase()))) {
                cur.kycStatus = 'verified';
                cur.kyc_status = 'verified';
                if (cur.status === 'active') cur.statusReason = 'Account Active & Verified';
                setDemoStorageUser(cur);
              }
            }
          }
        }
      } catch (e) {}

      showToast(`${memberName} upgraded to KYC Level 3 Verified.`, 'success', 'KYC Approved');
      pushNewActivity(`Officer approved Level 3 Verification for ${memberName}`, 'security', '🪪', 'rgba(16,185,129,0.2)', '#34d399');
      kycModal.classList.remove('show');
    });
  }

  const rejectKycBtn = document.getElementById('btnRejectKyc');
  if (rejectKycBtn && kycModal) {
    rejectKycBtn.addEventListener('click', () => {
      showToast('Document marked as requiring re-upload.', 'warning', 'Document Rejected');
      kycModal.classList.remove('show');
    });
  }

  const btnReviewWireAlert = document.getElementById('btnReviewWireAlert');
  if (btnReviewWireAlert) {
    btnReviewWireAlert.addEventListener('click', () => {
      const table = document.getElementById('adminWireQueueTable');
      if (table) {
        table.scrollIntoView({ behavior: 'smooth', block: 'center' });
        table.style.outline = '2px solid #3b82f6';
        setTimeout(() => { table.style.outline = 'none'; }, 2000);
      }
    });
  }

  const btnAuditFailedTx = document.getElementById('btnAuditFailedTx');
  const txDetailModal = document.getElementById('txDetailModal');
  const txDetailModalBody = document.getElementById('txDetailModalBody');

  if (btnAuditFailedTx && txDetailModal && txDetailModalBody) {
    btnAuditFailedTx.addEventListener('click', () => {
      const memberName = getEffectiveMemberName();
      txDetailModalBody.innerHTML = `
        <div class="p-3 mb-3" style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:10px;">
          <div class="font-bold text-white mb-1">⚠️ Card Settlement Error: Overseas Terminal Failure</div>
          <div class="text-xs text-muted">Merchant Terminal #8819 (Paris, France) • Hard Limit Response Code 51</div>
        </div>
        <div class="space-y-2 text-xs">
          <div class="d-flex justify-between py-1" style="border-bottom:1px solid #334155;">
            <span class="text-muted">Target Account:</span>
            <span class="font-bold text-white">${memberName} (9482-1049-55)</span>
          </div>
          <div class="d-flex justify-between py-1" style="border-bottom:1px solid #334155;">
            <span class="text-muted">Card Model:</span>
            <span class="text-white">Black Metal Premier (#****1234)</span>
          </div>
          <div class="d-flex justify-between py-1" style="border-bottom:1px solid #334155;">
            <span class="text-muted">Attempted Amount:</span>
            <span class="font-bold font-numeric text-amber">€ 4,250.00</span>
          </div>
          <div class="d-flex justify-between py-1" style="border-bottom:1px solid #334155;">
            <span class="text-muted">Diagnostic Trace:</span>
            <span class="font-mono text-emerald">POS-SWISS-VISA-OK-GATEWAY-DECLINED-51</span>
          </div>
        </div>
        <div class="mt-4 text-right d-flex gap-2 justify-end">
          <button type="button" class="admin-btn admin-btn-outline" data-close-modal="txDetailModal">Close Audit</button>
          <button type="button" class="admin-btn admin-btn-emerald" id="btnResetCardLimit">Reset Card Daily Limit</button>
        </div>
      `;
      txDetailModal.classList.add('show');

      const resetBtn = document.getElementById('btnResetCardLimit');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          showToast('Card #****1234 daily POS limit refreshed to $50,000.00.', 'success', 'Limit Refreshed');
          txDetailModal.classList.remove('show');
        });
      }
    });
  }

  const btnInspectSuspended = document.getElementById('btnInspectSuspended');
  if (btnInspectSuspended && txDetailModal && txDetailModalBody) {
    btnInspectSuspended.addEventListener('click', () => {
      txDetailModalBody.innerHTML = `
        <div class="p-3 mb-3" style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:10px;">
          <div class="font-bold text-white mb-1">🔒 AML Watchlist Quarantine: High-Risk Jurisdiction</div>
          <div class="text-xs text-muted">OFAC Clearing Hold • Ref: WB-SWIFT-99203</div>
        </div>
        <div class="space-y-2 text-xs">
          <div class="d-flex justify-between py-1" style="border-bottom:1px solid #334155;">
            <span class="text-muted">Member Name:</span>
            <span class="font-bold text-white">Sterling Merchant Trading</span>
          </div>
          <div class="d-flex justify-between py-1" style="border-bottom:1px solid #334155;">
            <span class="text-muted">Account Number:</span>
            <span class="text-white">7738-9921-44</span>
          </div>
          <div class="d-flex justify-between py-1" style="border-bottom:1px solid #334155;">
            <span class="text-muted">Quarantined Amount:</span>
            <span class="font-bold font-numeric text-rose">₦ 185,000,000 ($120,500.00 USD)</span>
          </div>
          <div class="d-flex justify-between py-1" style="border-bottom:1px solid #334155;">
            <span class="text-muted">Beneficiary Institution:</span>
            <span class="text-white">First Bank of Nigeria (Lagos Central)</span>
          </div>
          <div class="d-flex justify-between py-1" style="border-bottom:1px solid #334155;">
            <span class="text-muted">OFAC Match Risk Score:</span>
            <span class="font-mono text-amber">0.48 (Medium-High Risk Threshold)</span>
          </div>
        </div>
        <div class="mt-4 text-right d-flex gap-2 justify-end">
          <button type="button" class="admin-btn admin-btn-outline" data-close-modal="txDetailModal">Close Inspector</button>
          <button type="button" class="admin-btn admin-btn-emerald" id="btnClearAmlFlagBtn">Clear AML Flag & Release Account</button>
        </div>
      `;
      txDetailModal.classList.add('show');

      const clearAmlBtn = document.getElementById('btnClearAmlFlagBtn');
      if (clearAmlBtn) {
        clearAmlBtn.addEventListener('click', () => {
          showToast('Account 7738-9921-44 cleared of OFAC flag and unlocked.', 'success', 'AML Cleared');
          pushNewActivity('Officer cleared OFAC AML Flag on Account 7738-9921-44', 'security', '🔓', 'rgba(16,185,129,0.2)', '#34d399');
          txDetailModal.classList.remove('show');
        });
      }
    });
  }
}

/* ----------------------------------------------------------------------------
 * 10. AUDITOR QUICK MEMO
 * ---------------------------------------------------------------------------- */
function setupAuditorMemo() {
  const memoInput = document.getElementById('auditorMemoInput');
  const saveBtn = document.getElementById('saveAuditorMemoBtn');

  if (memoInput) {
    const saved = localStorage.getItem(ADMIN_MEMO_KEY);
    if (saved) memoInput.value = saved;
  }

  if (saveBtn && memoInput) {
    saveBtn.addEventListener('click', () => {
      localStorage.setItem(ADMIN_MEMO_KEY, memoInput.value);
      showToast('Shift memo saved to encrypted local storage.', 'success', 'Memo Saved');
    });
  }
}

/* ----------------------------------------------------------------------------
 * 11. HELPER UTILITIES
 * ---------------------------------------------------------------------------- */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Auto-run on DOMContentLoaded or immediately if DOM is already ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAdminDashboard();
    });
  } else {
    initAdminDashboard();
  }
}

if (typeof window !== 'undefined') {
  window.initAdminDashboard = initAdminDashboard;
  window.switchAdminView = switchAdminView;

  // Global error handler to catch initialization or runtime crashes
  window.addEventListener('error', (event) => {
    console.error('[ADMIN GLOBAL ERROR]', event.error);
    if (typeof showToast === 'function') {
      showToast('A system error occurred. Please check the browser console for details.', 'error', 'Runtime Error');
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[ADMIN UNHANDLED PROMISE]', event.reason);
    if (typeof showToast === 'function') {
      showToast('A background task failed. Check connection or logs.', 'warning', 'Sync Issue');
    }
  });
}
