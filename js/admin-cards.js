/**
 * ============================================================================
 * WB CREDIT UNION - ADMIN ATM CARD MANAGEMENT CONTROLLER (js/admin-cards.js)
 * ============================================================================
 * 
 * Manages institutional payment cards:
 * 1. Card Overview Metrics & Types Breakdown Canvas Donut Chart
 * 2. All Cards Master Table with Search, Multi-Filter, and Batch Operations
 * 3. Card Details Inspector & Secure Vault:
 *     * Visual Card Render (Front/Back) with EMV chip & Swiss emblem
 *     * Admin PIN verification to reveal full 16-digits & 3-digit CVV
 *     * High-Resolution PNG Card Generator & instant download
 *     * Printable Physical Card Issuance Slip
 *     * Status Management (Active, Inactive, Blocked, Expired)
 *     * Limits & Feature Modifiers (POS, Online, International, Contactless)
 * 4. Card Print & Production Queue (Tracking numbers, Shipping updates)
 * 5. Luxury Card Design Templates Gallery
 * 6. Issue New Card Wizard
 * ============================================================================
 */

import {
  showToast,
  getDemoStorageUser,
  setDemoStorageUser,
} from './supabase-config.js';
import {
  getAdminUsersList,
  saveAdminUsersList,
  getEffectiveMemberName,
  getEffectiveMemberEmail,
  updateUser,
} from './admin-users.js';
import { createNotification } from './notifications-email.js';

const ADMIN_CARDS_STORAGE_KEY = 'wb_credit_union_admin_cards_db';

/* ----------------------------------------------------------------------------
 * 1. SEED CARDS DATASET
 * ---------------------------------------------------------------------------- */
const initialSeedCards = [
  {
    id: 'crd-101',
    cardNumber: '4532 8812 9044 1234',
    cardMasked: '•••• •••• •••• 1234',
    cvv: '849',
    pin: '1234',
    expiry: '09/29',
    cardHolder: 'MIZ BRYMO',
    userId: 'usr-101',
    userEmail: 'mizbrymo@gmail.com',
    accountNumber: '9482-1049-55',
    cardType: 'Black Metal Premier',
    theme: 'card-theme-black',
    status: 'active',
    printStatus: 'delivered',
    trackingNumber: 'CH-POST-99201482-SWISS',
    shippingAddress: '109, Feldgüetliweg, Meilen, Zurich 8706, Switzerland',
    dailyAtmLimit: 10000,
    dailyPosLimit: 50000,
    monthlyLimit: 250000,
    allowOnline: true,
    allowInternational: true,
    allowContactless: true,
    createdAt: '2025-01-20T10:00:00Z',
    recentTransactions: [
      { date: '2026-09-26 12:40', merchant: 'Meilen Marina Store', amount: '$420.00', status: 'Approved' },
      { date: '2026-09-24 16:15', merchant: 'Zurich Airport Duty Free', amount: '$1,850.00', status: 'Approved' }
    ]
  },
  {
    id: 'crd-102',
    cardNumber: '4111 5590 1182 5590',
    cardMasked: '•••• •••• •••• 5590',
    cvv: '391',
    pin: '9082',
    expiry: '11/28',
    cardHolder: 'ELENA ROSTOVA',
    userId: 'usr-102',
    userEmail: 'elena.rostova@vanguardlogistics.ch',
    accountNumber: '1102-8849-01',
    cardType: 'Executive Corporate Visa',
    theme: 'card-theme-corporate',
    status: 'active',
    printStatus: 'shipped',
    trackingNumber: 'FEDEX-SWISS-77291044',
    shippingAddress: 'Rue du Rhône 42, Geneva 1204, Switzerland',
    dailyAtmLimit: 25000,
    dailyPosLimit: 100000,
    monthlyLimit: 500000,
    allowOnline: true,
    allowInternational: true,
    allowContactless: true,
    createdAt: '2025-02-15T14:30:00Z',
    recentTransactions: [
      { date: '2026-09-25 18:20', merchant: 'Tokyo Port Logistics Terminal', amount: '$12,400.00', status: 'Approved' }
    ]
  },
  {
    id: 'crd-103',
    cardNumber: '5412 7511 8820 9921',
    cardMasked: '•••• •••• •••• 9921',
    cvv: '109',
    pin: '4410',
    expiry: '04/30',
    cardHolder: 'CHEN WEI',
    userId: 'usr-104',
    userEmail: 'chen.wei@singaporebiotech.sg',
    accountNumber: '4419-3301-88',
    cardType: 'World Elite Mastercard',
    theme: 'card-theme-elite',
    status: 'active',
    printStatus: 'printing',
    trackingNumber: '',
    shippingAddress: '8 Marina View, Asia Square Tower 1, Singapore 018960',
    dailyAtmLimit: 20000,
    dailyPosLimit: 80000,
    monthlyLimit: 350000,
    allowOnline: true,
    allowInternational: true,
    allowContactless: true,
    createdAt: '2025-04-15T09:00:00Z',
    recentTransactions: []
  },
  {
    id: 'crd-104',
    cardNumber: '4000 1234 5678 4401',
    cardMasked: '•••• •••• •••• 4401',
    cvv: '772',
    pin: '8812',
    expiry: '12/29',
    cardHolder: 'GENEVIEVE DUBOIS',
    userId: 'usr-105',
    userEmail: 'genevieve.dubois@chateau-dubois.fr',
    accountNumber: '6620-8812-33',
    cardType: 'Sovereign 24K Gold Visa',
    theme: 'card-theme-gold',
    status: 'active',
    printStatus: 'requested',
    trackingNumber: '',
    shippingAddress: '28 Avenue Montaigne, 75008 Paris, France',
    dailyAtmLimit: 30000,
    dailyPosLimit: 150000,
    monthlyLimit: 750000,
    allowOnline: true,
    allowInternational: true,
    allowContactless: true,
    createdAt: '2025-05-20T11:00:00Z',
    recentTransactions: [
      { date: '2026-09-24 18:40', merchant: 'Boucheron Place Vendôme', amount: '€14,500.00', status: 'Approved' }
    ]
  },
  {
    id: 'crd-105',
    cardNumber: '4242 8820 1199 7738',
    cardMasked: '•••• •••• •••• 7738',
    cvv: '440',
    pin: '0000',
    expiry: '08/27',
    cardHolder: 'STERLING MERCHANT TRADING',
    userId: 'usr-103',
    userEmail: 'treasury@sterlingmerchant.com',
    accountNumber: '7738-9921-44',
    cardType: 'Executive Corporate Visa',
    theme: 'card-theme-corporate',
    status: 'blocked',
    printStatus: 'delivered',
    trackingNumber: 'ROYAL-MAIL-991204',
    shippingAddress: '14 Cornhill, City of London EC3V 3ND, UK',
    dailyAtmLimit: 0,
    dailyPosLimit: 0,
    monthlyLimit: 0,
    allowOnline: false,
    allowInternational: false,
    allowContactless: false,
    createdAt: '2025-03-05T08:00:00Z',
    recentTransactions: []
  },
  {
    id: 'crd-106',
    cardNumber: '4916 2200 4499 3310',
    cardMasked: '•••• •••• •••• 3310',
    cvv: '912',
    pin: '3310',
    expiry: '02/25',
    cardHolder: 'CARLOS MENDEZ',
    userId: 'usr-107',
    userEmail: 'carlos.mendez@mendezholdings.es',
    accountNumber: '5512-9901-22',
    cardType: 'Virtual Instant Debit',
    theme: 'card-theme-corporate',
    status: 'expired',
    printStatus: 'not_requested',
    trackingNumber: '',
    shippingAddress: 'Paseo de la Castellana 89, 28046 Madrid, Spain',
    dailyAtmLimit: 5000,
    dailyPosLimit: 25000,
    monthlyLimit: 100000,
    allowOnline: true,
    allowInternational: true,
    allowContactless: false,
    createdAt: '2024-02-10T12:00:00Z',
    recentTransactions: []
  }
];

/* ----------------------------------------------------------------------------
 * 2. STORAGE CONTROLS
 * ---------------------------------------------------------------------------- */
