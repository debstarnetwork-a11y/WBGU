/**
 * ============================================================================
 * WB CREDIT UNION - ADMIN REPORTS & ANALYTICS CONTROLLER (js/admin-reports.js)
 * ============================================================================
 * 
 * Provides institutional executive business intelligence and report compilation:
 * 1. User Growth & Demographics Analytics (Registrations, Country mix, Account types)
 * 2. Transaction Velocity & Peak Hour Heatmap (Volume trends, Type breakdown, Fees)
 * 3. Multi-Currency Treasury Balance Distribution & Top Liquidity Accounts
 * 4. Wire Transfer Clearance Gate Pass Rates & Global Settlement Corridors
 * 5. Dynamic Custom Report Generator with Live Preview, CSV & PDF Export
 * ============================================================================
 */

import {
  showToast,
} from './supabase-config.js';
import {
  getAdminUsersList,
} from './admin-users.js';
import {
  getAdminTransactionsList,
} from './admin-transactions.js';
import {
  getAdminCardsList,
} from './admin-cards.js';

/* ----------------------------------------------------------------------------
 * 1. INITIALIZATION
 * ---------------------------------------------------------------------------- */
export function initAdminReports() {
  setupReportGenerator();
  renderAllAnalyticsCharts();
  renderTopAccountsLeaderboard();
  renderHourlyHeatmap();
}

/* ----------------------------------------------------------------------------
 * 2. CHARTS RENDERING ENGINE (High-DPI Canvas & CSS Visuals)
 * ---------------------------------------------------------------------------- */
function renderAllAnalyticsCharts() {
  renderUserRegTrendChart();
  renderUserActiveDonut();
  renderUserAcctTypePie();
  renderUsersByCountryBars();
  renderTxVolumeTrendChart();
  renderTxTypePie();
  renderCurrencyDistPie();
  renderWireCorridorsBars();
}

/**
 * 1. User Registration Trends (Area Fill Canvas Chart)
 */