export function getAdminCardsList() {
  const memberName = getEffectiveMemberName();
  const memberEmail = getEffectiveMemberEmail();
  let list = [];
  const stored = localStorage.getItem(ADMIN_CARDS_STORAGE_KEY);
  if (stored) {
    try {
      list = JSON.parse(stored);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list) || list.length === 0) {
    list = JSON.parse(JSON.stringify(initialSeedCards));
  }

  // Ensure all cards reflect the latest member names from getAdminUsersList
  try {
    const users = getAdminUsersList();
    list.forEach((card) => {
      // Sanitize any duplicated repeated name pattern (e.g. "GUNNAR BERGKVIST GUNNAR BERGKVIST")
      if (card.cardHolder && /GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/i.test(card.cardHolder)) {
        card.cardHolder = card.cardHolder.replace(/GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/gi, 'GUNNAR BERGKVIST');
        card.cardholder_name = card.cardHolder;
      }
      if (card.cardholder_name && /GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/i.test(card.cardholder_name)) {
        card.cardholder_name = card.cardholder_name.replace(/GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/gi, 'GUNNAR BERGKVIST');
        card.cardHolder = card.cardholder_name;
      }

      const matchedUser = users.find((u) =>
        (card.userId && String(u.id) === String(card.userId)) ||
        (card.userEmail && u.email && u.email.toLowerCase() === card.userEmail.toLowerCase()) ||
        (card.accountNumber && Array.isArray(u.accounts) && u.accounts.some((a) => a.accountNumber === card.accountNumber)) ||
        (Array.isArray(u.cards) && u.cards.some((uc) => uc.id === card.id)) ||
        (card.cardHolder && u.lastName && card.cardHolder.toLowerCase().includes(u.lastName.toLowerCase())) ||
        (card.cardHolder && card.cardHolder.toLowerCase().includes('bergkvist') && u.email && u.email.toLowerCase().includes('slipsen'))
      );

      if (matchedUser) {
        const correctName = getEffectiveMemberName(matchedUser).toUpperCase();
        card.cardHolder = correctName;
        card.cardholder_name = correctName;
        card.userEmail = matchedUser.email || card.userEmail;
        card.userId = matchedUser.id;
      }
    });
  } catch (err) {
    console.warn('Sync cards with users in getAdminCardsList notice:', err);
  }

  // Merge any user cards from user's storage (wb_credit_union_atm_cards) so admin always sees them
  try {
    const userCardsRaw = localStorage.getItem('wb_credit_union_atm_cards');
    if (userCardsRaw) {
      const userCards = JSON.parse(userCardsRaw);
      if (Array.isArray(userCards)) {
        userCards.forEach((uc) => {
          const rawNum = (uc.card_number || uc.cardNumber || '').replace(/\s+/g, '');
          const existingIdx = list.findIndex((ac) => ac.id === uc.id || ac.cardNumber.replace(/\s+/g, '') === rawNum);
          if (existingIdx !== -1) {
            list[existingIdx].cardHolder = (uc.cardholder_name || uc.cardHolder || memberName).toUpperCase();
            list[existingIdx].cardholder_name = (uc.cardholder_name || uc.cardHolder || memberName).toUpperCase();
            list[existingIdx].userEmail = uc.userEmail || memberEmail;
            if (uc.status) list[existingIdx].status = uc.status;
            if (typeof uc.is_frozen === 'boolean') list[existingIdx].is_frozen = uc.is_frozen;
          } else {
            list.unshift({
              id: uc.id,
              cardNumber: uc.cardNumber || (uc.card_number ? uc.card_number.replace(/(.{4})/g, '$1 ').trim() : '4532 8092 1194 8092'),
              cardMasked: uc.cardMasked || (uc.card_number ? `•••• •••• •••• ${uc.card_number.slice(-4)}` : '•••• •••• •••• 8092'),
              cvv: uc.cvv || '842',
              pin: uc.pin || '1234',
              expiry: uc.expiry || `${uc.expiry_month || '09'}/${uc.expiry_year || '31'}`,
              cardHolder: uc.cardholder_name || uc.cardHolder || 'MEMBER',
              userId: uc.userId || 'usr-client',
              userEmail: uc.userEmail || 'member@wbcu.net',
              accountNumber: uc.accountNumber || '9482-1049-55',
              cardType: uc.cardType || uc.card_type || 'Visa Platinum Debit',
              theme: uc.theme || 'card-theme-corporate',
              status: uc.status || 'pending_approval',
              is_frozen: uc.is_frozen || false,
              printStatus: uc.printStatus || (uc.card_form === 'physical' ? 'requested' : 'not_requested'),
              trackingNumber: uc.trackingNumber || `CH-POST-${Math.floor(10000000 + Math.random() * 90000000)}-SWISS`,
              shippingAddress: uc.shippingAddress || 'Zurich, Switzerland',
              dailyAtmLimit: uc.daily_limit || uc.dailyAtmLimit || 5000,
              dailyPosLimit: uc.dailyPosLimit || 25000,
              monthlyLimit: uc.monthly_limit || uc.monthlyLimit || 50000,
              allowOnline: uc.allowOnline ?? true,
              allowInternational: uc.allowInternational ?? true,
              allowContactless: uc.allowContactless ?? true,
              createdAt: uc.created_at || uc.createdAt || new Date().toISOString(),
              recentTransactions: []
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn('Sync user cards into admin cards list notice:', e);
  }

  localStorage.setItem(ADMIN_CARDS_STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function saveAdminCardsList(list) {
  localStorage.setItem(ADMIN_CARDS_STORAGE_KEY, JSON.stringify(list));
}

export function getCardById(cardId) {
  const list = getAdminCardsList();
  return list.find((c) => c.id === cardId) || null;
}

function syncCardBackToUserStorage(card) {
  try {
    const raw = localStorage.getItem('wb_credit_union_atm_cards');
    if (raw) {
      const userCards = JSON.parse(raw);
      if (Array.isArray(userCards)) {
        let changed = false;
        const cleanAdminNum = (card.cardNumber || '').replace(/\s+/g, '');
        userCards.forEach((uc) => {
          const cleanUserNum = (uc.card_number || uc.cardNumber || '').replace(/\s+/g, '');
          if (uc.id === card.id || (cleanAdminNum && cleanUserNum === cleanAdminNum)) {
            uc.status = card.status;
            uc.is_frozen = card.status === 'blocked' || card.status === 'frozen' || card.is_frozen;
            uc.daily_limit = card.dailyPosLimit;
            uc.atm_limit = card.dailyAtmLimit;
            uc.monthly_limit = card.monthlyLimit;
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('wb_credit_union_atm_cards', JSON.stringify(userCards));
        }
      }
    }
  } catch (e) {
    console.warn('Error syncing card back to user storage:', e);
  }
}

export function updateCardInDb(updatedCard) {
  const list = getAdminCardsList();
  const idx = list.findIndex((c) => c.id === updatedCard.id);
  if (idx !== -1) {
    list[idx] = updatedCard;
    saveAdminCardsList(list);
    syncCardBackToUserStorage(updatedCard);
    return true;
  }
  return false;
}

export function deleteCardFromDb(cardId) {
  if (!cardId) return false;

  // 1. Remove from in-memory cards
  currentCards = currentCards.filter((c) => c.id !== cardId);
  filteredCards = filteredCards.filter((c) => c.id !== cardId);
  selectedBatchCardIds.delete(cardId);
  saveAdminCardsList(currentCards);

  // 2. Remove from wb_credit_union_atm_cards
  try {
    const rawAtm = localStorage.getItem('wb_credit_union_atm_cards');
    if (rawAtm) {
      const atmCards = JSON.parse(rawAtm);
      if (Array.isArray(atmCards)) {
        const remaining = atmCards.filter((c) => c.id !== cardId);
        localStorage.setItem('wb_credit_union_atm_cards', JSON.stringify(remaining));
      }
    }
  } catch (e) {}

  // 3. Remove from user profiles in wb_credit_union_admin_users_db
  try {
    const users = getAdminUsersList();
    let userModified = false;
    users.forEach((u) => {
      if (Array.isArray(u.cards)) {
        const beforeLen = u.cards.length;
        u.cards = u.cards.filter((c) => c.id !== cardId);
        if (u.cards.length !== beforeLen) {
          userModified = true;
          updateUser(u);
        }
      }
    });
    if (userModified) {
      saveAdminUsersList(users);
    }
  } catch (e) {}

  // 4. Remove from active demo session if present
  try {
    const active = getDemoStorageUser();
    if (active && Array.isArray(active.cards)) {
      active.cards = active.cards.filter((c) => c.id !== cardId);
      setDemoStorageUser(active);
    }
  } catch (e) {}

  // 5. Update requested badge count immediately
  try {
    const reqBadge = document.getElementById('badgeRequestedCardsCount');
    if (reqBadge) {
      const requestedCount = currentCards.filter((c) => 
        c.status === 'pending_approval' || c.status === 'requested' || c.status === 'pending' || c.printStatus === 'requested'
      ).length;
      reqBadge.textContent = requestedCount.toString();
      reqBadge.style.display = requestedCount > 0 ? 'inline-block' : 'none';
    }
  } catch (e) {}

  // 6. Re-render UI
  try { renderCardDashboardMetrics(); } catch (e) {}
  try { renderCardTypesDonutChart(); } catch (e) {}
  try { applyCardFilters(); } catch (e) {}
  try { renderCardsTable(); } catch (e) {}

  return true;
}

export function syncAllCardsWithUsersDatabase() {
  try {
    const users = getAdminUsersList();
    let modified = false;
    currentCards.forEach((card) => {
      // Sanitize any duplicated repeated name pattern (e.g. "GUNNAR BERGKVIST GUNNAR BERGKVIST")
      if (card.cardHolder && /GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/i.test(card.cardHolder)) {
        card.cardHolder = card.cardHolder.replace(/GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/gi, 'GUNNAR BERGKVIST');
        card.cardholder_name = card.cardHolder;
        modified = true;
      }
      if (card.cardholder_name && /GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/i.test(card.cardholder_name)) {
        card.cardholder_name = card.cardholder_name.replace(/GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/gi, 'GUNNAR BERGKVIST');
        card.cardHolder = card.cardholder_name;
        modified = true;
      }

      // Find matching user
      const user = users.find((u) => 
        (card.userId && String(u.id) === String(card.userId)) ||
        (card.userEmail && u.email && u.email.toLowerCase() === card.userEmail.toLowerCase()) ||
        (card.accountNumber && Array.isArray(u.accounts) && u.accounts.some((a) => a.accountNumber === card.accountNumber)) ||
        (Array.isArray(u.cards) && u.cards.some((uc) => uc.id === card.id)) ||
        (card.cardHolder && u.lastName && card.cardHolder.toLowerCase().includes(u.lastName.toLowerCase())) ||
        (card.cardHolder && card.cardHolder.toLowerCase().includes('bergkvist') && u.email && u.email.toLowerCase().includes('slipsen'))
      );
      if (user) {
        const correctHolder = getEffectiveMemberName(user).toUpperCase();
        if (card.cardHolder !== correctHolder || card.cardholder_name !== correctHolder || card.userId !== user.id || card.userEmail !== user.email) {
          card.cardHolder = correctHolder;
          card.cardholder_name = correctHolder;
          card.userEmail = user.email || card.userEmail;
          card.userId = user.id;
          modified = true;
        }
      }
    });
    if (modified) {
      saveAdminCardsList(currentCards);
    }

    // Clean duplicate name repetitions in wb_credit_union_atm_cards
    const rawAtm = localStorage.getItem('wb_credit_union_atm_cards');
    if (rawAtm) {
      const atmCards = JSON.parse(rawAtm);
      if (Array.isArray(atmCards)) {
        let atmMod = false;
        atmCards.forEach((ac) => {
          if (ac.cardholder_name && /GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/i.test(ac.cardholder_name)) {
            ac.cardholder_name = ac.cardholder_name.replace(/GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/gi, 'GUNNAR BERGKVIST');
            ac.cardHolder = ac.cardholder_name;
            atmMod = true;
          }
          if (ac.cardHolder && /GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/i.test(ac.cardHolder)) {
            ac.cardHolder = ac.cardHolder.replace(/GUNNAR BERGKVIST\s+GUNNAR BERGKVIST/gi, 'GUNNAR BERGKVIST');
            ac.cardholder_name = ac.cardHolder;
            atmMod = true;
          }
          const matchedUser = users.find((u) => 
            (ac.userId && String(u.id) === String(ac.userId)) ||
            (ac.userEmail && u.email && u.email.toLowerCase() === ac.userEmail.toLowerCase()) ||
            (Array.isArray(u.accounts) && u.accounts.some((a) => a.accountNumber === ac.accountNumber)) ||
            (ac.cardHolder && u.lastName && ac.cardHolder.toLowerCase().includes(u.lastName.toLowerCase()))
          );
          if (matchedUser) {
            const correctName = getEffectiveMemberName(matchedUser).toUpperCase();
            if (ac.cardHolder !== correctName || ac.cardholder_name !== correctName) {
              ac.cardHolder = correctName;
              ac.cardholder_name = correctName;
              ac.userEmail = matchedUser.email || ac.userEmail;
              ac.userId = matchedUser.id;
              atmMod = true;
            }
          }
        });
        if (atmMod) {
          localStorage.setItem('wb_credit_union_atm_cards', JSON.stringify(atmCards));
        }
      }
    }
  } catch (e) {
    console.warn('Sync all cards error:', e);
  }
}

/* ----------------------------------------------------------------------------
 * 3. STATE & CONTROLLER VARIABLES
 * ---------------------------------------------------------------------------- */
let currentCards = [];
let filteredCards = [];
let selectedBatchCardIds = new Set();
let currentCardsTab = 'all'; // 'all', 'requested', or 'print-queue'
let activeDetailCard = null;

/* ----------------------------------------------------------------------------
 * 4. INITIALIZATION
 * ---------------------------------------------------------------------------- */
export function initAdminCardManagement() {
  currentCards = getAdminCardsList();
  syncAllCardsWithUsersDatabase();
  filteredCards = [...currentCards];

  setupCardSearchAndFilters();
  setupCardSubTabs();
  setupBatchCardOperations();
  setupCardDetailModal();
  setupIssueNewCardModal();
  setupCardDesignTemplates();

  renderCardDashboardMetrics();
  renderCardTypesDonutChart();
  renderCardsTable();

  // Expose global helpers for cross-module coordination
  window.syncAllCardsWithUsersDatabase = syncAllCardsWithUsersDatabase;
  window.deleteCardFromDb = deleteCardFromDb;
  window.renderCardsTable = renderCardsTable;
  window.openCardDetailModal = openCardDetailModal;

  window.addEventListener('wbcu_user_updated', () => {
    syncAllCardsWithUsersDatabase();
    applyCardFilters();
  });
  window.addEventListener('wbcu_cards_updated', () => {
    currentCards = getAdminCardsList();
    applyCardFilters();
    renderCardDashboardMetrics();
    renderCardTypesDonutChart();
  });
}

/* ----------------------------------------------------------------------------
 * 5. DASHBOARD METRICS & TYPES DONUT CHART
 * ---------------------------------------------------------------------------- */
function renderCardDashboardMetrics() {
  const totalEl = document.getElementById('cardStatTotal');
  const activeEl = document.getElementById('cardStatActive');
  const blockedEl = document.getElementById('cardStatBlocked');
  const pendingPrintEl = document.getElementById('cardStatPendingPrint');
  const expiredEl = document.getElementById('cardStatExpired');
  const reqBadge = document.getElementById('badgeRequestedCardsCount');

  const total = currentCards.length;
  const active = currentCards.filter((c) => c.status === 'active').length;
  const blocked = currentCards.filter((c) => c.status === 'blocked').length;
  const pendingPrint = currentCards.filter((c) => c.printStatus === 'requested' || c.printStatus === 'printing').length;
  const expired = currentCards.filter((c) => c.status === 'expired').length;
  const requestedCount = currentCards.filter((c) => c.status === 'pending_approval' || c.status === 'requested' || c.status === 'pending' || c.printStatus === 'requested').length;

  if (totalEl) totalEl.textContent = `${total} Cards`;
  if (activeEl) activeEl.textContent = active.toString();
  if (blockedEl) blockedEl.textContent = blocked.toString();
  if (pendingPrintEl) pendingPrintEl.textContent = pendingPrint.toString();
  if (expiredEl) expiredEl.textContent = expired.toString();
  if (reqBadge) {
    reqBadge.textContent = requestedCount.toString();
    reqBadge.style.display = requestedCount > 0 ? 'inline-block' : 'none';
  }
}

function renderCardTypesDonutChart() {
  const canvas = document.getElementById('canvasCardTypesDonut');
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
    { label: 'Global Elite Black', percent: 35, color: '#3b82f6' },
    { label: 'Gold Preferred', percent: 25, color: '#f59e0b' },
    { label: 'Platinum Premier', percent: 20, color: '#06b6d4' },
    { label: 'Standard Debit', percent: 12, color: '#8b5cf6' },
    { label: 'Virtual Metal', percent: 8, color: '#10b981' }
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
  ctx.fillText(`${currentCards.length} Issued`, centerX, centerY - 3);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '8px Poppins, sans-serif';
  ctx.fillText('EMV / NFC', centerX, centerY + 11);
}

/* ----------------------------------------------------------------------------
 * 6. SUB-TABS & SEARCH / FILTERS
 * ---------------------------------------------------------------------------- */
function setupCardSubTabs() {
  const tabAll = document.getElementById('cardTabAll');
  const tabRequested = document.getElementById('cardTabRequested');
  const tabPrint = document.getElementById('cardTabPrintQueue');

  const setTab = (activeTab, tabMode) => {
    [tabAll, tabRequested, tabPrint].forEach((t) => { if (t) t.classList.remove('active'); });
    if (activeTab) activeTab.classList.add('active');
    currentCardsTab = tabMode;
    applyCardFilters();
  };

  if (tabAll) tabAll.addEventListener('click', () => setTab(tabAll, 'all'));
  if (tabRequested) tabRequested.addEventListener('click', () => setTab(tabRequested, 'requested'));
  if (tabPrint) tabPrint.addEventListener('click', () => setTab(tabPrint, 'print-queue'));
}

function setupCardSearchAndFilters() {
  const searchInput = document.getElementById('cardSearchInput');
  const statusFilter = document.getElementById('cardStatusFilter');
  const typeFilter = document.getElementById('cardTypeFilter');
  const printFilter = document.getElementById('cardPrintStatusFilter');
  const clearBtn = document.getElementById('btnClearCardFilters');

  let timer = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(applyCardFilters, 250);
    });
  }

  [statusFilter, typeFilter, printFilter].forEach((sel) => {
    if (sel) sel.addEventListener('change', applyCardFilters);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (statusFilter) statusFilter.value = 'all';
      if (typeFilter) typeFilter.value = 'all';
      if (printFilter) printFilter.value = 'all';
      applyCardFilters();
    });
  }
}

function applyCardFilters() {
  const query = (document.getElementById('cardSearchInput')?.value || '').trim().toLowerCase();
  const statusVal = document.getElementById('cardStatusFilter')?.value || 'all';
  const typeVal = document.getElementById('cardTypeFilter')?.value || 'all';
  const printVal = document.getElementById('cardPrintStatusFilter')?.value || 'all';

  filteredCards = currentCards.filter((c) => {
    if (!c) return false;
    if (currentCardsTab === 'print-queue') {
      if (c.printStatus !== 'requested' && c.printStatus !== 'printing' && c.printStatus !== 'shipped') return false;
    }
    if (currentCardsTab === 'requested') {
      const isReq = (c.status === 'pending_approval' || c.status === 'requested' || c.status === 'pending' || c.printStatus === 'requested');
      if (!isReq) return false;
    }

    const cardHolder = (c.cardHolder || c.cardholder_name || '').toLowerCase();
    const cardNum = (c.cardNumber || c.card_number || '').replace(/\s/g, '');
    const userEmail = (c.userEmail || '').toLowerCase();
    const acctNum = (c.accountNumber || '').toLowerCase();
    const cardType = (c.cardType || c.card_type || '').toLowerCase();

    const matchesQuery = !query ||
      cardHolder.includes(query) ||
      cardNum.includes(query.replace(/\s/g, '')) ||
      userEmail.includes(query) ||
      acctNum.includes(query);

    const matchesStatus = statusVal === 'all' || c.status === statusVal || (statusVal === 'pending_approval' && (c.status === 'pending_approval' || c.status === 'requested' || c.status === 'pending'));
    const matchesType = typeVal === 'all' || cardType.includes(typeVal.toLowerCase());
    const matchesPrint = printVal === 'all' || c.printStatus === printVal;

    return matchesQuery && matchesStatus && matchesType && matchesPrint;
  });

  renderCardsTable();
}

/* ----------------------------------------------------------------------------
 * 7. RENDER CARDS TABLE & BATCH SELECTION
 * ---------------------------------------------------------------------------- */
export function renderCardsTable() {
  const tbody = document.getElementById('adminCardsTableBody');
  const countBadge = document.getElementById('cardTotalCountBadge');
  const selectAllCb = document.getElementById('selectAllCardsCb');

  if (countBadge) countBadge.textContent = `${filteredCards.length} Cards`;
  if (!tbody) return;

  if (filteredCards.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center p-5 text-muted">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">💳</div>
          <div class="font-bold text-white mb-1">No payment cards found</div>
          <div class="text-xs">Adjust your cardholder search or status filters.</div>
        </td>
      </tr>
    `;
    return;
  }

  const users = getAdminUsersList();

  const findUserForCard = (c) => {
    return users.find((u) =>
      (c.userId && String(u.id) === String(c.userId)) ||
      (c.userEmail && u.email && u.email.toLowerCase() === c.userEmail.toLowerCase()) ||
      (c.accountNumber && Array.isArray(u.accounts) && u.accounts.some((a) => a.accountNumber === c.accountNumber)) ||
      (Array.isArray(u.cards) && u.cards.some((uc) => uc.id === c.id)) ||
      (c.cardHolder && u.lastName && c.cardHolder.toLowerCase().includes(u.lastName.toLowerCase())) ||
      (c.cardHolder && c.cardHolder.toLowerCase().includes('bergkvist') && u.email && u.email.toLowerCase().includes('slipsen'))
    );
  };

  // Group filtered cards by member/cardholder so all cards issued to a user appear in one place
  const userGroupsMap = new Map();
  filteredCards.forEach((c) => {
    const matchedUser = findUserForCard(c);
    const groupKey = matchedUser ? `user_${matchedUser.id}` : (c.userEmail ? `email_${c.userEmail.toLowerCase()}` : `holder_${c.cardHolder || 'unknown'}`);

    if (!userGroupsMap.has(groupKey)) {
      const liveName = matchedUser ? getEffectiveMemberName(matchedUser).toUpperCase() : (c.cardHolder || c.cardholder_name || 'MEMBER').toUpperCase();
      const initials = liveName.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('') || 'MB';
      userGroupsMap.set(groupKey, {
        userId: matchedUser ? matchedUser.id : '',
        name: liveName,
        email: matchedUser?.email || c.userEmail || '',
        accountNumber: matchedUser?.accounts?.[0]?.accountNumber || c.accountNumber || '9482-1049-55',
        avatar: initials,
        photo: matchedUser?.profilePhoto || matchedUser?.avatarUrl || '',
        cards: []
      });
    }
    userGroupsMap.get(groupKey).cards.push(c);
  });

  let html = '';
  userGroupsMap.forEach((group) => {
    const groupCount = group.cards.length;
    const countBadgeText = groupCount === 1 ? '1 Card Issued' : `${groupCount} Different Cards Issued Under Member`;

    // Member Group Header: keeps all cards issued to a user in one place
    html += `
      <tr class="admin-card-member-group-row">
        <td colspan="9" style="background: linear-gradient(90deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95)); border-top: 2px solid #3b82f6; border-bottom: 1px solid rgba(59, 130, 246, 0.35); padding: 9px 14px;">
          <div class="d-flex items-center justify-between flex-wrap gap-2">
            <div class="d-flex items-center gap-2">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: #1e293b; border: 2px solid #3b82f6; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; color: #60a5fa; overflow: hidden; flex-shrink: 0;">
                ${group.photo ? `<img src="${escapeHtml(group.photo)}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;" />` : escapeHtml(group.avatar)}
              </div>
              <div>
                <div class="d-flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-white text-xs uppercase" style="letter-spacing: 0.04em;">${escapeHtml(group.name)}</span>
                  <span class="action-chip" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.45); font-size: 0.7rem; padding: 2px 8px; font-weight: 700;">
                    💳 ${countBadgeText}
                  </span>
                </div>
                <div class="text-xs text-muted font-mono" style="margin-top: 2px;">
                  ${escapeHtml(group.email)} • Primary Portfolio: <span class="text-white font-bold">${escapeHtml(group.accountNumber)}</span>
                </div>
              </div>
            </div>
            <div class="d-flex items-center gap-2">
              <button type="button" class="admin-btn admin-btn-primary admin-btn-sm btn-group-issue-card" data-user-id="${group.userId}" title="Issue Another Card to ${escapeHtml(group.name)}" style="padding: 4px 10px; font-size: 0.72rem; font-weight: 700;">
                ➕ Issue Another Card
              </button>
              ${group.userId ? `
                <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-group-view-drawer" data-user-id="${group.userId}" title="View Member Profile & All Cards in Drawer" style="padding: 4px 10px; font-size: 0.72rem;">
                  👤 Member Drawer &rarr;
                </button>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `;

    group.cards.forEach((c) => {
      const isChecked = selectedBatchCardIds.has(c.id);
      const isRequested = (c.status === 'pending_approval' || c.status === 'requested' || c.status === 'pending' || c.printStatus === 'requested' || currentCardsTab === 'requested');

      html += `
        <tr class="admin-user-row" data-card-id="${c.id}" onclick="if(window.openCardDetailModal){window.openCardDetailModal('${c.id}');}" style="cursor: pointer;">
          <td onclick="event.stopPropagation()">
            <input type="checkbox" class="card-batch-cb" data-card-id="${c.id}" ${isChecked ? 'checked' : ''} />
          </td>
          <td>
            <div class="d-flex items-center gap-2">
              <span style="font-size:1.1rem;">💳</span>
              <div>
                <span class="font-mono text-xs font-bold text-white">${c.cardMasked}</span>
                <div class="text-xs text-muted font-mono">Exp: ${c.expiry}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="font-bold text-white text-xs">${escapeHtml(group.name)}</div>
            <div class="text-xs text-muted font-mono">${escapeHtml(c.userEmail || group.email)}</div>
          </td>
          <td>
            <span class="admin-tx-type-tag">${escapeHtml(c.cardType || c.card_type || 'Debit')}</span>
          </td>
          <td>
            <span class="action-chip badge-status-${c.status || 'active'}">
              ${(c.status || 'active').toUpperCase()}
            </span>
          </td>
          <td>
            <span class="font-mono text-xs text-muted">${c.accountNumber || group.accountNumber}</span>
          </td>
          <td>
            <span class="font-mono text-xs text-white font-bold">$${(c.dailyAtmLimit || 0).toLocaleString()}/day</span>
          </td>
          <td>
            <span class="action-chip badge-print-${c.printStatus || 'requested'}">
              ${(c.printStatus || 'requested').replace(/_/g, ' ').toUpperCase()}
            </span>
          </td>
          <td class="text-right" onclick="event.stopPropagation()">
            <div class="d-flex items-center justify-end gap-1 flex-wrap">
              ${isRequested ? `
                <button class="admin-btn admin-btn-emerald admin-btn-sm btn-approve-card" data-card-id="${c.id}" title="Approve Card">
                  ✓ Approve
                </button>
                <button class="admin-btn admin-btn-danger admin-btn-sm btn-reject-card" data-card-id="${c.id}" title="Reject Card">
                  ✕ Reject
                </button>
                <button class="admin-btn admin-btn-danger admin-btn-sm btn-delete-card-table" data-card-id="${c.id}" title="Permanently Delete Card Request at will" style="background:#dc2626; border-color:#b91c1c; font-weight:700;">
                  🗑️ Delete Request
                </button>
              ` : `
                ${(c.status === 'active' && !c.is_frozen) ? `
                  <button class="admin-btn admin-btn-amber admin-btn-sm btn-freeze-card" data-card-id="${c.id}" title="Freeze Card">
                    ❄ Freeze
                  </button>
                ` : ''}
                ${(c.status === 'blocked' || c.status === 'frozen' || c.is_frozen) ? `
                  <button class="admin-btn admin-btn-emerald admin-btn-sm btn-unfreeze-card" data-card-id="${c.id}" title="Unfreeze Card">
                    🔓 Unfreeze
                  </button>
                ` : ''}
                <button class="admin-btn admin-btn-danger admin-btn-sm btn-delete-card-table" data-card-id="${c.id}" title="Permanently Delete Card at will" style="background:#dc2626; border-color:#b91c1c;">
                  🗑️ Delete
                </button>
              `}
              <button class="admin-btn admin-btn-primary admin-btn-sm btn-quick-download-png" data-card-id="${c.id}" title="Download physical card in PNG format">
                🖼️ PNG
              </button>
              <button class="admin-btn admin-btn-outline admin-btn-sm btn-inspect-card" data-card-id="${c.id}" onclick="event.stopPropagation(); if(window.openCardDetailModal){window.openCardDetailModal('${c.id}');}">
                Inspect &rarr;
              </button>
            </div>
          </td>
        </tr>
      `;
    });
  });

  tbody.innerHTML = html;

  // Row clicks
  tbody.querySelectorAll('.admin-user-row').forEach((row) => {
    row.addEventListener('click', () => {
      const cId = row.getAttribute('data-card-id');
      if (cId) openCardDetailModal(cId);
    });
  });

  tbody.querySelectorAll('.btn-inspect-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cId = btn.getAttribute('data-card-id');
      if (cId) openCardDetailModal(cId);
    });
  });

  // Inline Quick Approve Card
  tbody.querySelectorAll('.btn-approve-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cId = btn.getAttribute('data-card-id');
      const card = getCardById(cId);
      if (card) {
        card.status = 'active';
        card.is_frozen = false;
        updateCardInDb(card);
        renderCardDashboardMetrics();
        applyCardFilters();
        showToast(`Card for ${card.cardHolder} approved and activated.`, 'success', 'Card Approved');
      }
    });
  });

  // Inline Quick Reject Card
  tbody.querySelectorAll('.btn-reject-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cId = btn.getAttribute('data-card-id');
      const card = getCardById(cId);
      if (card) {
        card.status = 'rejected';
        updateCardInDb(card);
        renderCardDashboardMetrics();
        applyCardFilters();
        showToast(`Card for ${card.cardHolder} rejected.`, 'info', 'Card Rejected');
      }
    });
  });

  // Inline Quick Freeze Card
  tbody.querySelectorAll('.btn-freeze-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cId = btn.getAttribute('data-card-id');
      const card = getCardById(cId);
      if (card) {
        card.status = 'blocked';
        card.is_frozen = true;
        updateCardInDb(card);
        renderCardDashboardMetrics();
        applyCardFilters();
        showToast(`Card for ${card.cardHolder} has been frozen.`, 'warning', 'Card Frozen');
      }
    });
  });

  // Inline Quick Unfreeze Card
  tbody.querySelectorAll('.btn-unfreeze-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cId = btn.getAttribute('data-card-id');
      const card = getCardById(cId);
      if (card) {
        card.status = 'active';
        card.is_frozen = false;
        updateCardInDb(card);
        renderCardDashboardMetrics();
        applyCardFilters();
        showToast(`Card for ${card.cardHolder} has been unfrozen.`, 'success', 'Card Activated');
      }
    });
  });

  // Inline Quick Download PNG Card
  tbody.querySelectorAll('.btn-quick-download-png').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cId = btn.getAttribute('data-card-id');
      const card = getCardById(cId);
      if (card) {
        downloadCardAsPng(card, true);
      }
    });
  });

  // Group Header Action: Issue Another Card to Member
  tbody.querySelectorAll('.btn-group-issue-card').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uId = btn.getAttribute('data-user-id');
      if (typeof window.openIssueCardModalForUser === 'function') {
        window.openIssueCardModalForUser(uId);
      }
    });
  });

  // Group Header Action: View Member in Drawer
  tbody.querySelectorAll('.btn-group-view-drawer').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uId = btn.getAttribute('data-user-id');
      if (uId && typeof window.openUserDetailDrawer === 'function') {
        window.openUserDetailDrawer(uId);
      }
    });
  });

  // Inline Quick Delete Card / Request at will (no blocking confirm dialog)
  tbody.querySelectorAll('.btn-delete-card-table').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cId = btn.getAttribute('data-card-id');
      const card = getCardById(cId);
      const cardNum = card ? (card.cardNumber || card.cardMasked || 'this card') : 'this card';
      const holder = card ? (card.cardHolder || 'member') : 'member';
      const isReq = card ? (card.status === 'pending_approval' || card.status === 'requested' || card.status === 'pending' || card.printStatus === 'requested') : false;

      deleteCardFromDb(cId);
      showToast(
        isReq ? `Requested card (${cardNum}) for ${holder} was permanently deleted.` : `Card (${cardNum}) for ${holder} was permanently deleted.`,
        'warning',
        isReq ? 'Card Request Deleted' : 'Card Deleted'
      );
    });
  });

  // Checkbox interactions
  tbody.querySelectorAll('.card-batch-cb').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const cId = cb.getAttribute('data-card-id');
      if (e.target.checked) selectedBatchCardIds.add(cId);
      else selectedBatchCardIds.delete(cId);
      updateCardBatchToolbar();
    });
  });

  if (selectAllCb) {
    selectAllCb.checked = filteredCards.length > 0 && filteredCards.every((c) => selectedBatchCardIds.has(c.id));
  }
}

/* ----------------------------------------------------------------------------
 * 8. BATCH CARD OPERATIONS
 * ---------------------------------------------------------------------------- */
function setupBatchCardOperations() {
  const selectAllCb = document.getElementById('selectAllCardsCb');
  const toolbar = document.getElementById('adminCardBatchToolbar');
  const countSpan = document.getElementById('batchCardSelectedCount');
  const btnBatchBlock = document.getElementById('btnBatchBlockCards');
  const btnBatchUnblock = document.getElementById('btnBatchUnblockCards');
  const btnBatchPrintQueue = document.getElementById('btnBatchSendPrintQueue');

  if (selectAllCb) {
    selectAllCb.addEventListener('change', (e) => {
      if (e.target.checked) {
        filteredCards.forEach((c) => selectedBatchCardIds.add(c.id));
      } else {
        filteredCards.forEach((c) => selectedBatchCardIds.delete(c.id));
      }
      document.querySelectorAll('.card-batch-cb').forEach((cb) => {
        const id = cb.getAttribute('data-card-id');
        cb.checked = selectedBatchCardIds.has(id);
      });
      updateCardBatchToolbar();
    });
  }

  if (btnBatchBlock) {
    btnBatchBlock.addEventListener('click', () => {
      currentCards.forEach((c) => {
        if (selectedBatchCardIds.has(c.id)) c.status = 'blocked';
      });
      saveAdminCardsList(currentCards);
      showToast(`Batch blocked ${selectedBatchCardIds.size} cards.`, 'warning', 'Batch Action');
      selectedBatchCardIds.clear();
      renderCardsTable();
      updateCardBatchToolbar();
    });
  }

  if (btnBatchUnblock) {
    btnBatchUnblock.addEventListener('click', () => {
      currentCards.forEach((c) => {
        if (selectedBatchCardIds.has(c.id)) c.status = 'active';
      });
      saveAdminCardsList(currentCards);
      showToast(`Batch activated ${selectedBatchCardIds.size} cards.`, 'success', 'Batch Action');
      selectedBatchCardIds.clear();
      renderCardsTable();
      updateCardBatchToolbar();
    });
  }

  if (btnBatchPrintQueue) {
    btnBatchPrintQueue.addEventListener('click', () => {
      currentCards.forEach((c) => {
        if (selectedBatchCardIds.has(c.id)) c.printStatus = 'printing';
      });
      saveAdminCardsList(currentCards);
      showToast(`Queued ${selectedBatchCardIds.size} cards to physical printing bureau.`, 'success', 'Print Queue');
      selectedBatchCardIds.clear();
      renderCardsTable();
      updateCardBatchToolbar();
    });
  }
}