function renderUserRegTrendChart() {
  const canvas = document.getElementById('canvasUserRegTrends');
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

  // Data: 30-day cumulative user growth
  const data = [1200, 1220, 1245, 1260, 1290, 1310, 1340, 1365, 1390, 1410, 1428];
  const max = 1500;
  const min = 1100;
  const padding = 30;

  const stepX = (width - padding * 2) / (data.length - 1);

  // Gradient Area Fill
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

  ctx.beginPath();
  data.forEach((val, idx) => {
    const x = padding + idx * stepX;
    const y = height - padding - ((val - min) / (max - min)) * (height - padding * 2);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.lineTo(padding + (data.length - 1) * stepX, height - padding);
  ctx.lineTo(padding, height - padding);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line Stroke
  ctx.beginPath();
  data.forEach((val, idx) => {
    const x = padding + idx * stepX;
    const y = height - padding - ((val - min) / (max - min)) * (height - padding * 2);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw Points
  data.forEach((val, idx) => {
    const x = padding + idx * stepX;
    const y = height - padding - ((val - min) / (max - min)) * (height - padding * 2);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

/**
 * 2. Active vs Inactive Donut Chart
 */
function renderUserActiveDonut() {
  const canvas = document.getElementById('canvasUserActiveDonut');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = (rect.height || 140) * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height || 140;
  ctx.clearRect(0, 0, width, height);

  const segments = [
    { label: 'Active', percent: 92, color: '#10b981' },
    { label: 'Suspended / Hold', percent: 5, color: '#f59e0b' },
    { label: 'Frozen / Closed', percent: 3, color: '#ef4444' }
  ];

  drawDonut(ctx, width, height, segments, '92%', 'Active SLA');
}

/**
 * 3. Users By Account Type Pie Chart
 */
function renderUserAcctTypePie() {
  const canvas = document.getElementById('canvasUserAcctTypePie');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = (rect.height || 140) * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height || 140;
  ctx.clearRect(0, 0, width, height);

  const segments = [
    { label: 'Premier Checking', percent: 45, color: '#3b82f6' },
    { label: 'Wealth Savings', percent: 30, color: '#10b981' },
    { label: 'Corporate Vault', percent: 15, color: '#f59e0b' },
    { label: 'Swiss Sovereign', percent: 10, color: '#8b5cf6' }
  ];

  drawDonut(ctx, width, height, segments, '3,892', 'Accounts');
}

/**
 * 4. Users By Country CSS Bars
 */
function renderUsersByCountryBars() {
  const container = document.getElementById('usersByCountryBarContainer');
  if (!container) return;

  const countries = [
    { name: '🇨🇭 Switzerland', count: 684, percent: 48, colorClass: 'emerald' },
    { name: '🇺🇸 United States', count: 342, percent: 24, colorClass: '' },
    { name: '🇬🇧 United Kingdom', count: 185, percent: 13, colorClass: 'amber' },
    { name: '🇸🇬 Singapore', count: 114, percent: 8, colorClass: 'purple' },
    { name: '🇫🇷 France / EU', count: 103, percent: 7, colorClass: 'rose' }
  ];

  container.innerHTML = `
    <div class="admin-css-bar-chart">
      ${countries.map((c) => `
        <div class="admin-bar-row">
          <div class="admin-bar-label">${c.name}</div>
          <div class="admin-bar-track">
            <div class="admin-bar-fill ${c.colorClass}" style="width: ${c.percent}%;"></div>
          </div>
          <div class="admin-bar-val">${c.count} (${c.percent}%)</div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * 5. Transaction Velocity Trend (Area Line)
 */
function renderTxVolumeTrendChart() {
  const canvas = document.getElementById('canvasTxVolumeTrend');
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

  const data = [1.2, 2.4, 1.8, 3.5, 4.2, 3.8, 5.6]; // Millions USD
  const max = 6.5;
  const min = 0.5;
  const padding = 30;

  const stepX = (width - padding * 2) / (data.length - 1);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  ctx.beginPath();
  data.forEach((val, idx) => {
    const x = padding + idx * stepX;
    const y = height - padding - ((val - min) / (max - min)) * (height - padding * 2);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.lineTo(padding + (data.length - 1) * stepX, height - padding);
  ctx.lineTo(padding, height - padding);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  data.forEach((val, idx) => {
    const x = padding + idx * stepX;
    const y = height - padding - ((val - min) / (max - min)) * (height - padding * 2);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.stroke();

  data.forEach((val, idx) => {
    const x = padding + idx * stepX;
    const y = height - padding - ((val - min) / (max - min)) * (height - padding * 2);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

/**
 * 6. Transactions By Type Pie
 */
function renderTxTypePie() {
  const canvas = document.getElementById('canvasTxTypePie');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = (rect.height || 140) * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height || 140;
  ctx.clearRect(0, 0, width, height);

  const segments = [
    { label: 'SWIFT Wires', percent: 45, color: '#f59e0b' },
    { label: 'Fedwire Clearing', percent: 28, color: '#3b82f6' },
    { label: 'ATM / Debit POS', percent: 15, color: '#10b981' },
    { label: 'Crypto Settlements', percent: 12, color: '#8b5cf6' }
  ];

  drawDonut(ctx, width, height, segments, '$24.8M', '7-Day Vol');
}

/**
 * 7. Multi-Currency Balance Distribution
 */
function renderCurrencyDistPie() {
  const canvas = document.getElementById('canvasCurrencyDistPie');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = (rect.height || 140) * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height || 140;
  ctx.clearRect(0, 0, width, height);

  const segments = [
    { label: 'USD ($)', percent: 52, color: '#3b82f6' },
    { label: 'CHF (Fr)', percent: 26, color: '#10b981' },
    { label: 'EUR (€)', percent: 14, color: '#f59e0b' },
    { label: 'GBP (£)', percent: 5, color: '#8b5cf6' },
    { label: 'JPY (¥)', percent: 3, color: '#ec4899' }
  ];

  drawDonut(ctx, width, height, segments, '$48.2M', 'Total Assets');
}

/**
 * 8. Wire Corridors CSS Bar Chart
 */
function renderWireCorridorsBars() {
  const container = document.getElementById('wireCorridorsBarContainer');
  if (!container) return;

  const corridors = [
    { name: '🇨🇭 CH -> 🇺🇸 USA Fedwire', count: '$12.4M', percent: 42, colorClass: '' },
    { name: '🇨🇭 CH -> 🇪🇺 EU SWIFT (Paris/Frankfurt)', count: '$8.6M', percent: 29, colorClass: 'emerald' },
    { name: '🇨🇭 CH -> 🇸🇬 SG MAS Clearing', count: '$5.2M', percent: 18, colorClass: 'amber' },
    { name: '🇨🇭 CH -> 🇬🇧 UK CHAPS', count: '$3.3M', percent: 11, colorClass: 'purple' }
  ];

  container.innerHTML = `
    <div class="admin-css-bar-chart">
      ${corridors.map((c) => `
        <div class="admin-bar-row">
          <div class="admin-bar-label" style="width: 140px;">${c.name}</div>
          <div class="admin-bar-track">
            <div class="admin-bar-fill ${c.colorClass}" style="width: ${c.percent}%;"></div>
          </div>
          <div class="admin-bar-val" style="width: 80px;">${c.count}</div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * 9. Hourly Peak Heatmap
 */
function renderHourlyHeatmap() {
  const container = document.getElementById('peakHoursHeatmapContainer');
  if (!container) return;

  const hours = [
    { hour: '00:00', intensity: 1, tx: 12 },
    { hour: '02:00', intensity: 1, tx: 8 },
    { hour: '04:00', intensity: 1, tx: 14 },
    { hour: '06:00', intensity: 2, tx: 42 },
    { hour: '08:00', intensity: 4, tx: 128 },
    { hour: '10:00', intensity: 4, tx: 194 },
    { hour: '12:00', intensity: 3, tx: 110 },
    { hour: '14:00', intensity: 4, tx: 215 },
    { hour: '16:00', intensity: 3, tx: 148 },
    { hour: '18:00', intensity: 2, tx: 76 },
    { hour: '20:00', intensity: 1, tx: 38 },
    { hour: '22:00', intensity: 1, tx: 19 }
  ];

  container.innerHTML = `
    <div class="admin-hourly-grid">
      ${hours.map((h) => `
        <div class="admin-hour-cell intensity-${h.intensity}" title="${h.hour}: ${h.tx} Settlements">
          <div style="font-size:0.6rem; opacity:0.8;">${h.hour}</div>
          <div>${h.tx} tx</div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * 10. Top Liquidity Accounts Leaderboard
 */
function renderTopAccountsLeaderboard() {
  const tbody = document.getElementById('topAccountsLeaderboardBody');
  if (!tbody) return;

  const top = [
    { rank: 1, name: 'Elena Rostova (Vanguard Logistics)', account: '1102-8849-01', type: 'Business Vault', balance: '$18,450,000.00', flag: '🇨🇭' },
    { rank: 2, name: 'Marcus Vance (Vance Capital AG)', account: '9901-2244-11', type: 'Swiss Sovereign', balance: '$12,800,000.00', flag: '🇺🇸' },
    { rank: 3, name: 'Genevieve Dubois (Château Dubois)', account: '6620-8812-33', type: 'High-Yield Savings', balance: '$6,450,000.00', flag: '🇫🇷' },
    { rank: 4, name: 'Miz Brymo (Private Wealth)', account: '9482-1049-55', type: 'Premier Checking', balance: '$4,820,450.00', flag: '🇨🇭' },
    { rank: 5, name: 'Sterling Merchant Trading', account: '7738-9921-44', type: 'Multi-Currency', balance: '$4,250,000.00', flag: '🇬🇧' }
  ];

  tbody.innerHTML = top.map((t) => `
    <tr>
      <td><span class="action-chip font-bold text-xs" style="background:#090d16;">#${t.rank}</span></td>
      <td>
        <div class="font-bold text-white text-xs">${t.flag} ${t.name}</div>
        <div class="font-mono text-xs text-muted">${t.account}</div>
      </td>
      <td><span class="admin-tx-type-tag">${t.type}</span></td>
      <td class="text-right">
        <span class="font-mono text-xs font-bold text-emerald" style="color:#34d399;">${t.balance}</span>
      </td>
    </tr>
  `).join('');
}

function drawDonut(ctx, width, height, segments, centerMain, centerSub) {
  if (width <= 20 || height <= 20) return;
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
  ctx.font = 'bold 14px Poppins, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(centerMain, centerX, centerY - 3);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '8px Poppins, sans-serif';
  ctx.fillText(centerSub, centerX, centerY + 11);
}

/* ----------------------------------------------------------------------------
 * 3. REPORT GENERATOR (CSV & PDF ENGINE)
 * ---------------------------------------------------------------------------- */
let currentGeneratedReportData = null;

function setupReportGenerator() {
  const form = document.getElementById('adminReportFilterForm');
  const typeSelect = document.getElementById('reportTypeSelect');
  const rangeSelect = document.getElementById('reportDateRangeSelect');
  const downloadCsvBtn = document.getElementById('btnDownloadReportCsv');
  const downloadPdfBtn = document.getElementById('btnDownloadReportPdf');
  const previewBox = document.getElementById('reportPreviewBox');
  const previewTableContainer = document.getElementById('reportPreviewTableContainer');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const reportType = typeSelect?.value || 'users';
      const range = rangeSelect?.value || '30d';

      generateReportData(reportType, range);
      if (previewBox) previewBox.style.display = 'block';
    });
  }

  function generateReportData(type, range) {
    if (!previewTableContainer) return;

    if (type === 'users') {
      const users = getAdminUsersList();
      currentGeneratedReportData = {
        title: 'Institutional Member Audit Report',
        filename: `WBCU_User_Audit_Report_${range}_${Date.now()}`,
        headers: ['Member ID', 'Full Legal Name', 'Email Address', 'Status', 'KYC Tier', 'Total Balance (USD)', 'Created Date'],
        rows: users.map((u) => [
          u.id,
          u.fullName,
          u.email,
          u.status.toUpperCase(),
          u.kycStatus.toUpperCase(),
          `$${(u.balance || 50000).toLocaleString()}`,
          u.createdAt ? u.createdAt.slice(0, 10) : '2025-01-01'
        ])
      };
    } else if (type === 'transactions') {
      const txs = getAdminTransactionsList();
      currentGeneratedReportData = {
        title: 'Consolidated Ledger Transaction Report',
        filename: `WBCU_Transaction_Report_${range}_${Date.now()}`,
        headers: ['Reference', 'Timestamp', 'Sender / User', 'Type', 'Amount', 'Currency', 'Status'],
        rows: txs.map((t) => [
          t.reference || t.id,
          t.date ? t.date.slice(0, 16).replace('T', ' ') : '2026-09-26 12:00',
          t.userName || 'Member',
          t.type.toUpperCase(),
          Number(t.amount || 0).toLocaleString(),
          t.currency || 'USD',
          t.status.toUpperCase()
        ])
      };
    } else if (type === 'cards') {
      const cards = getAdminCardsList();
      currentGeneratedReportData = {
        title: 'ATM / Payment Cards Production Report',
        filename: `WBCU_Card_Issuance_Report_${range}_${Date.now()}`,
        headers: ['Card ID', 'Masked Number', 'Cardholder', 'Card Tier', 'Status', 'Fulfillment', 'Daily Limit ($)'],
        rows: cards.map((c) => [
          c.id,
          c.cardMasked,
          c.cardHolder,
          c.cardType,
          c.status.toUpperCase(),
          c.printStatus.toUpperCase(),
          `$${c.dailyAtmLimit.toLocaleString()}`
        ])
      };
    } else {
      // Financial Summary
      currentGeneratedReportData = {
        title: 'Consolidated Swiss Treasury Financial Summary',
        filename: `WBCU_Treasury_Financial_Summary_${Date.now()}`,
        headers: ['Depository Corridor', 'Currency', 'Total Accounts', 'Liquid Reserve Balance', '30-Day Velocity', 'Regulatory SLA'],
        rows: [
          ['Zurich Sovereign Primary', 'USD', '1,428', '$25,110,400.00', '+$3,450,000.00', '100% Cleared'],
          ['Geneva High-Yield Reserve', 'CHF', '842', 'CHF 12,540,800.00', '+CHF 1,820,000.00', '100% Cleared'],
          ['Frankfurt EU SWIFT Vault', 'EUR', '620', '€6,780,200.00', '+€940,000.00', '100% Cleared'],
          ['London City Depository', 'GBP', '240', '£2,410,000.00', '+£310,000.00', '100% Cleared'],
          ['Crypto Digital Custody', 'USD/Crypto', '24', '$2,840,920.00', '+$450,000.00', 'FIPS 140-3']
        ]
      };
    }

    renderReportTableHtml(currentGeneratedReportData);
  }

  function renderReportTableHtml(report) {
    previewTableContainer.innerHTML = `
      <div class="mb-3 d-flex items-center justify-between">
        <div>
          <h4 class="text-white text-sm font-bold m-0">${report.title}</h4>
          <span class="text-xs text-muted font-mono">${report.rows.length} rows compiled &bull; Swiss Treasury Vault</span>
        </div>
      </div>
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              ${report.headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${report.rows.map((row) => `
              <tr>
                ${row.map((val) => `<td class="font-mono text-xs">${escapeHtml(val)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Download CSV
  if (downloadCsvBtn) {
    downloadCsvBtn.addEventListener('click', () => {
      if (!currentGeneratedReportData) return showToast('Generate a report first.', 'warning', 'No Report');

      const csvRows = [];
      csvRows.push(currentGeneratedReportData.headers.map((h) => `"${h}"`).join(','));
      currentGeneratedReportData.rows.forEach((r) => {
        csvRows.push(r.map((val) => `"${val.replace(/"/g, '""')}"`).join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentGeneratedReportData.filename}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast(`Exported ${currentGeneratedReportData.title} to CSV.`, 'success', 'CSV Exported');
    });
  }

  // Download PDF
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
      if (!currentGeneratedReportData) return showToast('Generate a report first.', 'warning', 'No Report');

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showToast('Pop-up blocker prevented generating PDF. Please enable popups.', 'warning', 'PDF Blocked');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${currentGeneratedReportData.title}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #0f172a; }
            .header { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .title { font-size: 20px; font-weight: bold; color: #0284c7; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th { background: #f1f5f9; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 10px; }
            td { padding: 8px 10px; border: 1px solid #e2e8f0; font-family: monospace; }
            .footer { margin-top: 30px; font-size: 10px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 10px; text-align: center; }
          </style>
        </head>
        <body onload="window.print();">
          <div class="header">
            <div>
              <div class="title">WB CREDIT UNION &bull; TREASURY REPORT</div>
              <div style="font-size: 12px; color: #64748b;">${currentGeneratedReportData.title}</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <div><strong>Station:</strong> Zurich Central Hub</div>
              <div><strong>Compiled:</strong> ${new Date().toLocaleString()}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>${currentGeneratedReportData.headers.map((h) => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${currentGeneratedReportData.rows.map((row) => `<tr>${row.map((val) => `<td>${escapeHtml(val)}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <div class="footer">
            CONFIDENTIAL &bull; FOR INSTITUTIONAL AUDIT PURPOSES ONLY &bull; WB CREDIT UNION SWITZERLAND
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      showToast(`Generated PDF print document for ${currentGeneratedReportData.title}.`, 'success', 'PDF Ready');
    });
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