function updateCardBatchToolbar() {
  const toolbar = document.getElementById('adminCardBatchToolbar');
  const countSpan = document.getElementById('batchCardSelectedCount');
  if (!toolbar) return;

  if (selectedBatchCardIds.size > 0) {
    toolbar.classList.add('show');
    if (countSpan) countSpan.textContent = selectedBatchCardIds.size.toString();
  } else {
    toolbar.classList.remove('show');
  }
}

/* ----------------------------------------------------------------------------
 * 9. CARD DETAIL MODAL & SECURE PIN UNMASKING & PNG EXPORT
 * ---------------------------------------------------------------------------- */
function setupCardDetailModal() {
  const modal = document.getElementById('cardDetailModal');
  const closeBtn = document.getElementById('closeCardDetailModalBtn');
  if (closeBtn && modal) closeBtn.onclick = () => modal.classList.remove('show');
}

export function openCardDetailModal(cardId) {
  const card = getCardById(cardId);
  if (!card) return;

  activeDetailCard = card;
  const modal = document.getElementById('cardDetailModal');
  const body = document.getElementById('cardDetailModalBody');
  if (!modal || !body) return;

  let isUnmasked = true; // Admin has full security clearance to see whole details

  function renderModalContent() {
    const isMastercard = (card.cardType || '').toLowerCase().includes('mastercard') || (card.cardNumber || '').startsWith('5');
    const cardGrade = (() => {
      const t = (card.cardType || '').toLowerCase();
      if (t.includes('gold')) return 'GOLD';
      if (t.includes('platinum')) return 'PLATINUM';
      if (t.includes('standard') || t.includes('classic')) return 'STANDARD';
      if (t.includes('corporate')) return 'CORPORATE EXECUTIVE';
      return 'GLOBAL ELITE BLACK';
    })();

    const cardBgStyle = (() => {
      const t = (card.cardType || '').toLowerCase();
      const theme = card.theme || '';
      if (cardGrade === 'GOLD' || t.includes('gold') || theme === 'card-theme-gold') {
        return 'background:linear-gradient(135deg, #92400e 0%, #b45309 25%, #d97706 50%, #f59e0b 80%, #fbbf24 100%); border:1px solid rgba(254, 240, 138, 0.6); box-shadow:0 20px 40px rgba(0,0,0,0.4), inset 0 0 20px rgba(245, 158, 11, 0.2);';
      }
      if (cardGrade === 'PLATINUM' || t.includes('platinum') || theme === 'card-theme-platinum') {
        return 'background:linear-gradient(135deg, #475569 0%, #64748b 30%, #94a3b8 65%, #cbd5e1 85%, #64748b 100%); border:1px solid rgba(226, 232, 240, 0.7); box-shadow:0 20px 40px rgba(0,0,0,0.4), inset 0 0 20px rgba(226, 232, 240, 0.25);';
      }
      if (cardGrade === 'CORPORATE EXECUTIVE' || t.includes('corporate') || theme === 'card-theme-corporate') {
        return 'background:linear-gradient(135deg, #0f3460 0%, #1e3a8a 35%, #1d4ed8 70%, #0284c7 100%); border:1px solid rgba(96, 165, 250, 0.6); box-shadow:0 20px 40px rgba(0,0,0,0.4), inset 0 0 20px rgba(56, 189, 248, 0.2);';
      }
      if (cardGrade === 'STANDARD' || t.includes('standard') || t.includes('classic') || theme === 'card-theme-standard' || theme === 'card-theme-blue') {
        return 'background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%); border:1px solid rgba(147, 197, 253, 0.6); box-shadow:0 20px 40px rgba(0,0,0,0.4);';
      }
      return 'background:linear-gradient(135deg, #090e17 0%, #0d1522 45%, #152238 75%, #0a0f18 100%); border:1px solid rgba(255,255,255,0.15); box-shadow:0 20px 40px rgba(0,0,0,0.6);';
    })();

    body.innerHTML = `
      <!-- Realistic Visual Card Render (Modelled after Reference ATM Card) -->
      <div class="admin-card-visual-wrap ${card.theme || 'card-theme-black'}" id="cardVisualFront" style="position:relative; overflow:hidden; border-radius:18px; padding:24px 26px; min-height:260px; display:flex; flex-direction:column; justify-content:space-between; ${cardBgStyle}">
        <!-- Top Row: WBCU Branding Logo, Grade, Contactless Icon -->
        <div class="d-flex justify-between items-start">
          <div>
            <img src="https://i.ibb.co/qMPvkK0B/WBCU-LOGO-03.png" alt="WB Credit Union" style="height: 28px; width: auto; max-width: 130px; object-fit: contain; filter: brightness(0) invert(1); display: block;">
          </div>
          <div class="font-bold text-xs" style="letter-spacing:0.22em; color:#cbd5e1; text-transform:uppercase;">
            ${cardGrade}
          </div>
          <div class="text-white" title="EMV Contactless Enabled">
            <svg width="28" height="24" viewBox="0 0 32 26" fill="none" xmlns="http://www.w3.org/2000/svg" class="contactless-funnel-symbol" aria-label="EMV Contactless Indicator">
              <path d="M5 16.5C6.5 14.8 6.5 11.2 5 9.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
              <path d="M11 19.5C13.8 15.5 13.8 10.5 11 6.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
              <path d="M17 22.5C21 16.5 21 9.5 17 3.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
              <path d="M23 25.5C28.5 17.5 28.5 8.5 23 0.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <!-- EMV Chip Row -->
        <div class="d-flex items-center gap-3 my-1">
          <div class="emv-gold-chip" style="width:50px; height:38px;"></div>
          <span class="action-chip action-chip-approve font-bold text-xs" style="font-size:0.65rem;">STATUS: ${card.status.toUpperCase()}</span>
        </div>

        <!-- 16-Digit Card Number (OCR-A / Monospace) -->
        <div>
          <div class="font-mono font-bold text-xl text-white d-flex items-center justify-between" style="letter-spacing:0.2em; font-family:'Courier New', monospace; text-shadow:0 1px 3px rgba(0,0,0,0.85);" id="displayCardNumber">
            <span>${card.cardNumber}</span>
            <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" id="btnCopyCardNumber" style="font-size:0.65rem; padding:2px 8px;" title="Copy 16-Digit PAN">
              📋 Copy
            </button>
          </div>
          
          <!-- Bottom Row: Cardholder, Expiry, Network Logo -->
          <div class="d-flex justify-between items-end mt-3 gap-2">
            <div style="max-width: 52%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <span class="text-muted d-block" style="font-size:0.55rem; letter-spacing:0.12em; text-transform:uppercase; color:#94a3b8; font-weight:700;">CARDHOLDER</span>
              <span class="font-bold text-white text-sm d-block" style="letter-spacing:0.08em; text-transform:uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${card.cardHolder}">${card.cardHolder}</span>
            </div>
            <div style="flex-shrink: 0;">
              <span class="text-muted d-block" style="font-size:0.55rem; letter-spacing:0.12em; text-transform:uppercase; color:#94a3b8; font-weight:700;">VALID THRU</span>
              <span class="font-mono font-bold text-white text-sm" style="letter-spacing:0.08em;">${card.expiry}</span>
            </div>
            <div class="d-flex items-center justify-end" style="flex-shrink: 0;">
              ${isMastercard ? `
                <div style="text-align:center;">
                  <svg width="56" height="38" viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="21" cy="18" r="14" fill="#EB001B"/>
                    <circle cx="39" cy="18" r="14" fill="#F79E1B" fill-opacity="0.95"/>
                    <path d="M30 7.828A13.94 13.94 0 0 0 25.132 18 13.94 13.94 0 0 0 30 28.172 13.94 13.94 0 0 0 34.868 18 13.94 13.94 0 0 0 30 7.828Z" fill="#FF5F00"/>
                    <text x="30" y="38" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="8.5" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.3">mastercard</text>
                  </svg>
                </div>
              ` : `
                <svg width="64" height="24" viewBox="0 0 84 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <text x="2" y="23" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-style="italic" font-size="27" fill="#FFFFFF" letter-spacing="1">VISA</text>
                </svg>
              `}
            </div>
          </div>
        </div>
      </div>

      <!-- Secure PIN & CVV Vault Details (Kept strictly off the card front face) -->
      <div class="p-3 my-3 d-flex items-center justify-between" style="background:#090d16; border-radius:8px; border:1px solid #334155;">
        <div class="d-flex items-center gap-4">
          <div>
            <span class="text-xs text-muted d-block uppercase" style="font-size:0.6rem; color:#94a3b8;">Secret 3-Digit CVV (Back Only)</span>
            <span class="font-mono font-bold text-white text-sm" id="displayCvv">${card.cvv || '849'}</span>
          </div>
          <div>
            <span class="text-xs text-muted d-block uppercase" style="font-size:0.6rem; color:#94a3b8;">ATM Secret PIN</span>
            <span class="font-mono font-bold text-white text-sm">${card.pin || '1234'}</span>
          </div>
          <div>
            <span class="text-xs text-muted d-block uppercase" style="font-size:0.6rem; color:#94a3b8;">Card Form</span>
            <span class="text-xs font-bold text-emerald-400">PHYSICAL METAL / EMV CONTACTLESS</span>
          </div>
        </div>
      </div>

      <!-- Institutional Vault Security Clearances & Quick Status Action Bar -->
      <div class="p-3 mb-3 d-flex items-center justify-between flex-wrap gap-2" style="background:#090d16; border-radius:8px; border:1px solid #334155;">
        <div class="d-flex items-center gap-2 flex-wrap">
          ${(card.status === 'pending_approval' || card.status === 'inactive' || card.status === 'requested') ? `
            <button type="button" class="admin-btn admin-btn-emerald admin-btn-sm" id="btnModalApproveCard">
              ✓ Approve Card
            </button>
            <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" id="btnModalRejectCard">
              ✕ Reject Card
            </button>
          ` : ''}
          ${(card.status === 'active' && !card.is_frozen) ? `
            <button type="button" class="admin-btn admin-btn-amber admin-btn-sm" id="btnModalFreezeCard">
              ❄ Freeze Card
            </button>
          ` : ''}
          ${(card.status === 'blocked' || card.status === 'frozen' || card.is_frozen) ? `
            <button type="button" class="admin-btn admin-btn-emerald admin-btn-sm" id="btnModalUnfreezeCard">
              🔓 Unfreeze Card
            </button>
          ` : ''}
        </div>

        <div class="d-flex items-center gap-2 flex-wrap">
          <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" id="btnModalDeleteCard" style="background:#dc2626; border-color:#b91c1c; font-weight:700;">
            🗑️ Delete ${card.status === 'pending_approval' || card.status === 'requested' || card.printStatus === 'requested' ? 'Request' : 'Card'}
          </button>
          <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" id="btnDownloadCardPng">
            🖼️ Download Physical Card (PNG)
          </button>
          <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" id="btnPrintCardSlip">
            🖨️ Print Slip
          </button>
        </div>
      </div>

      <!-- Cardholder & Linked Account -->
      <div class="admin-user-acct-box mb-3">
        <h4 class="text-white text-xs font-bold uppercase mb-2" style="color:#60a5fa;">Cardholder & Fulfillment</h4>
        <div class="d-grid grid-cols-2 gap-3 mb-2">
          <div>
            <span class="text-xs text-muted d-block">Member Name</span>
            <span class="text-sm font-bold text-white">${escapeHtml(card.cardHolder)}</span>
            <span class="text-xs text-muted font-mono d-block">${card.userEmail}</span>
          </div>
          <div>
            <span class="text-xs text-muted d-block">Linked Portfolio Account</span>
            <span class="text-sm font-bold font-mono text-white">${card.accountNumber}</span>
          </div>
        </div>
        <div>
          <span class="text-xs text-muted d-block">Postal Delivery Destination</span>
          <span class="text-xs text-white">${escapeHtml(card.shippingAddress || 'On file')}</span>
        </div>
      </div>

      <!-- Controls: Status & Limits -->
      <div class="admin-user-acct-box mb-3" style="border-color: rgba(59, 130, 246, 0.4);">
        <h4 class="text-white text-xs font-bold uppercase mb-3">⚡ Card Security & Limit Overrides</h4>
        
        <div class="d-grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="admin-form-label">Operational Status</label>
            <select id="cardDetailStatusSelect" class="admin-form-control">
              <option value="active" ${card.status === 'active' ? 'selected' : ''}>Active (Authorized)</option>
              <option value="pending_approval" ${card.status === 'pending_approval' ? 'selected' : ''}>Pending Approval</option>
              <option value="inactive" ${card.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              <option value="blocked" ${card.status === 'blocked' ? 'selected' : ''}>Blocked / Locked (Security Hold)</option>
              <option value="rejected" ${card.status === 'rejected' ? 'selected' : ''}>Rejected</option>
              <option value="expired" ${card.status === 'expired' ? 'selected' : ''}>Expired</option>
            </select>
          </div>
          <div>
            <label class="admin-form-label">Physical Print Status</label>
            <select id="cardDetailPrintStatusSelect" class="admin-form-control">
              <option value="not_requested" ${card.printStatus === 'not_requested' ? 'selected' : ''}>Not Requested</option>
              <option value="requested" ${card.printStatus === 'requested' ? 'selected' : ''}>Requested (In Queue)</option>
              <option value="printing" ${card.printStatus === 'printing' ? 'selected' : ''}>Printing (Embroidery)</option>
              <option value="shipped" ${card.printStatus === 'shipped' ? 'selected' : ''}>Shipped (In Transit)</option>
              <option value="delivered" ${card.printStatus === 'delivered' ? 'selected' : ''}>Delivered to Member</option>
            </select>
          </div>
        </div>

        <div class="admin-form-group mb-3">
          <label class="admin-form-label">Tracking Number (Courier / Swiss Post)</label>
          <input type="text" id="cardDetailTrackingInput" class="admin-form-control font-mono" value="${escapeHtml(card.trackingNumber || '')}" placeholder="e.g. CH-POST-99201482-SWISS" />
        </div>

        <div class="d-grid grid-cols-3 gap-3 mb-3">
          <div>
            <label class="admin-form-label">Daily ATM ($)</label>
            <input type="number" id="cardDetailAtmLimitInput" class="admin-form-control" value="${card.dailyAtmLimit}" />
          </div>
          <div>
            <label class="admin-form-label">Daily POS ($)</label>
            <input type="number" id="cardDetailPosLimitInput" class="admin-form-control" value="${card.dailyPosLimit}" />
          </div>
          <div>
            <label class="admin-form-label">Monthly Limit ($)</label>
            <input type="number" id="cardDetailMonthlyLimitInput" class="admin-form-control" value="${card.monthlyLimit}" />
          </div>
        </div>

        <div class="d-flex items-center gap-4 flex-wrap mb-3 p-2" style="background:#090d16; border-radius:8px;">
          <label class="d-flex items-center gap-2 text-xs text-white" style="cursor:pointer;">
            <input type="checkbox" id="cardDetailAllowOnline" ${card.allowOnline ? 'checked' : ''} />
            <span>Online E-Commerce</span>
          </label>
          <label class="d-flex items-center gap-2 text-xs text-white" style="cursor:pointer;">
            <input type="checkbox" id="cardDetailAllowInternational" ${card.allowInternational ? 'checked' : ''} />
            <span>International Foreign ATM</span>
          </label>
          <label class="d-flex items-center gap-2 text-xs text-white" style="cursor:pointer;">
            <input type="checkbox" id="cardDetailAllowContactless" ${card.allowContactless ? 'checked' : ''} />
            <span>Contactless NFC</span>
          </label>
        </div>

        <button type="button" class="admin-btn admin-btn-primary w-100" id="btnSaveCardSettings">
          Save Card Modifications & Dispatch Member Alerts
        </button>
      </div>
    `;

    // Bind Copy Card Number
    const copyBtn = document.getElementById('btnCopyCardNumber');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard?.writeText(card.cardNumber.replace(/\s+/g, ''));
        showToast('Card number copied to clipboard.', 'success', 'Copied');
      };
    }

    // Bind Modal Approve Card button
    const approveBtn = document.getElementById('btnModalApproveCard');
    if (approveBtn) {
      approveBtn.onclick = () => {
        card.status = 'active';
        card.is_frozen = false;
        updateCardInDb(card);
        renderCardDashboardMetrics();
        applyCardFilters();
        renderModalContent();
        showToast(`Card for ${card.cardHolder} has been approved and activated.`, 'success', 'Card Approved');
      };
    }

    // Bind Modal Reject Card button
    const rejectBtn = document.getElementById('btnModalRejectCard');
    if (rejectBtn) {
      rejectBtn.onclick = () => {
        card.status = 'rejected';
        updateCardInDb(card);
        renderCardDashboardMetrics();
        applyCardFilters();
        renderModalContent();
        showToast(`Card for ${card.cardHolder} has been rejected.`, 'info', 'Card Rejected');
      };
    }

    // Bind Modal Freeze Card button
    const freezeBtn = document.getElementById('btnModalFreezeCard');
    if (freezeBtn) {
      freezeBtn.onclick = () => {
        card.status = 'blocked';
        card.is_frozen = true;
        updateCardInDb(card);
        renderCardDashboardMetrics();
        applyCardFilters();
        renderModalContent();
        showToast(`Card for ${card.cardHolder} is now frozen.`, 'warning', 'Card Frozen');
      };
    }

    // Bind Modal Unfreeze Card button
    const unfreezeBtn = document.getElementById('btnModalUnfreezeCard');
    if (unfreezeBtn) {
      unfreezeBtn.onclick = () => {
        card.status = 'active';
        card.is_frozen = false;
        updateCardInDb(card);
        renderCardDashboardMetrics();
        applyCardFilters();
        renderModalContent();
        showToast(`Card for ${card.cardHolder} has been unfrozen.`, 'success', 'Card Activated');
      };
    }

    // Bind Delete Card/Request button in modal
    const modalDeleteBtn = document.getElementById('btnModalDeleteCard');
    if (modalDeleteBtn) {
      modalDeleteBtn.onclick = () => {
        const holder = card.cardHolder || 'member';
        const cardNum = card.cardNumber || card.cardMasked || 'this card';
        const isReq = (card.status === 'pending_approval' || card.status === 'requested' || card.printStatus === 'requested');
        deleteCardFromDb(card.id);
        modal.classList.remove('show');
        showToast(
          isReq ? `Requested card (${cardNum}) for ${holder} was permanently deleted.` : `Card (${cardNum}) for ${holder} was permanently deleted.`,
          'warning',
          isReq ? 'Card Request Deleted' : 'Card Deleted'
        );
      };
    }

    // Bind Download PNG button
    const downloadPngBtn = document.getElementById('btnDownloadCardPng');
    if (downloadPngBtn) {
      downloadPngBtn.onclick = () => {
        downloadCardAsPng(card, true);
      };
    }

    // Bind Print Slip button
    const printSlipBtn = document.getElementById('btnPrintCardSlip');
    if (printSlipBtn) {
      printSlipBtn.onclick = () => {
        printPhysicalCardSlip(card);
      };
    }

    // Bind Save Settings
    const saveBtn = document.getElementById('btnSaveCardSettings');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const newStatus = document.getElementById('cardDetailStatusSelect')?.value;
        const newPrintStatus = document.getElementById('cardDetailPrintStatusSelect')?.value;
        const tracking = document.getElementById('cardDetailTrackingInput')?.value.trim();
        const atmLim = parseFloat(document.getElementById('cardDetailAtmLimitInput')?.value || '10000');
        const posLim = parseFloat(document.getElementById('cardDetailPosLimitInput')?.value || '50000');
        const monthlyLim = parseFloat(document.getElementById('cardDetailMonthlyLimitInput')?.value || '250000');
        const allowOnline = document.getElementById('cardDetailAllowOnline')?.checked;
        const allowIntl = document.getElementById('cardDetailAllowInternational')?.checked;
        const allowNfc = document.getElementById('cardDetailAllowContactless')?.checked;

        card.status = newStatus;
        card.is_frozen = newStatus === 'blocked';
        card.printStatus = newPrintStatus;
        card.trackingNumber = tracking;
        card.dailyAtmLimit = atmLim;
        card.dailyPosLimit = posLim;
        card.monthlyLimit = monthlyLim;
        card.allowOnline = allowOnline;
        card.allowInternational = allowIntl;
        card.allowContactless = allowNfc;

        updateCardInDb(card);
        renderCardDashboardMetrics();
        applyCardFilters();

        modal.classList.remove('show');
        showToast(`Card for ${card.cardHolder} updated. Status: ${newStatus.toUpperCase()}`, 'success', 'Card Updated');
      };
    }
  }

  renderModalContent();
  modal.classList.add('show');
  modal.style.display = 'flex';
}

/* ----------------------------------------------------------------------------
 * 10. PNG EXPORT & PHYSICAL CARD PRINT SLIP GENERATOR
 * ---------------------------------------------------------------------------- */
import { WBCU_LOGO_WHITE_DATA_URL } from './card-logo-asset.js';

const cachedAdminLogoImg = typeof Image !== 'undefined' ? new Image() : null;
if (cachedAdminLogoImg) {
  cachedAdminLogoImg.src = WBCU_LOGO_WHITE_DATA_URL;
}

function drawCardOfficialLogo(ctx, x, y, width = 140, height = 70) {
  if (cachedAdminLogoImg && cachedAdminLogoImg.complete && cachedAdminLogoImg.naturalWidth > 0) {
    ctx.drawImage(cachedAdminLogoImg, x, y, width, height);
  } else if (typeof Image !== 'undefined') {
    const img = new Image();
    img.src = WBCU_LOGO_WHITE_DATA_URL;
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, width, height);
    }
  }
}

function drawAuthenticContactlessFunnel(ctx, x, y, scale = 1.4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.6;

  // 4 progressive radiating waves matching the exact Dashboard SVG funnel symbol
  // Wave 1 (Innermost arc)
  ctx.beginPath();
  ctx.moveTo(5, 16.5);
  ctx.bezierCurveTo(6.5, 14.8, 6.5, 11.2, 5, 9.5);
  ctx.stroke();

  // Wave 2
  ctx.beginPath();
  ctx.moveTo(11, 19.5);
  ctx.bezierCurveTo(13.8, 15.5, 13.8, 10.5, 11, 6.5);
  ctx.stroke();

  // Wave 3
  ctx.beginPath();
  ctx.moveTo(17, 22.5);
  ctx.bezierCurveTo(21, 16.5, 21, 9.5, 17, 3.5);
  ctx.stroke();

  // Wave 4 (Outermost funnel flare)
  ctx.beginPath();
  ctx.moveTo(23, 25.5);
  ctx.bezierCurveTo(28.5, 17.5, 28.5, 8.5, 23, 0.5);
  ctx.stroke();

  ctx.restore();
}

function triggerCanvasImageDownload(canvas, filename) {
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // Dispatch native click synchronously within user interaction context
    if (typeof link.click === 'function') {
      link.click();
    } else {
      const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      link.dispatchEvent(evt);
    }
    
    setTimeout(() => {
      if (link && link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }, 150);
  } catch (err) {
    console.warn('Canvas direct dataURL download fallback:', err);
    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      if (link.parentNode) link.parentNode.removeChild(link);
    } catch(e) {
      console.error('Download card error:', e);
    }
  }
}

function downloadCardAsPng(card, isUnmasked) {
  const canvas = document.createElement('canvas');
  canvas.width = 1012; // High-res 3.375in at 300DPI
  canvas.height = 638; // 2.125in at 300DPI
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cardGrade = (() => {
    const t = (card.cardType || '').toLowerCase();
    if (t.includes('gold')) return 'GOLD';
    if (t.includes('platinum')) return 'PLATINUM';
    if (t.includes('standard') || t.includes('classic')) return 'STANDARD';
    if (t.includes('corporate')) return 'CORPORATE EXECUTIVE';
    return 'GLOBAL ELITE BLACK';
  })();

  // Authentic Luxury Gradient based on tier
  const grad = ctx.createLinearGradient(0, 0, 1012, 638);
  const typeLower = (card.cardType || '').toLowerCase();
  const themeLower = (card.theme || '').toLowerCase();

  if (cardGrade === 'GOLD' || typeLower.includes('gold') || themeLower.includes('gold')) {
    grad.addColorStop(0, '#92400e');
    grad.addColorStop(0.25, '#b45309');
    grad.addColorStop(0.5, '#d97706');
    grad.addColorStop(0.8, '#f59e0b');
    grad.addColorStop(1, '#fbbf24');
  } else if (cardGrade === 'PLATINUM' || typeLower.includes('platinum') || themeLower.includes('platinum')) {
    grad.addColorStop(0, '#475569');
    grad.addColorStop(0.3, '#64748b');
    grad.addColorStop(0.65, '#94a3b8');
    grad.addColorStop(0.85, '#cbd5e1');
    grad.addColorStop(1, '#64748b');
  } else if (cardGrade === 'CORPORATE EXECUTIVE' || typeLower.includes('corporate') || themeLower.includes('corporate')) {
    grad.addColorStop(0, '#0f3460');
    grad.addColorStop(0.35, '#1e3a8a');
    grad.addColorStop(0.7, '#1d4ed8');
    grad.addColorStop(1, '#0284c7');
  } else if (cardGrade === 'STANDARD' || typeLower.includes('standard') || typeLower.includes('classic') || themeLower.includes('blue') || themeLower.includes('standard')) {
    grad.addColorStop(0, '#1e3a8a');
    grad.addColorStop(0.5, '#2563eb');
    grad.addColorStop(1, '#3b82f6');
  } else {
    // Only Global Elite Black / Infinite is Black
    grad.addColorStop(0, '#090e17');
    grad.addColorStop(0.45, '#0d1522');
    grad.addColorStop(0.75, '#152238');
    grad.addColorStop(1, '#0a0f18');
  }

  // Draw Card Body
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, 1012, 638, [36, 36, 36, 36]);
  else ctx.fillRect(0, 0, 1012, 638);
  ctx.fill();

  // Draw Subtle Border & Sheen
  if (cardGrade === 'GOLD' || typeLower.includes('gold')) {
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
  } else if (cardGrade === 'PLATINUM' || typeLower.includes('platinum')) {
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
  } else if (cardGrade === 'CORPORATE EXECUTIVE' || typeLower.includes('corporate')) {
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
  } else if (cardGrade === 'STANDARD' || typeLower.includes('standard')) {
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.6)';
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  }
  ctx.lineWidth = 3;
  ctx.stroke();

  // 1. Top-Left Bank Brand Lockup: Official WB Credit Union Brand Logo
  drawCardOfficialLogo(ctx, 55, 48, 140, 70);

  // 2. Top-Center Card Grade / Tier
  const isMastercard = (card.cardType || '').toLowerCase().includes('mastercard') || (card.cardNumber || '').startsWith('5');

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '800 20px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cardGrade, 506, 80);
  ctx.textAlign = 'left';

  // 3. Top-Right: Authentic 4-Wave EMVCo Contactless Funnel Symbol (Exact match to Dashboard SVG)
  drawAuthenticContactlessFunnel(ctx, 915, 60, 1.5);

  // 4. Gold EMV Smart Chip
  const chipGrad = ctx.createLinearGradient(55, 175, 175, 270);
  chipGrad.addColorStop(0, '#ffd700');
  chipGrad.addColorStop(0.35, '#d4af37');
  chipGrad.addColorStop(0.7, '#b8860b');
  chipGrad.addColorStop(1, '#ffd700');
  ctx.fillStyle = chipGrad;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(55, 175, 120, 90, [16, 16, 16, 16]);
  else ctx.fillRect(55, 175, 120, 90);
  ctx.fill();
  ctx.strokeStyle = 'rgba(133, 77, 14, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chip Circuit Divisions
  ctx.strokeStyle = 'rgba(113, 63, 18, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(55, 220);
  ctx.lineTo(175, 220);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(95, 175);
  ctx.lineTo(95, 265);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(135, 175);
  ctx.lineTo(135, 265);
  ctx.stroke();

  // 5. Card Number (16 Digits Monospace Embossed)
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 46px "Courier New", monospace';
  const rawNum = isUnmasked ? card.cardNumber : card.cardMasked;
  const numToDraw = (rawNum || '5412 4925 3749 3461').replace(/(\d{4})(?=\d)/g, '$1 ');
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText(numToDraw, 55, 395);
  ctx.shadowColor = 'transparent';

  // 6. Bottom Row: Cardholder Label + Name (Auto-scaling to prevent overlap with Valid Thru)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('CARDHOLDER', 55, 490);

  const holderName = (card.cardHolder || card.cardholder_name || 'MIZ BRYMO').toUpperCase();
  const maxNameWidth = 470;
  let nameFontSize = 28;
  ctx.font = `800 ${nameFontSize}px "Helvetica Neue", Arial, sans-serif`;
  while (ctx.measureText(holderName).width > maxNameWidth && nameFontSize > 14) {
    nameFontSize -= 1;
    ctx.font = `800 ${nameFontSize}px "Helvetica Neue", Arial, sans-serif`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(holderName, 55, 535, maxNameWidth);

  // 7. Bottom Row: Valid Thru Label + Expiry (Positioned safely at x = 560 with dedicated space)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('VALID THRU', 560, 490);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px "Courier New", monospace';
  ctx.fillText(card.expiry || '09/31', 560, 535);

  // 8. Bottom Row: Network Logo (Mastercard or Visa)
  if (isMastercard) {
    // Interlocking Red & Orange/Yellow Circles
    ctx.fillStyle = '#EB001B';
    ctx.beginPath();
    ctx.arc(860, 500, 36, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = 'rgba(247, 158, 27, 0.95)';
    ctx.beginPath();
    ctx.arc(905, 500, 36, 0, 2 * Math.PI);
    ctx.fill();

    // Overlapping blend section
    ctx.fillStyle = '#FF5F00';
    ctx.beginPath();
    ctx.arc(860, 500, 36, -0.3 * Math.PI, 0.3 * Math.PI);
    ctx.arc(905, 500, 36, 0.7 * Math.PI, 1.3 * Math.PI);
    ctx.fill();

    // "mastercard" text clearly written underneath
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('mastercard', 882, 564);
    ctx.textAlign = 'left';
  } else {
    // "VISA" in bold italic typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 900 48px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('VISA', 835, 535);
  }

  // Instant Trigger Download (Allows infinite re-occuring downloads on every click)
  const safeName = (card.cardHolder || 'Member').replace(/\s+/g, '_');
  const filename = `WB_Credit_Union_Card_${safeName}_${cardGrade}.png`;
  triggerCanvasImageDownload(canvas, filename);
  showToast(`High-resolution PNG card downloaded for ${card.cardHolder || 'Member'}.`, 'success', 'PNG Exported');
}

function printPhysicalCardSlip(card) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Pop-up blocker prevented opening print view. Please allow popups for this site.', 'warning', 'Print Blocked');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WB Credit Union - Physical Card Fulfillment Slip</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; }
        .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
        .title { font-size: 20px; font-weight: bold; color: #1e3a8a; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; }
        .label { font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
        .val { font-size: 14px; font-weight: bold; }
        .signature-box { margin-top: 40px; border-top: 1px dashed #94a3b8; padding-top: 15px; }
      </style>
    </head>
    <body onload="window.print();">
      <div class="header">
        <div>
          <div class="title">WB CREDIT UNION - SWISS TREASURY</div>
          <div style="font-size: 12px; color:#64748b;">Physical Debit / ATM Card Issuance Manifest</div>
        </div>
        <div style="text-align: right; font-size: 12px;">
          <div><strong>Clearance Station:</strong> Zurich Central Hub</div>
          <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div class="grid">
        <div class="box">
          <div class="label">Member Cardholder</div>
          <div class="val">${card.cardHolder}</div>
          <div style="font-size:12px; color:#64748b;">${card.userEmail}</div>
        </div>
        <div class="box">
          <div class="label">Linked Account Number</div>
          <div class="val">${card.accountNumber}</div>
        </div>
        <div class="box">
          <div class="label">Card Tier / Design</div>
          <div class="val">${card.cardType}</div>
        </div>
        <div class="box">
          <div class="label">Masked Number & Expiry</div>
          <div class="val">${card.cardMasked} (Exp: ${card.expiry})</div>
        </div>
      </div>

      <div class="box" style="margin-bottom: 20px;">
        <div class="label">Shipping Postal Address</div>
        <div class="val">${card.shippingAddress || 'On file'}</div>
        <div style="font-size:12px; color:#64748b; margin-top:4px;">Tracking: ${card.trackingNumber || 'Pending Courier Pickup'}</div>
      </div>

      <div class="signature-box">
        <div style="font-size:12px; color:#64748b;">Authorized Treasury Officer Signature: _______________________ (Chief Treasury Auditor)</div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/* ----------------------------------------------------------------------------
 * 11. ISSUE NEW CARD WIZARD
 * ---------------------------------------------------------------------------- */
function setupIssueNewCardModal() {
  const modal = document.getElementById('issueNewCardModal');
  const openBtn = document.getElementById('btnOpenIssueCardModal');
  const form = document.getElementById('adminIssueCardForm');
  const userSelect = document.getElementById('issueCardUserSelect');
  const acctSelect = document.getElementById('issueCardAccountSelect');
  const submitBtn = document.getElementById('btnSubmitIssueCard');

  function populateIssueCardUsers(preferredUserId = null) {
    if (!userSelect) return;
    const users = getAdminUsersList();
    if (!users || users.length === 0) return;

    const currentVal = preferredUserId || userSelect.value;
    userSelect.innerHTML = users.map((u) => {
      const rawName = u.fullName || u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.email ? u.email.split('@')[0] : 'Member');
      const email = u.email || '';
      return `<option value="${u.id}">${escapeHtml(rawName)} (${escapeHtml(email)})</option>`;
    }).join('');

    if (currentVal && users.some((u) => String(u.id) === String(currentVal))) {
      userSelect.value = currentVal;
    }

    updateIssueAccounts();
    userSelect.onchange = updateIssueAccounts;
  }

  function updateIssueAccounts() {
    if (!acctSelect || !userSelect) return;
    const users = getAdminUsersList();
    const userId = userSelect.value;
    const user = users.find((u) => String(u.id) === String(userId)) || users[0];
    if (!user) return;

    const accounts = (user.accounts && user.accounts.length > 0)
      ? user.accounts
      : [
          {
            accountNumber: `9482-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`,
            name: 'US Dollar Primary Vault',
            currency: 'USD',
            balance: 100000
          }
        ];

    acctSelect.innerHTML = accounts.map((a) => `
      <option value="${a.accountNumber}">${a.accountNumber} - ${a.name || 'Primary Portfolio'} (${a.currency || 'USD'} ${(a.balance || 0).toLocaleString()})</option>
    `).join('');
  }

  // Pre-populate users immediately so the modal is never blank
  try {
    populateIssueCardUsers();
  } catch (err) {
    console.warn('Initial issue card users populate error:', err);
  }

  if (typeof window !== 'undefined') {
    window.openIssueCardModalForUser = function(preferredUserId) {
      if (!modal) return;
      populateIssueCardUsers(preferredUserId);
      modal.classList.add('show');
      modal.style.display = 'flex';
    };
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      populateIssueCardUsers();
      modal.classList.add('show');
      modal.style.display = 'flex';
    });
  }

  // Also check if modal is displayed without click on openBtn
  if (modal) {
    const observer = new MutationObserver(() => {
      if (modal.classList.contains('show') && (!userSelect || userSelect.options.length === 0)) {
        populateIssueCardUsers();
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  let isIssuing = false;

  function executeIssueCard(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isIssuing) return;
    isIssuing = true;
    setTimeout(() => { isIssuing = false; }, 1000);

    const users = getAdminUsersList();
    const userId = userSelect?.value;
    let user = users.find((u) => String(u.id) === String(userId));
    if (!user && userSelect && userSelect.selectedOptions && userSelect.selectedOptions[0]) {
      const optText = (userSelect.selectedOptions[0].textContent || '').toLowerCase();
      user = users.find((u) => (u.email && optText.includes(u.email.toLowerCase())) || (u.fullName && optText.includes(u.fullName.toLowerCase())));
    }
    if (!user && users.length > 0) {
      user = users[0];
    }

    if (!user) {
      showToast('Please select a member portfolio.', 'warning', 'Selection Required');
      return;
    }

    const memberName = user.fullName || user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || (user.email ? user.email.split('@')[0] : 'Member');
    const memberEmail = user.email || 'member@wbcu.net';

    let acctNum = acctSelect?.value;
    if (!acctNum && user.accounts && user.accounts.length > 0) {
      acctNum = user.accounts[0].accountNumber;
    }
    if (!acctNum) {
      acctNum = `9482-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;
    }

    const cardTypeSelect = document.getElementById('issueCardTypeSelect');
    const selectedOptionText = cardTypeSelect?.selectedOptions?.[0]?.textContent || '';
    const cardTypeRaw = cardTypeSelect?.value || 'Visa Infinite Global Elite Black Metal';
    const cardType = selectedOptionText
      ? selectedOptionText.replace(/\s*\(\$[\d,.]+\)\s*$/, '').trim()
      : cardTypeRaw;

    const atmLim = parseFloat(document.getElementById('issueCardAtmLimit')?.value || '10000') || 10000;
    const posLim = parseFloat(document.getElementById('issueCardPosLimit')?.value || '50000') || 50000;

    // Generate 16 digits based on network (5412 for Mastercard, 4532 for Visa)
    const isMc = cardType.toLowerCase().includes('mastercard') || cardTypeRaw.toLowerCase().includes('mastercard');
    const prefix = isMc ? '5412' : '4532';
    const randomMid1 = Math.floor(1000 + Math.random() * 9000);
    const randomMid2 = Math.floor(1000 + Math.random() * 9000);
    const random4 = Math.floor(1000 + Math.random() * 9000);
    const fullNum = `${prefix} ${randomMid1} ${randomMid2} ${random4}`;
    const rawCardNum = `${prefix}${randomMid1}${randomMid2}${random4}`;
    const cvv = Math.floor(100 + Math.random() * 900).toString();

    let theme = 'card-theme-black';
    const ctLower = cardType.toLowerCase();
    if (ctLower.includes('standard')) theme = 'card-theme-standard';
    else if (ctLower.includes('gold')) theme = 'card-theme-gold';
    else if (ctLower.includes('platinum')) theme = 'card-theme-platinum';
    else if (ctLower.includes('corporate')) theme = 'card-theme-corporate';
    else theme = 'card-theme-black';

    const expYear = String((new Date().getFullYear() + 5) % 100).padStart(2, '0');
    const expiryStr = `10/${expYear}`;

    const newCard = {
      id: `crd-${Date.now()}`,
      cardNumber: fullNum,
      cardMasked: `•••• •••• •••• ${random4}`,
      card_number: rawCardNum,
      cardHolder: memberName.toUpperCase(),
      cardholder_name: memberName.toUpperCase(),
      cvv,
      pin: user.transactionPin || user.pin || '1234',
      expiry: expiryStr,
      expiry_month: '10',
      expiry_year: expYear,
      userId: user.id,
      userEmail: memberEmail,
      accountNumber: acctNum,
      cardType,
      card_type: isMc ? 'mastercard_world' : 'visa_infinite',
      card_network: isMc ? 'Mastercard' : 'Visa',
      card_form: 'physical',
      theme,
      status: 'active',
      is_frozen: false,
      printStatus: 'requested',
      trackingNumber: `CH-POST-${Math.floor(10000000 + Math.random() * 90000000)}-SWISS`,
      shippingAddress: user.address || 'Zurich HQ Pickup',
      dailyAtmLimit: atmLim,
      dailyPosLimit: posLim,
      daily_limit: posLim,
      atm_limit: atmLim,
      monthlyLimit: atmLim * 10,
      monthly_limit: atmLim * 10,
      allowOnline: true,
      allowInternational: true,
      allowContactless: true,
      createdAt: new Date().toISOString(),
      recentTransactions: []
    };

    // 1. Update currentCards in memory & admin cards DB
    currentCards.unshift(newCard);
    saveAdminCardsList(currentCards);

    // 2. Add to user profile & update user record
    if (!user.cards) user.cards = [];
    user.cards.unshift(newCard);
    updateUser(user);
    saveAdminUsersList(users);

    // 3. Sync to member portal atm cards storage (wb_credit_union_atm_cards)
    try {
      const rawAtm = localStorage.getItem('wb_credit_union_atm_cards');
      let atmCards = rawAtm ? JSON.parse(rawAtm) : [];
      if (!Array.isArray(atmCards)) atmCards = [];
      atmCards.unshift(newCard);
      localStorage.setItem('wb_credit_union_atm_cards', JSON.stringify(atmCards));
    } catch (e) {
      console.warn('ATM cards sync error:', e);
    }

    // 4. If current logged-in demo user matches, update active session
    try {
      const activeDemo = getDemoStorageUser();
      if (activeDemo && (activeDemo.id === user.id || (activeDemo.email && activeDemo.email.toLowerCase() === memberEmail.toLowerCase()))) {
        if (!activeDemo.cards) activeDemo.cards = [];
        activeDemo.cards.unshift(newCard);
        setDemoStorageUser(activeDemo);
      }
    } catch (e) {}

    // 5. Activity log & notification
    try {
      createNotification(
        'Card Issued',
        `New ${cardType} ending in ${random4} generated & issued to ${memberName}.`,
        'card',
        user.id
      );
    } catch (e) {}

    // 6. Refresh UI components safely
    try { renderCardDashboardMetrics(); } catch (e) {}
    try { renderCardTypesDonutChart(); } catch (e) {}
    try { applyCardFilters(); } catch (e) {}
    try { renderCardsTable(); } catch (e) {}

    // 7. Reset form & close modal
    if (form) form.reset();
    if (modal) {
      modal.classList.remove('show');
      modal.style.display = 'none';
      setTimeout(() => { modal.style.display = ''; }, 300);
    }

    showToast(`New ${cardType} successfully issued for ${memberName}.`, 'success', 'Card Generated & Issued');
  }

  // Attach to both direct button click and form submit
  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      executeIssueCard(e);
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      executeIssueCard(e);
    });
  }
}

/* ----------------------------------------------------------------------------
 * 12. CARD DESIGN TEMPLATES GALLERY
 * ---------------------------------------------------------------------------- */
function setupCardDesignTemplates() {
  const boxes = document.querySelectorAll('.admin-card-template-box');
  boxes.forEach((b) => {
    b.addEventListener('click', () => {
      boxes.forEach((box) => box.classList.remove('selected'));
      b.classList.add('selected');
      const name = b.getAttribute('data-template-name') || 'Design';
      showToast(`Template "${name}" set as default for new issuance.`, 'info', 'Default Template');
    });
  });
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
