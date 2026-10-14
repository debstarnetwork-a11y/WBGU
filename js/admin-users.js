/**
 * ============================================================================
 * WB CREDIT UNION - ADMIN USER MANAGEMENT CONTROLLER (js/admin-users.js)
 * ============================================================================
 * 
 * Complete enterprise administration engine for bank members:
 * - Search, filtering (Status, KYC, Account type, Date range), sorting, pagination
 * - Bulk operations (Activate, Suspend, Delete)
 * - User Detail slide-in drawer with multi-tab controls:
 *     1. Profile & KYC status management + Admin Impersonation ("Login as User")
 *     2. Account Management: Credit/Debit ledger adjustments, balance edits, freeze/unfreeze
 *     3. Transaction ledger inspection & live modifications (status, notes, amount)
 *     4. ATM Card issuance, lock/unlock, and limit overrides
 *     5. Crypto custodial wallet balance management
 *     6. Wire Transfer Codes: Assign & configure COT, TAX, IMF, AML, PAP clearance keys
 *     7. Direct member push notifications & email dispatch
 *     8. Immutable audit trail & login activity telemetry
 * - Export to CSV & PDF (jsPDF)
 * - Create New User with immediate wire code allocation & initial deposit
 * ============================================================================
 */

import {
  showToast,
  setDemoStorageUser,
  getDemoStorageUser,
  getCurrentUser,
} from './supabase-config.js';
import { createNotification } from './notifications-email.js';

const ADMIN_USERS_STORAGE_KEY = 'wb_credit_union_admin_users_db';

/* ----------------------------------------------------------------------------
 * 0. WORLD COUNTRIES LIST
 * ---------------------------------------------------------------------------- */
export const WORLD_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
  "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
  "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar",
  "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan",
  "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
  "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
  "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
  "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
  "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

export function populateWorldCountriesDropdown(selectEl, selectedCountry = 'Afghanistan') {
  if (!selectEl) return;
  selectEl.innerHTML = WORLD_COUNTRIES.map((c) => `
    <option value="${c}" ${(selectedCountry && c.toLowerCase() === selectedCountry.toLowerCase()) ? 'selected' : ''}>${c}</option>
  `).join('');
}

/* ----------------------------------------------------------------------------
 * 1. SEED DATA HELPERS & INITIAL SEED DATA
 * ---------------------------------------------------------------------------- */
export function getEffectiveMemberName(targetUser = null) {
  if (targetUser) {
    if (targetUser.fullName && targetUser.fullName !== 'Alexander Morgan') return targetUser.fullName;
    if (targetUser.name && targetUser.name !== 'Alexander Morgan') return targetUser.name;
    const combined = `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim();
    if (combined && combined !== 'Alexander Morgan') return combined;
    if (targetUser.email) return targetUser.email.split('@')[0];
  }
  try {
    const profileRaw = localStorage.getItem('wbcu_user_profile_v1');
    if (profileRaw) {
      const p = JSON.parse(profileRaw);
      const name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
      if (name && name !== 'Alexander Morgan') return name;
    }
  } catch (e) {}
  try {
    const active = JSON.parse(localStorage.getItem('wb_credit_union_active_user') || '{}');
    if (active?.fullName) return active.fullName;
    if (active?.name) return active.name;
    if (active?.email) return active.email.split('@')[0];
  } catch (e) {}
  return 'Chief Treasury Auditor';
}

export function getEffectiveMemberEmail(targetUser = null) {
  if (targetUser && targetUser.email) {
    return targetUser.email;
  }
  try {
    const profileRaw = localStorage.getItem('wbcu_user_profile_v1');
    if (profileRaw) {
      const p = JSON.parse(profileRaw);
      if (p.email && p.email !== 'mizbrymo@gmail.com') return p.email;
    }
  } catch (e) {}
  try {
    const active = JSON.parse(localStorage.getItem('wb_credit_union_active_user') || '{}');
    if (active?.email && active.email !== 'admin@wbcu.net') return active.email;
  } catch (e) {}
  return 'mizbrymo@gmail.com';
}

export const initialSeedUsers = [
  {
    id: 'usr-101',
    fullName: 'Miz Brymo',
    email: 'mizbrymo@gmail.com',
    password: '12345',
    role: 'Super Admin',
    is_admin: true,
    phone: '+41 44 915 8901',
    avatar: 'MB',
    avatarColor: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
    dob: '1984-06-14',
    address: '109, Feldgüetliweg, Meilen, Zurich 8706, Switzerland',
    nationality: 'Switzerland',
    status: 'active',
    statusReason: 'Super Admin Clearance',
    kycStatus: 'verified',
    createdAt: '2025-01-15T09:30:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '9482-1049-55', type: 'Checking', name: 'Premier Checking Account', currency: 'USD', balance: 248500.00, status: 'active', routingNumber: '021000089', isPrimary: true },
      { accountNumber: '9482-1049-56', type: 'Savings', name: 'Swiss High-Yield Wealth Reserve', currency: 'CHF', balance: 1450000.00, status: 'active', routingNumber: '021000089' }
    ],
    transactions: [],
    cards: [
      { id: 'crd-1', cardNumber: '•••• •••• •••• 1234', cardHolder: 'MIZ BRYMO', type: 'Black Metal Premier', expiry: '09/29', status: 'active', dailyAtmLimit: 10000, onlineLimit: 50000 }
    ],
    cryptoWallets: [
      { currency: 'BTC', balance: 4.85, address: 'bc1q9x48v2m9sl3k0pw84mz789xq4e9', status: 'active' }
    ],
    wireTransferCodes: {
      COT: { code: 'CT-78234', active: true, notes: 'Cost of Transfer clearance token for Swiss SWIFT' },
      TAX: { code: 'TX-99120', active: true, notes: 'Federal Tax Clearance certificate' },
      IMF: { code: 'IMF-44912', active: true, notes: 'International Monetary Fund regulatory signoff' },
      AML: { code: 'AML-00821', active: true, notes: 'Anti-Money Laundering verification key' },
      PAP: { code: 'PAP-33810', active: true, notes: 'Proof of Anti-Piracy / Source of Wealth code' }
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
    status: 'inactive',
    account_status: 'inactive',
    accountStatus: 'dormant',
    statusReason: 'Pending Administrative Approval',
    kycStatus: 'pending',
    kyc_status: 'pending',
    createdAt: '2026-10-13T10:00:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '09331164041', type: 'Checking', name: 'Premier Checking Account', currency: 'USD', balance: 0.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [
      { id: 'crd-34400', cardNumber: '4532 9918 2041 3310', cardHolder: 'KRISTIN WILLIS', type: 'Visa Platinum Debit', expiry: '09/31', cvv: '884', pin: '8869', status: 'active', dailyAtmLimit: 10000, onlineLimit: 50000 }
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
      { accountNumber: '09372996993', type: 'Checking', name: 'Checking Primary Vault', currency: 'USD', balance: 100000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [
      { id: 'crd-659', cardNumber: '4532 7140 3114 3230', cardHolder: 'OLLE ROBERT CHRISTER RÅSTRÖM', type: 'Visa Platinum Debit', expiry: '09/31', cvv: '775', pin: '8869', status: 'active', dailyAtmLimit: 10000, onlineLimit: 50000 }
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
    id: 'usr-102',
    fullName: 'Elena Rostova',
    firstName: 'Elena',
    lastName: 'Rostova',
    username: 'erostova26',
    email: 'elena.rostova@vanguardlogistics.ch',
    password: 'Vanguard@2026!',
    role: 'Member',
    role: 'Member',
    phone: '+41 22 819 4012',
    avatar: 'ER',
    avatarColor: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    dob: '1987-11-22',
    nationality: 'Switzerland',
    address: 'Place du Molard 7, 1204 Geneva, Switzerland',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-09-12T14:20:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '9104-3381-19', type: 'Offshore', name: 'Swiss Sovereign Offshore Vault', currency: 'CHF', balance: 890000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '081294', active: true, notes: 'Cost of Transfer clearance token' },
      TAX: { code: 'TX-44810', active: true, notes: 'Swiss Canton Tax Certificate' },
      IMF: { code: '901248', active: true, notes: 'IMF Clearance signoff' }
    },
    activityLog: []
  },
  {
    id: 'usr-103',
    fullName: 'Marcus Sterling',
    firstName: 'Marcus',
    lastName: 'Sterling',
    username: 'msterling88',
    email: 'treasury@sterlingmerchant.com',
    password: 'Sterling#884!',
    role: 'Member',
    role: 'Member',
    phone: '+44 20 7946 0912',
    avatar: 'MS',
    avatarColor: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    dob: '1980-03-14',
    nationality: 'United Kingdom',
    address: '25 Bank Street, Canary Wharf, London E14 5JP, UK',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-08-25T11:00:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '8810-9234-71', type: 'Business', name: 'Institutional Corporate Vault', currency: 'GBP', balance: 2450000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '119402', active: true, notes: 'Cost of Transfer clearance token' },
      TAX: { code: 'TX-10492', active: true, notes: 'UK HMRC Clearance Certificate' },
      IMF: { code: '881042', active: true, notes: 'IMF Signoff' }
    },
    activityLog: []
  },
  {
    id: 'usr-104',
    fullName: 'Chen Wei',
    firstName: 'Chen',
    lastName: 'Wei',
    username: 'chenwei_sg',
    email: 'chen.wei@singaporebiotech.sg',
    password: 'MemberPass123!',
    role: 'Member',
    role: 'Member',
    phone: '+65 6789 0123',
    avatar: 'CW',
    avatarColor: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
    dob: '1985-08-09',
    nationality: 'Singapore',
    address: '10 Marina Boulevard, Marina Bay Financial Centre, Singapore 018983',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-09-01T08:15:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '7721-4091-88', type: 'Checking', name: 'Singapore Asian Currency Unit', currency: 'USD', balance: 1320000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '770192', active: true, notes: 'MAS SWIFT Clearance Token' },
      TAX: { code: 'TX-66910', active: true, notes: 'IRAS Tax Clearance' }
    },
    activityLog: []
  },
  {
    id: 'usr-105',
    fullName: 'Genevieve Dubois',
    firstName: 'Genevieve',
    lastName: 'Dubois',
    username: 'gdubois_fr',
    email: 'genevieve.dubois@chateau-dubois.fr',
    password: 'MemberPass123!',
    role: 'Member',
    role: 'Member',
    phone: '+33 1 42 68 55 00',
    avatar: 'GD',
    avatarColor: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
    dob: '1979-12-01',
    nationality: 'France',
    address: '14 Avenue Montaigne, 75008 Paris, France',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-07-19T16:30:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '5510-8829-14', type: 'Savings', name: 'Euro Private Estate Holdings', currency: 'EUR', balance: 780000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '882014', active: true, notes: 'Banque de France Clearance' }
    },
    activityLog: []
  },
  {
    id: 'usr-106',
    fullName: 'Carlos Mendez',
    firstName: 'Carlos',
    lastName: 'Mendez',
    username: 'cmendez_es',
    email: 'carlos.mendez@mendezholdings.es',
    password: 'MemberPass123!',
    role: 'Member',
    role: 'Member',
    phone: '+34 91 580 1200',
    avatar: 'CM',
    avatarColor: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    dob: '1981-04-25',
    nationality: 'Spain',
    address: 'Paseo de la Castellana 89, 28046 Madrid, Spain',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-08-10T10:45:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '6619-3012-90', type: 'Business', name: 'Iberian Commercial Treasury', currency: 'EUR', balance: 540000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '991048', active: true, notes: 'Target2 SWIFT Token' }
    },
    activityLog: []
  },
  {
    id: 'usr-107',
    fullName: 'Olivia Vanderbilt',
    firstName: 'Olivia',
    lastName: 'Vanderbilt',
    username: 'ovanderbilt_nl',
    email: 'olivia.vanderbilt@vanderbilt-estate.nl',
    password: 'MemberPass123!',
    role: 'Member',
    role: 'Member',
    phone: '+31 20 555 0192',
    avatar: 'OV',
    avatarColor: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    dob: '1989-09-18',
    nationality: 'Netherlands',
    address: 'Herengracht 450, 1017 CA Amsterdam, Netherlands',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-09-18T13:10:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '4410-8839-21', type: 'Savings', name: 'Dutch Trust Reserve', currency: 'EUR', balance: 1120000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '339102', active: true, notes: 'Dutch National Bank Token' }
    },
    activityLog: []
  },
  {
    id: 'usr-108',
    fullName: 'Sarah Jenkins',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    username: 'sjenkins_au',
    email: 'sarah.jenkins@sydneyventures.com.au',
    password: 'MemberPass123!',
    role: 'Member',
    role: 'Member',
    phone: '+61 2 9220 0000',
    avatar: 'SJ',
    avatarColor: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
    dob: '1986-02-11',
    nationality: 'Australia',
    address: '1 Martin Place, Sydney NSW 2000, Australia',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-08-04T09:00:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '3310-9920-45', type: 'Checking', name: 'Pacific Rim Liquidity Vault', currency: 'AUD', balance: 670000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '772910', active: true, notes: 'RBA Clearance Key' }
    },
    activityLog: []
  },
  {
    id: 'usr-109',
    fullName: 'Alexander Morgan',
    firstName: 'Alexander',
    lastName: 'Morgan',
    username: 'amorgan_cap',
    email: 'morgan.capital@us-treasury.com',
    password: 'MemberPass123!',
    role: 'Member',
    role: 'Member',
    phone: '+1 212 555 0199',
    avatar: 'AM',
    avatarColor: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
    dob: '1975-07-04',
    nationality: 'United States',
    address: '200 Park Avenue, Suite 300, New York, NY 10166',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-06-15T15:00:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '1109-8830-41', type: 'Checking', name: 'US Dollar Sovereign Premier', currency: 'USD', balance: 3450000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '992014', active: true, notes: 'Fedwire Clearing Key' }
    },
    activityLog: []
  },
  {
    id: 'usr-110',
    fullName: 'Jean-Pierre Laurent',
    firstName: 'Jean-Pierre',
    lastName: 'Laurent',
    username: 'jplaurent_ch',
    email: 'jp.laurent@genevaprivate.ch',
    password: 'MemberPass123!',
    role: 'Member',
    role: 'Member',
    phone: '+41 22 909 1100',
    avatar: 'JL',
    avatarColor: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    dob: '1972-10-30',
    nationality: 'Switzerland',
    address: 'Rue du Rhône 42, 1204 Geneva, Switzerland',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-05-10T12:00:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '9920-1149-80', type: 'Offshore', name: 'Swiss Alpine Private Vault', currency: 'CHF', balance: 5200000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '881029', active: true, notes: 'SNB Swiss SWIFT Token' }
    },
    activityLog: []
  },
  {
    id: 'usr-111',
    fullName: 'Sophia Al-Mansoor',
    firstName: 'Sophia',
    lastName: 'Al-Mansoor',
    username: 'salmansoor_uae',
    email: 'sophia@dubaitreasury.ae',
    password: 'MemberPass123!',
    role: 'Member',
    role: 'Member',
    phone: '+971 4 300 8888',
    avatar: 'SA',
    avatarColor: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)',
    dob: '1988-06-20',
    nationality: 'United Arab Emirates',
    address: 'Level 42, Al Khatem Tower, ADGM Square, Abu Dhabi, UAE',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-07-02T11:30:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '4481-9920-12', type: 'Business', name: 'Dubai International Financial Vault', currency: 'USD', balance: 4100000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '661092', active: true, notes: 'CBUAE Clearance Key' }
    },
    activityLog: []
  },
  {
    id: 'usr-112',
    fullName: 'Kenji Sato',
    firstName: 'Kenji',
    lastName: 'Sato',
    username: 'ksato_jp',
    email: 'kenji.sato@tokyosovereign.jp',
    password: 'MemberPass123!',
    role: 'Member',
    role: 'Member',
    phone: '+81 3 5555 0100',
    avatar: 'KS',
    avatarColor: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)',
    dob: '1983-01-15',
    nationality: 'Japan',
    address: '1-1 Marunouchi, Chiyoda-ku, Tokyo 100-0005, Japan',
    status: 'active',
    kycStatus: 'verified',
    createdAt: '2026-08-14T07:40:00Z',
    lastLogin: new Date().toISOString(),
    accounts: [
      { accountNumber: '8820-3391-04', type: 'Checking', name: 'Yen Sovereign Reserve Vault', currency: 'JPY', balance: 145000000.00, status: 'active', routingNumber: '021000089', isPrimary: true }
    ],
    transactions: [],
    cards: [],
    wireTransferCodes: {
      COT: { code: '448012', active: true, notes: 'BOJ Clearance Token' }
    },
    activityLog: []
  }
];

const DUMMY_TEST_EMAILS = [
  'elena.rostova@vanguardlogistics.ch',
  'treasury@sterlingmerchant.com',
  'chen.wei@singaporebiotech.sg',
  'genevieve.dubois@chateau-dubois.fr',
  'marcus.sterling@sterlingcorp.com',
  'carlos.mendez@mendezholdings.es',
  'olivia.vanderbilt@vanderbilt-estate.nl',
  'sarah.jenkins@sydneyventures.com.au'
];

/* ----------------------------------------------------------------------------
 * 2. DATABASE MANAGEMENT METHODS (PERSISTENCE)
 * ---------------------------------------------------------------------------- */
export function getAdminUsersList() {
  const memberName = getEffectiveMemberName();
  const memberEmail = getEffectiveMemberEmail();
  let list = [];

  // Gather users from primary store
  const stored = localStorage.getItem(ADMIN_USERS_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) list = parsed;
    } catch {}
  }

  // Gather users from secondary registered lists
  const secondaryKeys = [
    'wb_credit_union_registered_members_list',
    'wbcu_all_registered_users',
    'wbcu_user_registered_accounts'
  ];

  secondaryKeys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item && (item.email || item.id)) {
              const exists = list.some((u) => u.id === item.id || (u.email && item.email && u.email.toLowerCase() === item.email.toLowerCase()));
              if (!exists) list.push(item);
            }
          });
        }
      }
    } catch (e) {}
  });

  // Gather active user from session/localStorage
  try {
    const active = JSON.parse(localStorage.getItem('wb_credit_union_active_user') || '{}');
    if (active && active.email) {
      const exists = list.some((u) => u.id === active.id || (u.email && active.email && u.email.toLowerCase() === active.email.toLowerCase()));
      if (!exists) {
        list.unshift({
          id: active.id || 'usr-active-' + Date.now().toString(36),
          fullName: active.fullName || active.name || active.email.split('@')[0],
          email: active.email,
          phone: active.phone || '+41 44 915 8901',
          avatar: (active.fullName || active.email).slice(0, 2).toUpperCase(),
          avatarColor: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          dob: active.dob || '1988-05-12',
          address: active.address || 'Zurich, Switzerland',
          status: active.status || active.account_status || 'active',
          kycStatus: active.kycStatus || active.kyc_status || 'verified',
          createdAt: active.createdAt || new Date().toISOString(),
          password: active.password || '12345',
          accounts: active.accounts || [
            { accountNumber: active.accountNumber || '9482-1049-55', type: 'Checking', name: 'US Dollar Primary Vault', currency: 'USD', balance: active.balance || 0.00, status: 'active', routingNumber: '021000089' }
          ]
        });
      }
    }
  } catch (e) {}

  // Gather profile from wbcu_user_profile_v1
  try {
    const prof = JSON.parse(localStorage.getItem('wbcu_user_profile_v1') || '{}');
    if (prof && prof.email) {
      const exists = list.some((u) => u.email && u.email.toLowerCase() === prof.email.toLowerCase());
      if (!exists) {
        const fn = `${prof.firstName || ''} ${prof.lastName || ''}`.trim() || prof.email.split('@')[0];
        list.push({
          id: 'usr-prof-' + Date.now().toString(36),
          fullName: fn,
          firstName: prof.firstName || '',
          lastName: prof.lastName || '',
          email: prof.email,
          phone: prof.phone || '+41 44 915 0000',
          address: prof.addressLine1 || prof.address || 'Zurich, Switzerland',
          status: 'active',
          kycStatus: 'verified',
          createdAt: new Date().toISOString(),
          password: 'MemberPass123!',
          accounts: [
            { accountNumber: '9482-' + Math.floor(1000 + Math.random() * 9000), type: 'Checking', name: 'US Dollar Primary Vault', currency: 'USD', balance: 0.00, status: 'active', routingNumber: '021000089' }
          ]
        });
      }
    }
  } catch (e) {}

  // Preserve all valid member accounts

  // Ensure primary Super Admin user (usr-101) exists without renaming other users
  let primary = list.find((u) => u && u.id === 'usr-101');
  if (!primary) {
    primary = JSON.parse(JSON.stringify(initialSeedUsers[0]));
    primary.fullName = 'Miz Brymo';
    primary.email = 'mizbrymo@gmail.com';
    list.unshift(primary);
  } else {
    if (!primary.fullName) primary.fullName = 'Miz Brymo';
    primary.avatar = (primary.fullName || 'MB').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    primary.role = 'Super Admin';
    primary.is_admin = true;
    if (!primary.password) primary.password = '12345';
  }

  // Ensure all initialSeedUsers are present without ever overwriting custom member records
  initialSeedUsers.forEach((seedUser) => {
    const foundIdx = list.findIndex((u) => u && u.id === seedUser.id);
    if (foundIdx === -1) {
      list.push(JSON.parse(JSON.stringify(seedUser)));
    }
  });

  // Ensure all users have required fields and passwords
  const defaultPwds = ['MemberPass123!', 'Password123!', 'Vanguard@2026!', 'Sterling#884!'];
  list.forEach((u, i) => {
    if (!u.id) {
      u.id = 'usr-' + Math.random().toString(36).substr(2, 9);
    }
    if (!u.password) {
      u.password = defaultPwds[i % defaultPwds.length] || 'MemberPass123!';
    }
    if (!u.profilePhoto && u.avatarUrl) u.profilePhoto = u.avatarUrl;
    if (!u.avatarUrl && u.profilePhoto) u.avatarUrl = u.profilePhoto;
    ensureUserHasUniqueCodesAndAccounts(u);
  });

  // Save updated list back to localStorage
  try {
    localStorage.setItem(ADMIN_USERS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}

  return list;
}

export function generateRandomAccountNumber() {
  const prefix = '09';
  const rand = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `${prefix}${rand}`;
}

export function generateRandomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function generateRandomCotCode() {
  return '0' + String(Math.floor(100000 + Math.random() * 900000));
}

export function generateRandomImfCode() {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

export function generateRandomTaxCode() {
  return `TX-${Math.floor(10000 + Math.random() * 90000)}`;
}

export function generateRandomAmlCode() {
  return `AML-${Math.floor(10000 + Math.random() * 90000)}`;
}

export function generateRandomPapCode() {
  return `PAP-${Math.floor(10000 + Math.random() * 90000)}`;
}

export function generateRandomOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateFullUserTransferCodes() {
  return {
    COT: { code: generateRandomCotCode(), active: true, notes: 'Automated Cost of Transfer clearance token' },
    TAX: { code: generateRandomTaxCode(), active: true, notes: 'Automated Federal Tax clearance token' },
    IMF: { code: generateRandomImfCode(), active: true, notes: 'Automated IMF regulatory signoff token' },
    AML: { code: generateRandomAmlCode(), active: true, notes: 'Automated Anti-Money Laundering verification key' },
    PAP: { code: generateRandomPapCode(), active: true, notes: 'Automated Proof of Anti-Piracy clearance token' },
    OTP: { code: generateRandomOtpCode(), active: true, notes: 'Automated One-Time Passcode clearance' }
  };
}

export function ensureUserHasUniqueCodesAndAccounts(user, persist = false) {
  if (!user) return user;
  let modified = false;

  if (!user.transactionPin && !user.pin) {
    user.transactionPin = generateRandomPin();
    modified = true;
  }

  if (!user.accounts || !Array.isArray(user.accounts) || user.accounts.length === 0) {
    user.accounts = [
      {
        accountNumber: generateRandomAccountNumber(),
        type: 'Checking',
        name: 'US Dollar Primary Vault',
        currency: 'USD',
        balance: 0,
        available: 0,
        status: user.status || 'active',
        routingNumber: '021000089',
        isPrimary: true
      }
    ];
    modified = true;
  }

  if (!user.wireTransferCodes || typeof user.wireTransferCodes !== 'object') {
    user.wireTransferCodes = generateFullUserTransferCodes();
    modified = true;
  } else {
    ['COT', 'TAX', 'IMF', 'AML', 'PAP', 'OTP'].forEach((k) => {
      if (typeof user.wireTransferCodes[k] === 'string' && user.wireTransferCodes[k]) {
        user.wireTransferCodes[k] = { code: user.wireTransferCodes[k], active: true, notes: `${k} clearance token` };
      }
    });
    if (!user.wireTransferCodes.COT?.code) {
      user.wireTransferCodes.COT = { code: generateRandomCotCode(), active: true, notes: 'Cost of Transfer clearance token' };
      modified = true;
    }
    if (!user.wireTransferCodes.TAX?.code) {
      user.wireTransferCodes.TAX = { code: generateRandomTaxCode(), active: true, notes: 'Federal Tax clearance token' };
      modified = true;
    }
    if (!user.wireTransferCodes.IMF?.code) {
      user.wireTransferCodes.IMF = { code: generateRandomImfCode(), active: true, notes: 'IMF regulatory signoff token' };
      modified = true;
    }
    if (!user.wireTransferCodes.AML?.code) {
      user.wireTransferCodes.AML = { code: generateRandomAmlCode(), active: true, notes: 'Anti-Money Laundering verification key' };
      modified = true;
    }
    if (!user.wireTransferCodes.PAP?.code) {
      user.wireTransferCodes.PAP = { code: generateRandomPapCode(), active: true, notes: 'Proof of Anti-Piracy clearance token' };
      modified = true;
    }
    if (!user.wireTransferCodes.OTP?.code) {
      user.wireTransferCodes.OTP = { code: generateRandomOtpCode(), active: true, notes: 'One-Time Passcode clearance' };
      modified = true;
    }
  }

  return user;
}

export async function saveAdminUsersList(users) {
  if (!users || !Array.isArray(users)) return;
  
  // 1. Local Storage Persistence (Primary)
  try {
    localStorage.setItem(ADMIN_USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('[ADMIN STORAGE] Local quota exceeded.', e);
  }

  // 2. Server Persistence (Secondary / Backup)
  // If the list is large, we use chunking to avoid timeouts on cPanel
  const CHUNK_SIZE = 50;
  if (users.length > CHUNK_SIZE) {
    console.log('[ADMIN SYNC] Large dataset detected, using chunked background sync...');
    // We only sync in the background without blocking the UI
    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      const chunk = users.slice(i, i + CHUNK_SIZE);
      fetch('/api/admin-users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: chunk, is_chunk: true }),
      }).catch(err => console.error(`[ADMIN SYNC] Chunk ${i} failed:`, err));
      
      // Small delay between chunks to be nice to the server
      if (i + CHUNK_SIZE < users.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  } else {
    // Small list, send all at once
    try {
      fetch('/api/admin-users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users }),
      }).catch((err) => {
        console.error('[ADMIN SYNC] Failed to POST users to server:', err);
      });
    } catch (e) {
      console.error('[ADMIN SYNC] POST fetch error:', e);
    }
  }
}

export function getUserById(userId) {
  if (!userId) return null;
  const matchId = String(userId).trim();
  let user = (typeof currentUsers !== 'undefined' && Array.isArray(currentUsers))
    ? currentUsers.find((u) => u && (u.id === matchId || String(u.id) === matchId || (u.email && u.email.toLowerCase() === matchId.toLowerCase())))
    : null;

  if (!user) {
    const users = getAdminUsersList();
    user = (users || []).find((u) => u && (u.id === matchId || String(u.id) === matchId || (u.email && u.email.toLowerCase() === matchId.toLowerCase()))) || null;
  }
  return user ? ensureUserHasUniqueCodesAndAccounts(user) : null;
}

/**
 * Formats a complete user dossier containing all credentials, accounts, and transaction clearance codes for clipboard copying
 */
export function formatUserDossier(user) {
  if (!user) return '';
  user = ensureUserHasUniqueCodesAndAccounts(user);
  const primaryAcct = (user.accounts && user.accounts[0]) ? user.accounts[0] : { accountNumber: generateRandomAccountNumber(), type: 'Checking', balance: 0 };
  const totalBal = (user.accounts || []).reduce((sum, a) => sum + (a.balance || 0), 0);
  const cot = user.wireTransferCodes?.COT?.code || generateRandomCotCode();
  const tax = user.wireTransferCodes?.TAX?.code || generateRandomTaxCode();
  const imf = user.wireTransferCodes?.IMF?.code || generateRandomImfCode();
  const aml = user.wireTransferCodes?.AML?.code || generateRandomAmlCode();
  const pap = user.wireTransferCodes?.PAP?.code || generateRandomPapCode();
  const otp = user.wireTransferCodes?.OTP?.code || generateRandomOtpCode();
  const txPin = user.transactionPin || user.pin || generateRandomPin();
  const primaryCard = (user.cards && user.cards[0]) ? user.cards[0] : null;

  return `========================================
🏛️ WB CREDIT UNION — MEMBER DOSSIER
========================================
FULL NAME: ${user.fullName || 'N/A'}
MEMBER ID: ${user.id || 'N/A'}
USERNAME: ${user.username || user.email?.split('@')[0] || 'N/A'}
EMAIL: ${user.email || 'N/A'}
PHONE: ${user.phone || 'N/A'}
DATE OF BIRTH: ${user.dob || 'N/A'}
NATIONALITY: ${user.nationality || 'Switzerland'}
ADDRESS: ${user.address || 'N/A'}
ACCOUNT CLEARANCE STATUS: ${(user.status || 'active').toUpperCase()}
KYC TIER: ${(user.kycStatus || 'verified').toUpperCase()}

🔑 MASTER ACCESS CREDENTIALS:
- LOGIN PASSWORD: ${user.password || 'MemberPass123!'}
- 4-DIGIT SECURITY PIN: ${txPin}

💰 PRIMARY VAULT & ACCOUNTS:
- PRIMARY ACCOUNT NUMBER: ${primaryAcct.accountNumber}
- VAULT TYPE: ${primaryAcct.type || 'Premier Checking'}
- TOTAL VAULT BALANCE: $${totalBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

🔐 WIRE CLEARANCE & TRANSACTION CODES:
- COT CODE (Cost of Transfer): ${cot}
- TAX CODE (Tax Clearance): ${tax}
- IMF CODE (IMF Clearance): ${imf}
- AML CODE (Anti-Money Laundering): ${aml}
- PAP CODE (Proof of Anti-Piracy): ${pap}
- 2FA / OTP CODE: ${otp}

💳 ATM / DEBIT CARD:
${primaryCard ? `- CARD NUMBER: ${primaryCard.cardNumber || primaryCard.card_number || 'N/A'}
- EXPIRY: ${primaryCard.expiry || '09/29'}
- CVV: ${primaryCard.cvv || '842'}
- CARD PIN: ${primaryCard.pin || txPin}
- STATUS: ${(primaryCard.status || 'active').toUpperCase()}` : '- NO PHYSICAL CARD REGISTERED'}
========================================`;
}

export function updateUser(updatedUser) {
  if (!updatedUser || !updatedUser.id) return;
  
  // Update local memory store first
  if (typeof currentUsers !== 'undefined' && Array.isArray(currentUsers)) {
    const memIdx = currentUsers.findIndex((u) => u.id === updatedUser.id);
    if (memIdx !== -1) {
      currentUsers[memIdx] = { ...currentUsers[memIdx], ...updatedUser };
    } else {
      currentUsers.unshift(updatedUser);
    }
    filteredUsers = [...currentUsers];
  }

  const users = getAdminUsersList();
  const idx = users.findIndex((u) => u.id === updatedUser.id);
  if (idx !== -1) {
    const isAct = updatedUser.status === 'active';
    const isKycVer = (updatedUser.kycStatus || updatedUser.kyc_status || '').toLowerCase() === 'verified';

    if (isAct) {
      updatedUser.status = 'active';
      updatedUser.account_status = 'active';
      updatedUser.accountStatus = 'active';
      if (!updatedUser.statusReason || updatedUser.statusReason.toLowerCase().includes('pending') || updatedUser.statusReason.toLowerCase().includes('dormant') || updatedUser.statusReason.toLowerCase().includes('approval') || updatedUser.statusReason.toLowerCase().includes('activation')) {
        updatedUser.statusReason = isKycVer ? 'Account Active & Verified' : 'Account Active';
      }
      if (Array.isArray(updatedUser.accounts)) {
        updatedUser.accounts.forEach((a) => { a.status = 'active'; });
      }
      if (Array.isArray(updatedUser.cards)) {
        updatedUser.cards.forEach((c) => {
          if (c.status === 'pending_approval' || c.status === 'inactive') {
            c.status = 'active';
            c.is_frozen = false;
          }
        });
      }
    } else if (updatedUser.status === 'inactive') {
      updatedUser.account_status = 'inactive';
      updatedUser.accountStatus = 'dormant';
    }

    if (isKycVer) {
      updatedUser.kycStatus = 'verified';
      updatedUser.kyc_status = 'verified';
    }

    // Automatically synchronize cardholder name on all cards in updatedUser.cards
    const effectiveMemberName = getEffectiveMemberName(updatedUser).toUpperCase();
    if (Array.isArray(updatedUser.cards)) {
      updatedUser.cards.forEach((c) => {
        c.cardHolder = effectiveMemberName;
        c.cardholder_name = effectiveMemberName;
        c.userEmail = updatedUser.email || c.userEmail;
        c.userId = updatedUser.id;
      });
    }

    users[idx] = updatedUser;
    saveAdminUsersList(users);

    // Keep memory lists synchronized immediately
    try {
      if (Array.isArray(currentUsers)) {
        const cIdx = currentUsers.findIndex((u) => u.id === updatedUser.id);
        if (cIdx !== -1) {
          currentUsers[cIdx] = updatedUser;
        }
      }
      if (Array.isArray(filteredUsers)) {
        const fIdx = filteredUsers.findIndex((u) => u.id === updatedUser.id);
        if (fIdx !== -1) {
          filteredUsers[fIdx] = updatedUser;
        }
      }
    } catch (e) {}

    // Sync to active user session & user profile cache if this user matches active session or storage
    try {
      const cur = getDemoStorageUser();
      const isMatch = cur && (cur.id === updatedUser.id || (cur.email && updatedUser.email && cur.email.toLowerCase() === updatedUser.email.toLowerCase()));
      
      if (isMatch) {
        const activeTarget = cur || {};
        Object.assign(activeTarget, updatedUser);
        activeTarget.status = updatedUser.status;
        activeTarget.account_status = updatedUser.account_status || updatedUser.status;
        activeTarget.accountStatus = updatedUser.accountStatus || updatedUser.status;
        activeTarget.kycStatus = updatedUser.kycStatus;
        activeTarget.kyc_status = updatedUser.kyc_status;
        activeTarget.statusReason = updatedUser.statusReason;
        activeTarget.profilePhoto = updatedUser.profilePhoto || updatedUser.avatarUrl || '';
        activeTarget.avatarUrl = updatedUser.profilePhoto || updatedUser.avatarUrl || '';
        activeTarget.wireTransferCodes = updatedUser.wireTransferCodes || activeTarget.wireTransferCodes;
        setDemoStorageUser(activeTarget);

        // Update wbcu_user_profile_v1 cache for User Settings & Dashboard Header
        try {
          const rawProf = localStorage.getItem('wbcu_user_profile_v1');
          const prof = rawProf ? JSON.parse(rawProf) : {};
          prof.avatarUrl = updatedUser.profilePhoto || updatedUser.avatarUrl || '';
          prof.profilePhoto = updatedUser.profilePhoto || updatedUser.avatarUrl || '';
          if (updatedUser.firstName) prof.firstName = updatedUser.firstName;
          if (updatedUser.lastName) prof.lastName = updatedUser.lastName;
          if (updatedUser.email) prof.email = updatedUser.email;
          if (updatedUser.phone) prof.phone = updatedUser.phone;
          if (updatedUser.address) prof.address = updatedUser.address;
          localStorage.setItem('wbcu_user_profile_v1', JSON.stringify(prof));
        } catch (e) {}

        if (Array.isArray(updatedUser.accounts) && updatedUser.accounts.length > 0) {
          localStorage.setItem('wb_credit_union_user_accounts', JSON.stringify(updatedUser.accounts));
        }
        if (Array.isArray(updatedUser.wallets) && updatedUser.wallets.length > 0) {
          localStorage.setItem('wb_credit_union_user_wallets', JSON.stringify(updatedUser.wallets));
        }
        if (Array.isArray(updatedUser.transactions)) {
          localStorage.setItem('wb_credit_union_user_transactions', JSON.stringify(updatedUser.transactions));
        }
        if (Array.isArray(updatedUser.cryptoWallets)) {
          localStorage.setItem('wb_credit_union_user_crypto_wallets', JSON.stringify(updatedUser.cryptoWallets));
        }
      }

      // Also check if updated user is stored in active session storage keys
      ['wb_credit_union_active_user', 'wb_credit_union_user_session'].forEach((k) => {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.id === updatedUser.id || (parsed.email && updatedUser.email && parsed.email.toLowerCase() === updatedUser.email.toLowerCase()))) {
              parsed.status = updatedUser.status;
              parsed.account_status = updatedUser.account_status;
              parsed.accountStatus = updatedUser.accountStatus;
              parsed.kycStatus = updatedUser.kycStatus;
              parsed.kyc_status = updatedUser.kyc_status;
              parsed.statusReason = updatedUser.statusReason;
              if (Array.isArray(updatedUser.accounts)) parsed.accounts = updatedUser.accounts;
              localStorage.setItem(k, JSON.stringify(parsed));
            }
          }
        } catch (err) {}
      });

      // Always synchronize cardholder name & user details to all cards belonging to this user
      const isCardBelongsToUser = (c) => {
        if (!c) return false;
        if (c.userId && String(c.userId) === String(updatedUser.id)) return true;
        if (c.userEmail && updatedUser.email && c.userEmail.toLowerCase() === updatedUser.email.toLowerCase()) return true;
        if (Array.isArray(updatedUser.accounts) && updatedUser.accounts.some((a) => a.accountNumber === c.accountNumber)) return true;
        if (Array.isArray(updatedUser.cards) && updatedUser.cards.some((uc) => uc.id === c.id)) return true;
        if (c.cardHolder && updatedUser.lastName && c.cardHolder.toLowerCase().includes(updatedUser.lastName.toLowerCase())) return true;
        if (c.cardHolder && c.cardHolder.toLowerCase().includes('bergkvist') && updatedUser.email?.toLowerCase().includes('slipsen')) return true;
        return false;
      };

      try {
        const rawCards = localStorage.getItem('wb_credit_union_atm_cards');
        if (rawCards) {
          const uCards = JSON.parse(rawCards);
          if (Array.isArray(uCards)) {
            let modified = false;
            uCards.forEach((c) => {
              if (isCardBelongsToUser(c)) {
                c.cardHolder = effectiveMemberName;
                c.cardholder_name = effectiveMemberName;
                c.userEmail = updatedUser.email || c.userEmail;
                c.userId = updatedUser.id;
                if (updatedUser.status === 'active' && (c.status === 'pending_approval' || c.status === 'inactive')) {
                  c.status = 'active';
                  c.is_frozen = false;
                }
                modified = true;
              }
            });
            if (modified) {
              localStorage.setItem('wb_credit_union_atm_cards', JSON.stringify(uCards));
            }
          }
        }
      } catch (e) {}

      try {
        const rawAdminCards = localStorage.getItem('wb_credit_union_admin_cards_db');
        if (rawAdminCards) {
          const aCards = JSON.parse(rawAdminCards);
          if (Array.isArray(aCards)) {
            let modified = false;
            aCards.forEach((c) => {
              if (isCardBelongsToUser(c)) {
                c.cardHolder = effectiveMemberName;
                c.cardholder_name = effectiveMemberName;
                c.userEmail = updatedUser.email || c.userEmail;
                c.userId = updatedUser.id;
                if (updatedUser.status === 'active' && (c.status === 'pending_approval' || c.status === 'inactive')) {
                  c.status = 'active';
                  c.is_frozen = false;
                }
                modified = true;
              }
            });
            if (modified) {
              localStorage.setItem('wb_credit_union_admin_cards_db', JSON.stringify(aCards));
            }
          }
        }
      } catch (e) {}

      // Trigger card sync and table re-render
      try {
        if (typeof window !== 'undefined') {
          if (typeof window.syncAllCardsWithUsersDatabase === 'function') {
            window.syncAllCardsWithUsersDatabase();
          }
          if (typeof window.renderCardsTable === 'function') {
            window.renderCardsTable();
          }
          window.dispatchEvent(new CustomEvent('wbcu_user_updated', { detail: updatedUser }));
          window.dispatchEvent(new CustomEvent('wbcu_cards_updated'));
        }
      } catch (e) {}
    } catch (e) {
      console.warn('Active session sync error:', e);
    }

    return true;
  }
  return false;
}

/* ----------------------------------------------------------------------------
 * 3. STATE & CONTROLLER VARIABLES
 * ---------------------------------------------------------------------------- */
let currentUsers = [];
let filteredUsers = [];
let currentPage = 1;
const itemsPerPage = 25;
let currentSortCol = 'createdAt';
let currentSortDir = 'desc';
let selectedUserIds = new Set();
let activeDetailUser = null;

/**
 * Asynchronously synchronizes admin users with the persistent backend store / database
 */
export async function syncAdminUsersWithServer() {
  try {
    // Explicitly target the PHP endpoint for cPanel compatibility
    const res = await fetch('/api/admin-users.php');
    if (!res.ok) return;
    const data = await res.json();
    
    // Check for data discrepancy between local and server
    const localCount = currentUsers.length;
    const serverCount = data.count || 0;
    
    const alertEl = document.getElementById('adminSyncRequiredAlert');
    const localCountText = document.getElementById('localUserCountText');
    const dbCountText = document.getElementById('dbUserCountText');
    
    if (alertEl && localCount > serverCount + 10) { // Threshold of 10 users difference
      alertEl.classList.remove('d-none');
      if (localCountText) localCountText.textContent = localCount.toLocaleString();
      if (dbCountText) dbCountText.textContent = serverCount.toLocaleString();
    } else if (alertEl) {
      alertEl.classList.add('d-none');
    }

    if (Array.isArray(data.users) && data.users.length > 0) {
      let updated = false;
      data.users.forEach((serverUser) => {
        if (!serverUser || !serverUser.id) return;
        const existsIdx = currentUsers.findIndex(
          (u) => u && u.id === serverUser.id
        );
        if (existsIdx === -1) {
          currentUsers.push(serverUser);
          updated = true;
        } else {
          // Trust server data for core identity and state; merge into existing record
          const localUser = currentUsers[existsIdx];
          // Check if server data is actually different to avoid unnecessary re-renders
          if (JSON.stringify(localUser) !== JSON.stringify({ ...localUser, ...serverUser })) {
            currentUsers[existsIdx] = { ...localUser, ...serverUser };
            updated = true;
          }
        }
      });

      if (updated) {
        saveAdminUsersList(currentUsers);
        filteredUsers = [...currentUsers];
        renderUsersTable();
        const badge = document.getElementById('sidebarUserBadge');
        if (badge) badge.textContent = currentUsers.length.toLocaleString();
        const countBadge = document.getElementById('userTotalCountBadge');
        if (countBadge) countBadge.textContent = `${currentUsers.length.toLocaleString()} Users`;
      }
      
      // Notify about connection status for transparency
      if (data.db_connected === false) {
        console.error('[ADMIN DB] Database connection failed:', data.db_errors);
        showToast('System is running on local file storage. Database is currently offline.', 'warning', 'Database Offline');
      } else if (data.source === 'mysql_merged') {
        console.log('[ADMIN DB] Connected to Live Database');
      }
    }
  } catch (err) {
    console.warn('[ADMIN USER SYNC INFO]', err);
  }
}

/* ----------------------------------------------------------------------------
 * 4. INITIALIZE USER MANAGEMENT SECTION
 * ---------------------------------------------------------------------------- */
export function initAdminUserManagement() {
  console.log('[ADMIN USERS] Initializing User Management...');
  try {
    const list = getAdminUsersList();
    currentUsers = Array.isArray(list) ? list : [];
    console.log('[ADMIN USERS] Loaded local users:', currentUsers.length);
  } catch (e) {
    console.error('[ADMIN USERS] Failed to load local users:', e);
    currentUsers = [];
  }
  filteredUsers = [...currentUsers];

  try { setupSearchAndFilters(); } catch (e) { console.error('[ADMIN USERS] Search/Filter setup error:', e); }
  try { setupTableSorting(); } catch (e) { console.error('[ADMIN USERS] Table sorting setup error:', e); }
  try { setupBulkActions(); } catch (e) { console.error('[ADMIN USERS] Bulk actions setup error:', e); }
  try { setupUserDetailDrawer(); } catch (e) { console.error('[ADMIN USERS] Drawer setup error:', e); }
  try { setupCreateUserModal(); } catch (e) { console.error('[ADMIN USERS] Modal setup error:', e); }
  try { setupExportButtons(); } catch (e) { console.error('[ADMIN USERS] Export buttons setup error:', e); }
  try { setupSystemSyncButtons(); } catch (e) { console.error('[ADMIN USERS] Sync buttons setup error:', e); }

  renderUsersTable();

  // Retry logic for robustness
  setTimeout(() => {
    const tbody = document.getElementById('adminUsersTableBody');
    if (tbody && (!tbody.children.length || tbody.innerHTML.includes('No matching members'))) {
      renderUsersTable();
    }
  }, 1000);

  // Synchronize users from server database / admin-users.json
  syncAdminUsersWithServer();
}

/* ----------------------------------------------------------------------------
 * 5. SEARCH, FILTERING & SORTING
 * ---------------------------------------------------------------------------- */
function setupSearchAndFilters() {
  const searchInput = document.getElementById('userSearchInput');
  const statusFilter = document.getElementById('userStatusFilter');
  const kycFilter = document.getElementById('userKycFilter');
  const typeFilter = document.getElementById('userAccountTypeFilter');
  const dateFilter = document.getElementById('userDateRangeFilter');
  const clearFiltersBtn = document.getElementById('btnClearUserFilters');

  let debounceTimer = null;

  function applyFilters() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    const status = statusFilter?.value || 'all';
    const kyc = kycFilter?.value || 'all';
    const acctType = typeFilter?.value || 'all';
    const dateRange = dateFilter?.value || 'all';

    filteredUsers = currentUsers.filter((u) => {
      // Query filter (Name, Email, Phone, Account Number, Username)
      const matchesQuery = !query ||
        ((u.fullName || '').toLowerCase().includes(query)) ||
        ((u.email || '').toLowerCase().includes(query)) ||
        ((u.username || '').toLowerCase().includes(query)) ||
        ((u.phone || '').toLowerCase().includes(query)) ||
        (Array.isArray(u.accounts) && u.accounts.some((a) => (a.accountNumber || '').toLowerCase().includes(query)));

      // Status
      const matchesStatus = status === 'all' || u.status === status;

      // KYC
      const matchesKyc = kyc === 'all' || (u.kycStatus || u.kyc_status || '').toLowerCase() === kyc.toLowerCase();

      // Account type
      const matchesType = acctType === 'all' || (Array.isArray(u.accounts) && u.accounts.some((a) => (a.type || '').toLowerCase() === acctType.toLowerCase()));

      // Date range
      let matchesDate = true;
      if (dateRange !== 'all') {
        const createdTime = new Date(u.createdAt).getTime();
        const now = Date.now();
        if (dateRange === '7d') matchesDate = now - createdTime <= 7 * 86400000;
        else if (dateRange === '30d') matchesDate = now - createdTime <= 30 * 86400000;
        else if (dateRange === '90d') matchesDate = now - createdTime <= 90 * 86400000;
      }

      return matchesQuery && matchesStatus && matchesKyc && matchesType && matchesDate;
    });

    sortUsers();
    currentPage = 1;
    renderUsersTable();
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilters, 250);
    });
  }

  [statusFilter, kycFilter, typeFilter, dateFilter].forEach((select) => {
    if (select) select.addEventListener('change', applyFilters);
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (statusFilter) statusFilter.value = 'all';
      if (kycFilter) kycFilter.value = 'all';
      if (typeFilter) typeFilter.value = 'all';
      if (dateFilter) dateFilter.value = 'all';
      applyFilters();
    });
  }
}

function setupTableSorting() {
  const headers = document.querySelectorAll('.admin-sortable-th');
  headers.forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort-col');
      if (!col) return;

      if (currentSortCol === col) {
        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortCol = col;
        currentSortDir = 'asc';
      }

      // Update sort icons
      headers.forEach((h) => {
        const icon = h.querySelector('.admin-sort-icon');
        if (icon) icon.textContent = '⇅';
      });
      const curIcon = th.querySelector('.admin-sort-icon');
      if (curIcon) curIcon.textContent = currentSortDir === 'asc' ? '↑' : '↓';

      sortUsers();
      renderUsersTable();
    });
  });
}

function sortUsers() {
  filteredUsers.sort((a, b) => {
    let valA = a[currentSortCol];
    let valB = b[currentSortCol];

    if (currentSortCol === 'balance') {
      valA = a.accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
      valB = b.accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    } else if (currentSortCol === 'accountNumber') {
      valA = a.accounts[0]?.accountNumber || '';
      valB = b.accounts[0]?.accountNumber || '';
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB || '').toLowerCase();
    }

    if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

/* ----------------------------------------------------------------------------
 * 6. RENDER USERS TABLE & PAGINATION
 * ---------------------------------------------------------------------------- */
export function renderUsersTable() {
  const tbody = document.getElementById('adminUsersTableBody');
  const countBadge = document.getElementById('userTotalCountBadge');
  const paginationInfo = document.getElementById('userPaginationInfo');
  const paginationControls = document.getElementById('userPaginationControls');
  const selectAllCheckbox = document.getElementById('selectAllUsersCheckbox');

  if (countBadge) countBadge.textContent = `${filteredUsers.length} Users`;

  if (!tbody) return;

  const totalUsers = filteredUsers.length;
  const totalPages = Math.ceil(totalUsers / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalUsers);
  const pagedUsers = filteredUsers.slice(startIndex, endIndex);

  console.log('[ADMIN RENDER] Rendering table. Page:', currentPage, 'Total:', totalUsers, 'Paged count:', pagedUsers.length);

  if (totalUsers === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center p-5 text-muted">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          <div class="font-bold text-white mb-1">No matching members found</div>
          <div class="text-xs">Try adjusting your keyword search query or filter parameters.</div>
        </td>
      </tr>
    `;
    if (paginationInfo) paginationInfo.textContent = 'Showing 0 of 0 members';
    if (paginationControls) paginationControls.innerHTML = '';
    return;
  }

  tbody.innerHTML = pagedUsers.map((u) => {
    if (!u) return '';
    if (!u.id) {
       console.warn('[ADMIN RENDER] User object missing ID:', u);
       return '';
    }
    const totalBalance = Array.isArray(u.accounts) ? u.accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0) : 0;
    const primaryAcct = (Array.isArray(u.accounts) && u.accounts[0]) ? u.accounts[0] : { accountNumber: 'N/A', type: 'Checking', currency: 'USD' };
    const isChecked = selectedUserIds.has(u.id);
    const userStatus = u.status || 'active';
    const isKycVer = (u.kycStatus || u.kyc_status || '').toLowerCase() === 'verified';
    const isKycPend = (u.kycStatus || u.kyc_status || '').toLowerCase() === 'pending';
    const fn = (u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Member').trim();
    const initials = (u.avatar || fn.slice(0, 2)).toUpperCase();
    const userEmail = u.email || 'N/A';
    const userPhone = u.phone || u.phoneNumber || 'N/A';

    return `
      <tr class="admin-user-row" data-user-id="${u.id}" onclick="if(window.openUserDetailDrawer){window.openUserDetailDrawer('${u.id}');}">
        <td onclick="event.stopPropagation()">
          <input type="checkbox" class="user-select-checkbox" data-user-id="${u.id}" ${isChecked ? 'checked' : ''} />
        </td>
        <td>
          <div class="d-flex items-center gap-2">
            <div class="admin-user-avatar" style="background:${u.avatarColor || '#3b82f6'}; overflow: hidden; display: flex; align-items: center; justify-content: center;">
              ${(u.profilePhoto || u.avatarUrl) ? `<img src="${escapeHtml(u.profilePhoto || u.avatarUrl)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='${escapeHtml(initials)}';" />` : escapeHtml(initials)}
            </div>
            <div>
              <div class="font-bold text-white">${escapeHtml(fn)}</div>
              <div class="text-xs text-muted font-mono">${u.id || ''}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="text-white text-xs font-mono">${escapeHtml(userEmail)}</div>
          <div class="text-xs text-muted">${escapeHtml(userPhone)}</div>
        </td>
        <td>
          <span class="font-mono text-xs font-semibold text-white">${primaryAcct.accountNumber}</span>
        </td>
        <td>
          <span class="text-xs text-muted">${primaryAcct.type}</span>
        </td>
        <td>
          <span class="action-chip badge-status-${userStatus}">${userStatus.toUpperCase()}</span>
        </td>
        <td>
          <span class="action-chip ${isKycVer ? 'action-chip-approve' : (isKycPend ? 'action-chip-pending' : 'action-chip-flag')}">
            ${isKycVer ? '✓ VERIFIED' : (u.kycStatus || u.kyc_status || 'UNVERIFIED').toUpperCase()}
          </span>
        </td>
        <td>
          <span class="font-mono text-white font-bold text-sm">
            $${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </td>
        <td>
          <span class="text-xs text-muted">${new Date(u.createdAt).toLocaleDateString()}</span>
        </td>
        <td class="text-right" onclick="event.stopPropagation()">
          <div class="d-flex items-center justify-end gap-1 flex-nowrap">
            ${(u.status === 'inactive' || u.status === 'dormant' || u.status === 'pending') ? `
              <button type="button" class="admin-btn admin-btn-emerald admin-btn-sm btn-approve-user" data-user-id="${u.id}" title="Approve and Activate Account" onclick="event.stopPropagation(); if(window.approveUserAccount){window.approveUserAccount('${u.id}');}">
                ✓ Approve
              </button>
            ` : ''}
            <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-copy-user-details" data-user-id="${u.id}" title="Copy full member profile & transaction codes to clipboard" onclick="event.stopPropagation(); if(window.copyUserDossierToClipboard){window.copyUserDossierToClipboard('${u.id}', this);}" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.45); white-space: nowrap; font-weight: 600;">
              📋 Copy Info
            </button>
            <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-view-user" data-user-id="${u.id}" onclick="event.stopPropagation(); if(window.openUserDetailDrawer){window.openUserDetailDrawer('${u.id}');}">
              Manage &rarr;
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Row click listeners -> Open Detail Drawer
  tbody.querySelectorAll('.admin-user-row').forEach((row) => {
    row.addEventListener('click', () => {
      const uId = row.getAttribute('data-user-id');
      if (uId) openUserDetailDrawer(uId);
    });
  });

  tbody.querySelectorAll('.btn-view-user').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uId = btn.getAttribute('data-user-id');
      if (uId) openUserDetailDrawer(uId);
    });
  });

  // Copy Full User Details & Transaction Codes Handler
  tbody.querySelectorAll('.btn-copy-user-details').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uId = btn.getAttribute('data-user-id');
      if (uId) copyUserDossierToClipboard(uId, btn);
    });
  });

  // 1-Click Approve User Button
  tbody.querySelectorAll('.btn-approve-user').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uId = btn.getAttribute('data-user-id');
      if (uId) approveUserAccount(uId);
    });
  });

  // Checkbox bindings
  tbody.querySelectorAll('.user-select-checkbox').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const uId = cb.getAttribute('data-user-id');
      if (e.target.checked) selectedUserIds.add(uId);
      else selectedUserIds.delete(uId);
      updateBulkToolbar();
    });
  });

  // Pagination Info & Buttons
  if (paginationInfo) {
    paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalUsers} members`;
  }

  if (paginationControls) {
    let btnsHtml = `
      <button class="admin-page-btn" id="prevPageBtn" ${currentPage === 1 ? 'disabled' : ''}>&larr; Prev</button>
    `;
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 || p === totalPages - 1) btnsHtml += `<span class="text-muted text-xs px-1">...</span>`;
        continue;
      }
      btnsHtml += `
        <button class="admin-page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>
      `;
    }
    btnsHtml += `
      <button class="admin-page-btn" id="nextPageBtn" ${currentPage === totalPages ? 'disabled' : ''}>Next &rarr;</button>
    `;

    paginationControls.innerHTML = btnsHtml;

    paginationControls.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.getAttribute('data-page'), 10);
        renderUsersTable();
      });
    });

    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderUsersTable(); } };

    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderUsersTable(); } };
  }

  // Update master checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = pagedUsers.length > 0 && pagedUsers.every((u) => selectedUserIds.has(u.id));
  }
}

/* ----------------------------------------------------------------------------
 * 7. BULK ACTIONS HANDLER
 * ---------------------------------------------------------------------------- */
function setupBulkActions() {
  const selectAllCheckbox = document.getElementById('selectAllUsersCheckbox');
  const bulkToolbar = document.getElementById('adminBulkToolbar');
  const bulkCountSpan = document.getElementById('bulkSelectedCount');
  const bulkActivateBtn = document.getElementById('btnBulkActivate');
  const bulkSuspendBtn = document.getElementById('btnBulkSuspend');
  const bulkDeleteBtn = document.getElementById('btnBulkDelete');

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, filteredUsers.length);
      const pagedUsers = filteredUsers.slice(startIndex, endIndex);

      if (e.target.checked) {
        pagedUsers.forEach((u) => selectedUserIds.add(u.id));
      } else {
        pagedUsers.forEach((u) => selectedUserIds.delete(u.id));
      }

      document.querySelectorAll('.user-select-checkbox').forEach((cb) => {
        const uId = cb.getAttribute('data-user-id');
        cb.checked = selectedUserIds.has(uId);
      });
      updateBulkToolbar();
    });
  }

  if (bulkActivateBtn) {
    bulkActivateBtn.addEventListener('click', () => {
      currentUsers.forEach((u) => {
        if (selectedUserIds.has(u.id)) u.status = 'active';
      });
      saveAdminUsersList(currentUsers);
      showToast(`Bulk activated ${selectedUserIds.size} member accounts.`, 'success', 'Bulk Action Complete');
      selectedUserIds.clear();
      renderUsersTable();
      updateBulkToolbar();
    });
  }

  if (bulkSuspendBtn) {
    bulkSuspendBtn.addEventListener('click', () => {
      currentUsers.forEach((u) => {
        if (selectedUserIds.has(u.id)) u.status = 'suspended';
      });
      saveAdminUsersList(currentUsers);
      showToast(`Bulk suspended ${selectedUserIds.size} member accounts.`, 'warning', 'Bulk Action Complete');
      selectedUserIds.clear();
      renderUsersTable();
      updateBulkToolbar();
    });
  }

  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', () => {
      const count = selectedUserIds.size;
      showAdminFormModal({
        title: 'Delete Selected Accounts',
        subtitle: `Are you sure you want to permanently delete ${count} selected account(s)? This action cannot be reversed.`,
        submitText: `Confirm Delete (${count})`,
        fields: [],
        onSubmit: () => {
          currentUsers = currentUsers.filter((u) => !selectedUserIds.has(u.id));
          saveAdminUsersList(currentUsers);
          filteredUsers = filteredUsers.filter((u) => !selectedUserIds.has(u.id));
          showToast(`Deleted ${count} accounts from enterprise ledger.`, 'info', 'Records Purged');
          selectedUserIds.clear();
          renderUsersTable();
          updateBulkToolbar();
        }
      });
    });
  }
}

function updateBulkToolbar() {
  const bulkToolbar = document.getElementById('adminBulkToolbar');
  const bulkCountSpan = document.getElementById('bulkSelectedCount');
  if (!bulkToolbar) return;

  if (selectedUserIds.size > 0) {
    bulkToolbar.classList.add('show');
    if (bulkCountSpan) bulkCountSpan.textContent = selectedUserIds.size.toString();
  } else {
    bulkToolbar.classList.remove('show');
  }
}

export function copyTextToClipboard(text) {
  return new Promise((resolve) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => resolve(true))
        .catch(() => {
          fallbackCopyText(text);
          resolve(true);
        });
    } else {
      fallbackCopyText(text);
      resolve(true);
    }
  });
}

function fallbackCopyText(text) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
  } catch (err) {
    console.warn('Fallback copy failed:', err);
  }
}

export function copyUserDossierToClipboard(userId, btnEl) {
  const user = getUserById(userId);
  if (!user) return;

  const text = formatUserDossier(user);
  copyTextToClipboard(text).then(() => {
    showToast(`Full member details & wire codes for ${user.fullName} copied to clipboard!`, 'success', 'Dossier Copied');
  });

  if (btnEl) {
    const origHtml = btnEl.innerHTML;
    btnEl.innerHTML = '✓ Copied!';
    btnEl.style.color = '#34d399';
    btnEl.style.borderColor = '#10b981';
    setTimeout(() => {
      btnEl.innerHTML = origHtml;
      btnEl.style.color = '#38bdf8';
      btnEl.style.borderColor = 'rgba(56, 189, 248, 0.45)';
    }, 2000);
  }
}

export function approveUserAccount(userId) {
  const user = getUserById(userId);
  if (!user) return;

  user.status = 'active';
  user.account_status = 'active';
  user.accountStatus = 'active';
  user.kycStatus = 'verified';
  user.kyc_status = 'verified';
  user.statusReason = 'Account Active & Verified';
  if (Array.isArray(user.accounts)) {
    user.accounts.forEach((a) => { a.status = 'active'; });
  }
  if (Array.isArray(user.cards)) {
    user.cards.forEach((c) => { c.status = 'active'; c.is_frozen = false; });
  }
  user.activityLog = user.activityLog || [];
  user.activityLog.unshift({
    date: new Date().toISOString().replace('T', ' ').slice(0, 19),
    action: 'Account approved & activated by Chief Treasury Auditor',
    ip: 'Admin Console',
    officer: 'Chief Treasury Auditor'
  });
  updateUser(user);

  currentUsers = currentUsers.map((u) => u.id === user.id ? { ...user } : u);
  filteredUsers = filteredUsers.map((u) => u.id === user.id ? { ...user } : u);

  try {
    const cur = getDemoStorageUser();
    if (cur && (cur.id === user.id || cur.email === user.email)) {
      cur.status = 'active';
      cur.account_status = 'active';
      cur.accountStatus = 'active';
      cur.kycStatus = 'verified';
      cur.kyc_status = 'verified';
      cur.statusReason = 'Account Active & Verified';
      setDemoStorageUser(cur);
    }
  } catch (e) {}

  try {
    const rawCards = localStorage.getItem('wb_credit_union_atm_cards');
    if (rawCards) {
      const uCards = JSON.parse(rawCards);
      if (Array.isArray(uCards)) {
        uCards.forEach((c) => {
          if (c.userId === user.id || c.userEmail === user.email) {
            c.status = 'active';
            c.is_frozen = false;
          }
        });
        localStorage.setItem('wb_credit_union_atm_cards', JSON.stringify(uCards));
      }
    }
  } catch (err) {}

  renderUsersTable();
  showToast(`Account for ${user.fullName} has been approved and activated.`, 'success', 'Account Activated');
}

// Global top-level bindings for window execution
if (typeof window !== 'undefined') {
  window.openUserDetailDrawer = openUserDetailDrawer;
  window._realOpenUserDetailDrawer = openUserDetailDrawer;
  window.closeUserDetailDrawer = closeUserDetailDrawer;
  window.approveUserAccount = approveUserAccount;
  window.copyUserDossierToClipboard = copyUserDossierToClipboard;

  document.addEventListener('click', (e) => {
    // 1. Approve Button Click
    const approveBtn = e.target.closest('.btn-approve-user, [data-action="approve-user"]');
    if (approveBtn) {
      e.preventDefault();
      e.stopPropagation();
      const uId = approveBtn.getAttribute('data-user-id');
      if (uId) approveUserAccount(uId);
      return;
    }

    // 2. Copy Info Button Click
    const copyBtn = e.target.closest('.btn-copy-user-details, [data-action="copy-user"]');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const uId = copyBtn.getAttribute('data-user-id');
      if (uId) copyUserDossierToClipboard(uId, copyBtn);
      return;
    }

    // 3. Manage Button Click
    const viewBtn = e.target.closest('.btn-view-user, [data-action="view-user"]');
    if (viewBtn) {
      e.preventDefault();
      e.stopPropagation();
      const uId = viewBtn.getAttribute('data-user-id');
      if (uId) openUserDetailDrawer(uId);
      return;
    }

    // 4. User Row Click
    const userRow = e.target.closest('.admin-user-row');
    if (userRow && !e.target.closest('button, input, select, a, td.text-right')) {
      const uId = userRow.getAttribute('data-user-id');
      if (uId) openUserDetailDrawer(uId);
    }
  });
}

/* ----------------------------------------------------------------------------
 * 8. USER DETAIL DRAWER CONTROLLER
 * ---------------------------------------------------------------------------- */
function setupUserDetailDrawer() {
  const overlay = document.getElementById('adminDrawerOverlay');
  const panel = document.getElementById('adminDrawerPanel');
  const closeBtn = document.getElementById('closeUserDrawerBtn');
  const drawerTabs = document.querySelectorAll('.admin-drawer-tab');

  if (closeBtn && panel && overlay) {
    closeBtn.addEventListener('click', closeUserDetailDrawer);
    overlay.addEventListener('click', closeUserDetailDrawer);
  }

  drawerTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-drawer-tab');
      if (!targetTab) return;

      drawerTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.admin-drawer-tab-content').forEach((c) => c.classList.remove('active'));
      const activeContent = document.getElementById(`drawer-tab-${targetTab}`);
      if (activeContent) activeContent.classList.add('active');
    });
  });

  setupDrawerActionButtons();
  if (typeof window !== 'undefined') {
    window.initAdminUserManagement = initAdminUserManagement;
    window.openUserDetailDrawer = openUserDetailDrawer;
    window._realOpenUserDetailDrawer = openUserDetailDrawer;
    window.closeUserDetailDrawer = closeUserDetailDrawer;
    window.approveUserAccount = approveUserAccount;
    window.copyUserDossierToClipboard = copyUserDossierToClipboard;
  }
}

export function openUserDetailDrawer(userId) {
  console.log('[ADMIN DRAWER] Opening drawer for:', userId);
  if (!userId) return;

  // Resolve user by object, ID, email, or phone
  let user = (typeof userId === 'object' && userId !== null) ? userId : null;
  if (!user && typeof userId === 'string') {
    const cleanId = userId.trim();
    user = getUserById(cleanId);
    if (!user) {
      const all = (typeof currentUsers !== 'undefined' && Array.isArray(currentUsers) && currentUsers.length > 0)
        ? currentUsers
        : getAdminUsersList();
      user = (all || []).find((u) => u && (
        u.id === cleanId ||
        String(u.id) === cleanId ||
        (u.email && u.email.toLowerCase() === cleanId.toLowerCase()) ||
        (u.phone && u.phone.replace(/[^0-9]/g, '') === cleanId.replace(/[^0-9]/g, ''))
      )) || null;
    }
  }

  if (!user) {
    console.warn('[ADMIN DRAWER] Specified member record not found:', userId);
    return;
  }

  activeDetailUser = user;
  const overlay = document.getElementById('adminDrawerOverlay');
  const panel = document.getElementById('adminDrawerPanel');

  if (overlay) {
    overlay.classList.add('show');
    overlay.style.display = 'block';
  }
  if (panel) {
    panel.style.display = 'flex';
    panel.classList.add('open');
  }

  // Populate Header
  const avatarEl = document.getElementById('drawerUserAvatar');
  const nameEl = document.getElementById('drawerUserName');
  const emailEl = document.getElementById('drawerUserEmail');
  const idEl = document.getElementById('drawerUserId');
  const statusEl = document.getElementById('drawerUserStatus');
  const kycEl = document.getElementById('drawerUserKyc');
  const pwdDisplayVal = document.getElementById('drawerUserPasswordVal');

  if (avatarEl) {
    if (user.profilePhoto || user.avatarUrl) {
      avatarEl.innerHTML = `<img src="${escapeHtml(user.profilePhoto || user.avatarUrl)}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='${escapeHtml(user.avatar || (user.fullName || 'MB').slice(0, 2).toUpperCase())}';" />`;
      avatarEl.style.padding = '0';
      avatarEl.style.overflow = 'hidden';
    } else {
      avatarEl.textContent = user.avatar || (user.fullName || 'MB').slice(0, 2).toUpperCase();
      avatarEl.style.background = user.avatarColor || '#3b82f6';
    }
  }
  if (pwdDisplayVal) {
    pwdDisplayVal.textContent = user.password || 'MemberPass123!';
  }
  if (nameEl) nameEl.textContent = user.fullName || 'Member';
  if (emailEl) emailEl.textContent = user.email || 'N/A';
  if (idEl) idEl.textContent = `ID: ${user.id || 'N/A'}`;
  if (statusEl) {
    const st = user.status || 'active';
    statusEl.className = `action-chip badge-status-${st}`;
    statusEl.textContent = st.toUpperCase();
  }
  if (kycEl) {
    const isVer = (user.kycStatus || user.kyc_status || '').toLowerCase() === 'verified';
    const isPend = (user.kycStatus || user.kyc_status || '').toLowerCase() === 'pending';
    kycEl.className = `action-chip ${isVer ? 'action-chip-approve' : (isPend ? 'action-chip-pending' : 'action-chip-flag')}`;
    kycEl.textContent = isVer ? '✓ VERIFIED' : (user.kycStatus || user.kyc_status || 'UNVERIFIED').toUpperCase();
  }

  // Safely render each tab without letting one failure prevent others
  try { renderDrawerProfileTab(user); } catch (e) { console.error('Drawer Profile error:', e); }
  try { renderDrawerAccountsTab(user); } catch (e) { console.error('Drawer Accounts error:', e); }
  try { renderDrawerTransactionsTab(user); } catch (e) { console.error('Drawer Transactions error:', e); }
  try { renderDrawerCardsTab(user); } catch (e) { console.error('Drawer Cards error:', e); }
  try { renderDrawerCryptoTab(user); } catch (e) { console.error('Drawer Crypto error:', e); }
  try { renderDrawerWireCodesTab(user); } catch (e) { console.error('Drawer Wire error:', e); }
  try { renderDrawerNotificationsTab(user); } catch (e) { console.error('Drawer Notifications error:', e); }
  try { renderDrawerActivityTab(user); } catch (e) { console.error('Drawer Activity error:', e); }

  // Switch to first tab (Profile) by default
  const drawerTabs = document.querySelectorAll('.admin-drawer-tab');
  drawerTabs.forEach((t) => t.classList.remove('active'));
  const firstTab = document.querySelector('.admin-drawer-tab[data-drawer-tab="profile"]');
  if (firstTab) firstTab.classList.add('active');

  document.querySelectorAll('.admin-drawer-tab-content').forEach((c) => c.classList.remove('active'));
  const profileTabContent = document.getElementById('drawer-tab-profile');
  if (profileTabContent) profileTabContent.classList.add('active');
}

export function closeUserDetailDrawer() {
  const overlay = document.getElementById('adminDrawerOverlay');
  const panel = document.getElementById('adminDrawerPanel');
  if (overlay) {
    overlay.classList.remove('show');
    overlay.style.display = 'none';
  }
  if (panel) {
    panel.classList.remove('open');
  }
}

/* ----------------------------------------------------------------------------
 * 9. DRAWER TABS RENDERERS
 * ---------------------------------------------------------------------------- */

/** TAB 1: Profile & KYC */
function renderDrawerProfileTab(user) {
  const container = document.getElementById('drawer-tab-profile');
  if (!container) return;

  const cleanFullName = (user.fullName || '').replace(/\b(\w+(?:\s+\w+)?)\s+\1\b/gi, '$1').trim();
  const names = cleanFullName.split(/\s+/).filter(Boolean);
  let defaultFirstName = user.firstName || names[0] || '';
  let defaultMiddleName = user.middleName || (names.length > 2 ? names.slice(1, -1).join(' ') : '');
  let defaultLastName = user.lastName || (names.length > 1 ? names[names.length - 1] : '');

  // If firstName has multiple parts or repeats lastName, normalize cleanly
  if (names.length >= 2) {
    if (defaultFirstName.toLowerCase().includes(defaultLastName.toLowerCase()) || defaultFirstName.split(/\s+/).length > 1) {
      defaultFirstName = names[0];
      defaultMiddleName = names.length > 2 ? names.slice(1, -1).join(' ') : '';
      defaultLastName = names[names.length - 1];
    }
  }
  user = ensureUserHasUniqueCodesAndAccounts(user);
  const primaryAcct = (user.accounts && user.accounts[0]) ? user.accounts[0] : { accountNumber: generateRandomAccountNumber(), type: 'Checking', balance: 0.00 };
  const cot = user.wireTransferCodes?.COT?.code || generateRandomCotCode();
  const imf = user.wireTransferCodes?.IMF?.code || generateRandomImfCode();
  const tax = user.wireTransferCodes?.TAX?.code || generateRandomTaxCode();
  const txPin = user.transactionPin || user.pin || generateRandomPin();

  container.innerHTML = `
    ${(user.status === 'inactive' || user.status === 'dormant' || user.status === 'pending') ? `
      <div class="p-3 mb-3 d-flex items-center justify-between rounded" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.45);">
        <div class="d-flex items-center gap-2">
          <span style="font-size: 1.5rem;">🔒</span>
          <div>
            <div class="font-bold text-xs" style="color: #fbbf24;">ACCOUNT STATUS: INACTIVE / PENDING CREDIT & ACTIVATION</div>
            <div class="text-xs text-muted">Newly registered member with $0.00 balance awaiting Admin credit & activation signoff.</div>
          </div>
        </div>
        <button type="button" class="admin-btn admin-btn-emerald admin-btn-sm font-bold" id="btnDrawerApproveUser" style="white-space: nowrap; margin-left: 10px; background: #059669; border-color: #10b981;">
          ⚡ EXECUTE CREDIT &amp; ACTIVATE ACCOUNT
        </button>
      </div>
    ` : ''}

    <form id="drawerEditUserForm" novalidate>
      <div class="admin-user-acct-box mb-4">
        <div class="d-flex justify-between items-center mb-3">
          <h4 class="text-white text-sm font-bold m-0">✏️ Edit Member Profile &amp; Credentials</h4>
          <span class="text-xs text-muted">User ID: ${user.id}</span>
        </div>

        <div class="d-grid grid-cols-1 grid-md-3 gap-3 mb-3">
          <div>
            <label class="admin-form-label">First Name *</label>
            <input type="text" id="editUserFirstName" class="admin-form-control" value="${escapeHtml(defaultFirstName)}" required />
          </div>
          <div>
            <label class="admin-form-label">Middle Name <span class="text-muted text-xs">(Optional)</span></label>
            <input type="text" id="editUserMiddleName" class="admin-form-control" value="${escapeHtml(defaultMiddleName)}" />
          </div>
          <div>
            <label class="admin-form-label">Last Name *</label>
            <input type="text" id="editUserLastName" class="admin-form-control" value="${escapeHtml(defaultLastName)}" required />
          </div>
        </div>

        <div class="d-grid grid-cols-1 grid-md-3 gap-3 mb-3">
          <div>
            <label class="admin-form-label">Username</label>
            <input type="text" id="editUserUsername" class="admin-form-control" value="${escapeHtml(user.username || user.email?.split('@')[0] || '')}" />
          </div>
          <div>
            <label class="admin-form-label">Email Address *</label>
            <input type="email" id="editUserEmail" class="admin-form-control" value="${escapeHtml(user.email || '')}" required />
          </div>
          <div>
            <label class="admin-form-label">Phone Number</label>
            <input type="tel" id="editUserPhone" class="admin-form-control" value="${escapeHtml(user.phone || '')}" />
          </div>
        </div>

        <div class="d-grid grid-cols-1 grid-md-3 gap-3 mb-3">
          <div>
            <label class="admin-form-label">Date of Birth (mm/dd/yyyy)</label>
            <input type="text" id="editUserDob" class="admin-form-control" value="${escapeHtml(user.dob || '')}" placeholder="mm/dd/yyyy" />
          </div>
          <div>
            <label class="admin-form-label">Occupation</label>
            <input type="text" id="editUserOccupation" class="admin-form-control" value="${escapeHtml(user.occupation || 'Executive Director')}" />
          </div>
          <div>
            <label class="admin-form-label">Nationality</label>
            <select id="editUserNationality" class="admin-form-control"></select>
          </div>
        </div>

        <div class="admin-form-group mb-3">
          <label class="admin-form-label">Address</label>
          <input type="text" id="editUserAddress" class="admin-form-control" value="${escapeHtml(user.address || '')}" />
        </div>

        <div class="text-xs font-bold text-white uppercase mt-4 mb-2" style="color: #34d399; letter-spacing: 0.05em;">Vault &amp; Account Details</div>
        <div class="d-grid grid-cols-1 grid-md-3 gap-3 mb-3">
          <div>
            <label class="admin-form-label">Account Type</label>
            <select id="editUserAcctType" class="admin-form-control">
              <option value="Checking" ${primaryAcct.type === 'Checking' ? 'selected' : ''}>Premier Checking</option>
              <option value="Savings" ${primaryAcct.type === 'Savings' ? 'selected' : ''}>Savings Reserve</option>
              <option value="Business" ${primaryAcct.type === 'Business' ? 'selected' : ''}>Institutional Business</option>
              <option value="Offshore" ${primaryAcct.type === 'Offshore' ? 'selected' : ''}>Swiss Sovereign Offshore</option>
              <option value="Fixed Deposit" ${primaryAcct.type === 'Fixed Deposit' ? 'selected' : ''}>Fixed Deposit Yield</option>
            </select>
          </div>
          <div>
            <label class="admin-form-label">Account Number</label>
            <input type="text" id="editUserAcctNum" class="admin-form-control font-mono" value="${escapeHtml(primaryAcct.accountNumber)}" />
          </div>
          <div>
            <label class="admin-form-label">Account Balance ($)</label>
            <input type="number" step="0.01" id="editUserAcctBalance" class="admin-form-control font-mono font-bold" value="${primaryAcct.balance || 0}" />
          </div>
        </div>

        <div class="text-xs font-bold text-white uppercase mt-4 mb-2" style="color: #fbbf24; letter-spacing: 0.05em;">Clearance Codes &amp; Security PIN</div>
        <div class="d-grid grid-cols-2 grid-md-4 gap-3 mb-3">
          <div>
            <label class="admin-form-label">COT Code</label>
            <input type="text" id="editUserCotCode" class="admin-form-control font-mono" value="${escapeHtml(cot)}" />
          </div>
          <div>
            <label class="admin-form-label">IMF Clearance</label>
            <input type="text" id="editUserImfCode" class="admin-form-control font-mono" value="${escapeHtml(imf)}" />
          </div>
          <div>
            <label class="admin-form-label">TAX Code</label>
            <input type="text" id="editUserTaxCode" class="admin-form-control font-mono" value="${escapeHtml(tax)}" />
          </div>
          <div>
            <label class="admin-form-label">4 Digit Transaction PIN</label>
            <input type="text" id="editUserTxPin" class="admin-form-control font-mono" maxlength="4" value="${escapeHtml(txPin)}" />
          </div>
        </div>

        <div class="text-xs font-bold text-white uppercase mt-4 mb-2" style="color: #c084fc; letter-spacing: 0.05em;">Security Credentials, Password &amp; Profile Media</div>
        <div class="d-grid grid-cols-1 grid-md-2 gap-3 mb-3">
          <!-- Profile Photo (URL or Upload) -->
          <div class="p-3 rounded" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(192, 132, 252, 0.35);">
            <div class="d-flex items-center justify-between mb-2">
              <label class="admin-form-label m-0 text-white font-bold" style="font-size: 0.82rem;">Profile Photo</label>
              <button type="button" id="btnRemoveEditUserPhoto" class="admin-btn admin-btn-outline admin-btn-sm" style="padding: 2px 8px; font-size: 0.72rem; color: #f87171; border-color: rgba(239,68,68,0.4);">✕ Clear</button>
            </div>
            <div class="d-flex items-center gap-3 mb-2">
              <div id="editUserPhotoPreview" class="avatar-sm rounded-circle d-flex items-center justify-content-center text-xs font-bold overflow-hidden" style="width: 44px; height: 44px; background: #1e293b; border: 2px solid #a855f7; color: #cbd5e1; flex-shrink: 0;">
                ${(user.profilePhoto || user.avatarUrl) ? `<img src="${escapeHtml(user.profilePhoto || user.avatarUrl)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-weight: 800; font-size: 1rem; color: #e2e8f0;">${escapeHtml(user.avatar || (user.fullName || 'MB').slice(0, 2).toUpperCase())}</span>`}
              </div>
              <div style="flex: 1; min-width: 0;">
                <label class="admin-btn admin-btn-outline admin-btn-sm w-100 d-flex items-center justify-center gap-1 mb-1" style="cursor: pointer; padding: 4px 8px; font-size: 0.75rem; background: rgba(168, 85, 247, 0.1); border-color: #a855f7; color: #e9d5ff;">
                  📁 Upload Photo
                  <input type="file" id="editUserProfilePhotoFile" accept="image/*" style="display: none;" />
                </label>
                <input type="text" id="editUserProfilePhoto" class="admin-form-control font-mono" value="${escapeHtml(user.profilePhoto || user.avatarUrl || '')}" placeholder="Photo URL..." style="font-size: 0.75rem; padding: 4px 8px;" />
              </div>
            </div>
          </div>

          <!-- Biometric Passport / ID (URL or Upload) -->
          <div class="p-3 rounded" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.3);">
            <div class="d-flex items-center justify-between mb-2">
              <label class="admin-form-label m-0 text-white font-bold" style="font-size: 0.82rem;">Biometric Passport (ID)</label>
              <button type="button" id="btnRemoveEditUserPassport" class="admin-btn admin-btn-outline admin-btn-sm" style="padding: 2px 8px; font-size: 0.72rem; color: #f87171; border-color: rgba(239,68,68,0.4);">✕ Clear</button>
            </div>
            <div class="d-flex items-center gap-3 mb-2">
              <div id="editUserPassportPreview" class="avatar-sm rounded d-flex items-center justify-content-center text-xs font-bold overflow-hidden" style="width: 44px; height: 44px; background: #1e293b; border: 2px solid #0ea5e9; color: #cbd5e1; flex-shrink: 0;">
                ${(user.passportPhoto || user.passportUrl) ? `<img src="${escapeHtml(user.passportPhoto || user.passportUrl)}" alt="Passport" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-weight: 800; font-size: 0.7rem; color: #94a3b8;">NO ID</span>`}
              </div>
              <div style="flex: 1; min-width: 0;">
                <label class="admin-btn admin-btn-outline admin-btn-sm w-100 d-flex items-center justify-center gap-1 mb-1" style="cursor: pointer; padding: 4px 8px; font-size: 0.75rem; background: rgba(14, 165, 233, 0.1); border-color: #0ea5e9; color: #bae6fd;">
                  📁 Upload ID
                  <input type="file" id="editUserPassportFile" accept="image/*,application/pdf" style="display: none;" />
                </label>
                <input type="text" id="editUserPassport" class="admin-form-control font-mono" value="${escapeHtml(user.passportPhoto || user.passportUrl || '')}" placeholder="ID URL..." style="font-size: 0.75rem; padding: 4px 8px;" />
              </div>
            </div>
          </div>
        </div>

        <div class="d-grid grid-cols-1 grid-md-2 gap-3 mb-3">
          <!-- User Password View & Edit -->
          <div class="p-3 rounded" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.4);">
            <div class="d-flex items-center justify-between mb-2">
              <label class="admin-form-label m-0 text-white font-bold" style="font-size: 0.82rem;">Member Password <span style="color: #34d399; font-weight: normal; font-size: 0.72rem;">(Visible)</span></label>
              <div class="d-flex items-center gap-1">
                <button type="button" id="btnToggleUserPasswordVisibility" class="admin-btn admin-btn-outline admin-btn-sm" style="padding: 2px 7px; font-size: 0.72rem; color: #38bdf8; border-color: rgba(56,189,248,0.4);" title="Show or Hide plain password">
                  👁️ <span id="pwdToggleText">Hide</span>
                </button>
                <button type="button" id="btnCopyUserPassword" class="admin-btn admin-btn-outline admin-btn-sm" style="padding: 2px 7px; font-size: 0.72rem;" title="Copy to clipboard">
                  📋 Copy
                </button>
                <button type="button" id="btnGenerateUserPassword" class="admin-btn admin-btn-outline admin-btn-sm" style="padding: 2px 7px; font-size: 0.72rem; color: #34d399; border-color: rgba(52,211,153,0.4);" title="Generate new secure password">
                  🎲 Generate
                </button>
              </div>
            </div>

            <div class="mb-1">
              <input type="text" id="editUserPassword" class="admin-form-control font-mono font-bold" value="${escapeHtml(user.password || 'MemberPass123!')}" placeholder="Enter new password" style="color: #38bdf8; background: #0b1120; border-color: #0284c7; font-size: 0.95rem; letter-spacing: 0.05em;" />
            </div>
            
            <div class="d-flex items-center justify-between mt-1">
              <span class="text-xs text-muted" style="font-size: 0.7rem;">Admin can see, copy, change, or edit login password</span>
              <span class="badge-status-active action-chip" style="font-size: 0.65rem; padding: 1px 6px;">MASTER ACCESS</span>
            </div>
          </div>
        </div>

        <div class="p-3 rounded mb-3" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(52, 211, 153, 0.25);">
          <div class="text-xs font-bold text-white uppercase mb-2" style="color: #34d399;">🪪 Biometric Passport & KYC Documents</div>
          <div class="d-flex items-center gap-4">
            <div style="width: 140px; height: 100px; background: #0b1120; border: 1px dashed #334155; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${(user.passportPhoto || user.profilePhoto) ? `<img src="${escapeHtml(user.passportPhoto || user.profilePhoto)}" alt="Passport" style="width: 100%; height: 100%; object-fit: contain; cursor: pointer;" onclick="window.open(this.src);" title="Click to view full size" />` : `<span class="text-xs text-muted">No Passport</span>`}
            </div>
            <div class="flex-1">
              <div class="text-xs text-white font-bold mb-1">Status: <span style="color: ${(user.kycStatus || '').toLowerCase() === 'verified' ? '#34d399' : '#fbbf24'};">${(user.kycStatus || 'Unverified').toUpperCase()}</span></div>
              <p class="text-xs text-muted mb-0">High-resolution biometric document for Swiss interbank clearance. If blank, ask member to upload via Security settings.</p>
            </div>
          </div>
        </div>

        <div class="d-grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="admin-form-label">Account Clearance Status</label>
            <select id="drawerAccountStatusSelect" class="admin-form-control">
              <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active (Full Access)</option>
              <option value="inactive" ${(user.status === 'inactive' || user.status === 'dormant' || user.status === 'pending') ? 'selected' : ''}>Inactive / Dormant (Pending Approval)</option>
              <option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>Suspended (Holds Active)</option>
              <option value="frozen" ${user.status === 'frozen' ? 'selected' : ''}>Frozen (Security Freeze)</option>
              <option value="closed" ${user.status === 'closed' ? 'selected' : ''}>Closed (Liquidated)</option>
            </select>
          </div>
          <div>
            <label class="admin-form-label">KYC Verification Tier</label>
            <select id="drawerKycStatusSelect" class="admin-form-control">
              <option value="verified" ${(user.kycStatus || user.kyc_status || '').toLowerCase() === 'verified' ? 'selected' : ''}>Verified (Tier 3 Passport)</option>
              <option value="pending" ${(user.kycStatus || user.kyc_status || '').toLowerCase() === 'pending' ? 'selected' : ''}>Pending Officer Review</option>
              <option value="rejected" ${(user.kycStatus || user.kyc_status || '').toLowerCase() === 'rejected' ? 'selected' : ''}>Rejected (Resubmit)</option>
              <option value="unverified" ${(user.kycStatus || user.kyc_status || '').toLowerCase() === 'unverified' ? 'selected' : ''}>Unverified</option>
            </select>
          </div>
        </div>

        <button type="submit" id="btnExecuteSaveProfileChanges" class="admin-btn admin-btn-primary font-bold mt-2" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 0.75rem 1.5rem; font-size: 0.95rem;">
          ⚡ EXECUTE &amp; SAVE PROFILE CHANGES
        </button>
      </div>
    </form>

    <!-- Impersonation & Dangerous Actions -->
    <div class="admin-user-acct-box" style="border-color: rgba(239, 68, 68, 0.4);">
      <h4 class="text-white text-sm font-bold mb-2">Officer Support &amp; Impersonation</h4>
      <p class="text-xs text-muted mb-3">Authenticate as this member to troubleshoot wire requests or view user dashboard.</p>

      <div class="d-flex items-center gap-3 flex-wrap">
        <button type="button" class="admin-btn admin-btn-outline" id="btnCopyDrawerFullDossier" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.5); font-weight: bold;">
          📋 Copy Member Details &amp; Transaction Codes
        </button>
        <button type="button" class="admin-btn admin-btn-emerald" id="btnImpersonateUser">
          🛡️ Login as User (Impersonate)
        </button>
        <button type="button" class="admin-btn admin-btn-outline" id="btnSendDirectEmail">
          ✉️ Send Direct Email
        </button>
        <button type="button" class="admin-btn admin-btn-danger" id="btnDeleteSingleUser">
          🗑️ Permanently Delete User
        </button>
      </div>
    </div>
  `;

  // Populate Nationality Select with all world countries
  const natSelect = document.getElementById('editUserNationality');
  if (natSelect) {
    populateWorldCountriesDropdown(natSelect, user.nationality || 'Switzerland');
  }

  // Setup Profile Photo Upload and URL handlers
  const photoFileInput = document.getElementById('editUserProfilePhotoFile');
  const photoUrlInput = document.getElementById('editUserProfilePhoto');
  const photoPreview = document.getElementById('editUserPhotoPreview');
  const removePhotoBtn = document.getElementById('btnRemoveEditUserPhoto');

  if (photoFileInput) {
    photoFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.size > 8 * 1024 * 1024) {
          showToast('Image file size exceeds 8MB limit.', 'error', 'File Too Large');
          return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target?.result;
          if (photoUrlInput) photoUrlInput.value = dataUrl;
          if (photoPreview) {
            photoPreview.innerHTML = `<img src="${dataUrl}" alt="Profile Preview" style="width: 100%; height: 100%; object-fit: cover;" />`;
          }
          showToast('Profile photo loaded from file. Click "EXECUTE & SAVE" to apply.', 'info', 'Photo Selected');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (photoUrlInput) {
    photoUrlInput.addEventListener('input', () => {
      const url = photoUrlInput.value.trim();
      if (photoPreview) {
        if (url) {
          photoPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Profile Preview" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'color:#f87171;font-size:0.7rem;\\'>Invalid URL</span>';" />`;
        } else {
          photoPreview.innerHTML = `<span style="font-weight: 800; font-size: 1.1rem; color: #e2e8f0;">${escapeHtml(user.avatar || user.fullName.slice(0, 2).toUpperCase())}</span>`;
        }
      }
    });
  }

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
      if (photoFileInput) photoFileInput.value = '';
      if (photoUrlInput) photoUrlInput.value = '';
      if (photoPreview) {
        photoPreview.innerHTML = `<span style="font-weight: 800; font-size: 1.1rem; color: #e2e8f0;">${escapeHtml(user.avatar || user.fullName.slice(0, 2).toUpperCase())}</span>`;
      }
      showToast('Profile photo cleared. Click "EXECUTE & SAVE" to persist.', 'info', 'Photo Cleared');
    });
  }

  // Setup Password Show/Hide, Copy & Generate handlers
  const pwdInput = document.getElementById('editUserPassword');
  const togglePwdBtn = document.getElementById('btnToggleUserPasswordVisibility');
  const pwdToggleText = document.getElementById('pwdToggleText');
  const copyPwdBtn = document.getElementById('btnCopyUserPassword');
  const genPwdBtn = document.getElementById('btnGenerateUserPassword');

  if (togglePwdBtn && pwdInput) {
    togglePwdBtn.addEventListener('click', () => {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        if (pwdToggleText) pwdToggleText.textContent = 'Hide';
      } else {
        pwdInput.type = 'password';
        if (pwdToggleText) pwdToggleText.textContent = 'Show';
      }
    });
  }

  if (copyPwdBtn && pwdInput) {
    copyPwdBtn.addEventListener('click', () => {
      const val = pwdInput.value;
      if (val) {
        navigator.clipboard?.writeText(val).then(() => {
          showToast(`Password copied to clipboard!`, 'success', 'Password Copied');
        }).catch(() => {
          showToast(`Password: ${val}`, 'info', 'User Password');
        });
      }
    });
  }

  if (genPwdBtn && pwdInput) {
    genPwdBtn.addEventListener('click', () => {
      const prefixList = ['SwissVault', 'Sovereign', 'Alpine', 'Zurich', 'CreditUnion', 'Premier', 'Nexus'];
      const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
      const num = Math.floor(1000 + Math.random() * 9000);
      const symbols = ['!', '@', '#', '$', '%', '&', '*'];
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      const newPwd = `${prefix}#${num}${sym}`;
      pwdInput.value = newPwd;
      pwdInput.type = 'text';
      if (pwdToggleText) pwdToggleText.textContent = 'Hide';
      showToast(`Generated new password: ${newPwd}`, 'success', 'Password Generated');
    });
  }

  // Bind Form Submit
  const editForm = document.getElementById('drawerEditUserForm');
  const saveBtn = document.getElementById('btnExecuteSaveProfileChanges');

  const doSaveProfile = (e) => {
    if (e) e.preventDefault();
    const fn = document.getElementById('editUserFirstName')?.value.trim() || '';
    const mn = document.getElementById('editUserMiddleName')?.value.trim() || '';
    const ln = document.getElementById('editUserLastName')?.value.trim() || '';
    let fullName = [fn, mn, ln].filter(Boolean).join(' ') || user.fullName;
    // Strip accidental repeated phrases like "GUNNAR BERGKVIST GUNNAR BERGKVIST"
    fullName = fullName.replace(/\b(\w+(?:\s+\w+)?)\s+\1\b/gi, '$1').trim();

    user.firstName = fn;
    user.middleName = mn;
    user.lastName = ln;
    user.fullName = fullName;
    user.username = document.getElementById('editUserUsername')?.value.trim() || user.username;
    user.email = document.getElementById('editUserEmail')?.value.trim() || user.email;
    user.phone = document.getElementById('editUserPhone')?.value.trim() || user.phone;
    user.dob = document.getElementById('editUserDob')?.value.trim() || user.dob;
    user.occupation = document.getElementById('editUserOccupation')?.value.trim() || user.occupation;
    user.nationality = document.getElementById('editUserNationality')?.value || user.nationality;
    user.address = document.getElementById('editUserAddress')?.value.trim() || user.address;
    
    // Save Profile Photo & Biometric Passport
    const updatedPhoto = document.getElementById('editUserProfilePhoto')?.value.trim() || '';
    const updatedPassport = document.getElementById('editUserPassport')?.value.trim() || updatedPhoto;
    
    user.profilePhoto = updatedPhoto;
    user.avatarUrl = updatedPhoto;
    user.passportPhoto = updatedPassport;
    user.passportUrl = updatedPassport;
    user.kycDocument = updatedPassport;
    
    // Save User Password
    const pwdVal = document.getElementById('editUserPassword')?.value.trim();
    if (pwdVal) {
      user.password = pwdVal;
    }

    const selStatus = document.getElementById('drawerAccountStatusSelect')?.value || user.status || 'active';
    const selKyc = document.getElementById('drawerKycStatusSelect')?.value || user.kycStatus || 'verified';

    user.status = selStatus;
    user.account_status = selStatus;
    user.accountStatus = selStatus === 'active' ? 'active' : (selStatus === 'inactive' ? 'dormant' : selStatus);
    user.kycStatus = selKyc;
    user.kyc_status = selKyc;

    if (selStatus === 'active') {
      user.statusReason = (selKyc === 'verified') ? 'Account Active & Verified' : 'Account Active';
      if (Array.isArray(user.accounts)) {
        user.accounts.forEach((a) => { a.status = 'active'; });
      }
      if (Array.isArray(user.cards)) {
        user.cards.forEach((c) => {
          c.status = 'active';
          c.is_frozen = false;
        });
      }
    } else if (selStatus === 'inactive') {
      user.statusReason = 'Pending Administrative Approval';
    }

    const newCot = document.getElementById('editUserCotCode')?.value.trim();
    const newImf = document.getElementById('editUserImfCode')?.value.trim();
    const newTax = document.getElementById('editUserTaxCode')?.value.trim();
    const newPin = document.getElementById('editUserTxPin')?.value.trim();

    if (!user.wireTransferCodes) user.wireTransferCodes = {};
    if (newCot) user.wireTransferCodes.COT = { code: newCot, active: true, notes: 'Updated in Admin Drawer' };
    if (newImf) user.wireTransferCodes.IMF = { code: newImf, active: true, notes: 'Updated in Admin Drawer' };
    if (newTax) user.wireTransferCodes.TAX = { code: newTax, active: true, notes: 'Updated in Admin Drawer' };
    if (newPin) user.transactionPin = newPin;

    // Update primary account
    const newAcctNum = document.getElementById('editUserAcctNum')?.value.trim();
    const newAcctType = document.getElementById('editUserAcctType')?.value;
    const newAcctBal = parseFloat(document.getElementById('editUserAcctBalance')?.value || '0');

    if (!Array.isArray(user.accounts) || user.accounts.length === 0) {
      user.accounts = [
        { id: `acct-usd-${user.id || 'usr'}`, accountNumber: newAcctNum || '9482-1049-55', type: newAcctType || 'Checking', name: 'US Dollar Primary Vault', currency: 'USD', balance: newAcctBal, available: newAcctBal, status: user.status || 'active', routingNumber: '021000089', isPrimary: true },
        { id: `acct-eur-${user.id || 'usr'}`, accountNumber: `WB-EUR-${Math.floor(1000 + Math.random() * 9000)}`, type: 'Offshore', name: 'Euro Global Holding Vault', currency: 'EUR', balance: 0.00, available: 0.00, status: user.status || 'active', routingNumber: '021000089' },
        { id: `acct-gbp-${user.id || 'usr'}`, accountNumber: `WB-GBP-${Math.floor(1000 + Math.random() * 9000)}`, type: 'Offshore', name: 'British Pound Sterling Vault', currency: 'GBP', balance: 0.00, available: 0.00, status: user.status || 'active', routingNumber: '021000089' },
        { id: `acct-chf-${user.id || 'usr'}`, accountNumber: `WB-CHF-${Math.floor(1000 + Math.random() * 9000)}`, type: 'Offshore', name: 'Swiss Franc Reserve Vault', currency: 'CHF', balance: 0.00, available: 0.00, status: user.status || 'active', routingNumber: '021000089' },
        { id: `acct-cad-${user.id || 'usr'}`, accountNumber: `WB-CAD-${Math.floor(1000 + Math.random() * 9000)}`, type: 'Business', name: 'Canadian Dollar Commercial Vault', currency: 'CAD', balance: 0.00, available: 0.00, status: user.status || 'active', routingNumber: '021000089' },
        { id: `acct-aud-${user.id || 'usr'}`, accountNumber: `WB-AUD-${Math.floor(1000 + Math.random() * 9000)}`, type: 'Business', name: 'Australian Dollar Treasury Vault', currency: 'AUD', balance: 0.00, available: 0.00, status: user.status || 'active', routingNumber: '021000089' },
        { id: `acct-jpy-${user.id || 'usr'}`, accountNumber: `WB-JPY-${Math.floor(1000 + Math.random() * 9000)}`, type: 'Business', name: 'Japanese Yen Multi-Asset Vault', currency: 'JPY', balance: 0.00, available: 0.00, status: user.status || 'active', routingNumber: '021000089' },
        { id: `acct-ngn-${user.id || 'usr'}`, accountNumber: `WB-NGN-${Math.floor(1000 + Math.random() * 9000)}`, type: 'Savings', name: 'Nigerian Naira International Vault', currency: 'NGN', balance: 0.00, available: 0.00, status: user.status || 'active', routingNumber: '021000089' },
      ];
    } else {
      if (newAcctNum) user.accounts[0].accountNumber = newAcctNum;
      if (newAcctType) user.accounts[0].type = newAcctType;
      user.accounts[0].balance = newAcctBal;
      user.accounts[0].available = newAcctBal;
      if (user.status === 'active') user.accounts[0].status = 'active';
    }

    user.activityLog.unshift({
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      action: `Updated member profile details & credentials`,
      ip: 'Admin Console',
      officer: 'Chief Treasury Auditor'
    });

    updateUser(user);

    // Also update demo user session if it matches
    const cur = getDemoStorageUser();
    if (cur && (cur.id === user.id || cur.email === user.email)) {
      Object.assign(cur, user);
      setDemoStorageUser(cur);
    }

    openUserDetailDrawer(user.id);
    renderUsersTable();
    showToast(`Profile & credentials updated for ${user.fullName}.`, 'success', 'Profile Saved');
  };

  if (editForm) {
    editForm.addEventListener('submit', doSaveProfile);
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', doSaveProfile);
  }

  // Bind Drawer Quick Approve / Credit Account button
  const drawerApproveBtn = document.getElementById('btnDrawerApproveUser');
  if (drawerApproveBtn) {
    drawerApproveBtn.onclick = () => {
      user.status = 'active';
      user.account_status = 'active';
      user.accountStatus = 'active';
      user.kycStatus = 'verified';
      user.kyc_status = 'verified';
      user.statusReason = 'Account Active & Verified';
      if (Array.isArray(user.accounts)) {
        user.accounts.forEach((a) => {
          a.status = 'active';
        });
      }
      if (Array.isArray(user.cards)) {
        user.cards.forEach((c) => { c.status = 'active'; c.is_frozen = false; });
      }
      user.activityLog.unshift({
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        action: 'Account approved & activated by Chief Treasury Auditor',
        ip: 'Admin Console',
        officer: 'Chief Treasury Auditor'
      });
      updateUser(user);

      // Also activate demo user session if it matches
      const cur = getDemoStorageUser();
      if (cur && (cur.id === user.id || cur.email === user.email)) {
        cur.status = 'active';
        cur.account_status = 'active';
        cur.accountStatus = 'active';
        cur.kycStatus = 'verified';
        cur.kyc_status = 'verified';
        cur.statusReason = 'Account Active & Verified';
        setDemoStorageUser(cur);
      }

      openUserDetailDrawer(user.id);
      renderUsersTable();
      showToast(`Account for ${user.fullName} has been activated.`, 'success', 'Account Activated');
    };
  }

  // Bind Copy Complete Member Dossier & Transaction Codes
  const copyFullDossierBtn = document.getElementById('btnCopyDrawerFullDossier');
  if (copyFullDossierBtn) {
    copyFullDossierBtn.onclick = () => {
      const text = formatUserDossier(user);
      navigator.clipboard?.writeText(text).then(() => {
        showToast(`Full details & transaction clearance codes for ${user.fullName} copied to clipboard!`, 'success', 'Dossier Copied');
      }).catch(() => {
        showToast(`User Details Copied`, 'info');
      });
      copyFullDossierBtn.innerHTML = '✓ Copied to Clipboard!';
      copyFullDossierBtn.style.color = '#34d399';
      copyFullDossierBtn.style.borderColor = '#10b981';
      setTimeout(() => {
        copyFullDossierBtn.innerHTML = '📋 Copy Member Details &amp; Transaction Codes';
        copyFullDossierBtn.style.color = '#38bdf8';
        copyFullDossierBtn.style.borderColor = 'rgba(56, 189, 248, 0.5)';
      }, 2500);
    };
  }

  // Bind Impersonate User
  const impersonateBtn = document.getElementById('btnImpersonateUser');
  if (impersonateBtn) {
    impersonateBtn.onclick = () => {
      showAdminFormModal({
        title: 'Member Vault Impersonation',
        subtitle: `Access member banking interface as ${user.fullName} (${user.email}). All session actions are recorded in the audit log.`,
        submitText: 'Access Member Dashboard',
        fields: [],
        onSubmit: () => {
          setDemoStorageUser(user);
          showToast(`Impersonating ${user.fullName}. Redirecting to member dashboard...`, 'info', 'Session Switch');
          setTimeout(() => {
            window.location.href = '/pages/dashboard.html';
          }, 800);
        }
      });
    };
  }

  // Bind Delete User
  const deleteBtn = document.getElementById('btnDeleteSingleUser');
  if (deleteBtn) {
    deleteBtn.onclick = () => {
      showAdminFormModal({
        title: 'Delete Member Account',
        subtitle: `CRITICAL WARNING: Are you certain you wish to delete member ${user.fullName}? All associated accounts, balances, and history will be purged.`,
        submitText: 'Confirm Permanent Deletion',
        fields: [],
        onSubmit: () => {
          currentUsers = currentUsers.filter((u) => u.id !== user.id);
          saveAdminUsersList(currentUsers);
          filteredUsers = filteredUsers.filter((u) => u.id !== user.id);
          closeUserDetailDrawer();
          renderUsersTable();
          showToast(`Member ${user.fullName} purged from database.`, 'info', 'User Deleted');
        }
      });
    };
  }

  // Send Direct Email
  const sendEmailBtn = document.getElementById('btnSendDirectEmail');
  if (sendEmailBtn) {
    sendEmailBtn.onclick = () => {
      showAdminFormModal({
        title: 'Dispatch Treasury Email',
        subtitle: `Recipient: ${user.fullName} (${user.email})`,
        submitText: 'Send Email',
        fields: [
          { id: 'subj', label: 'Email Subject *', value: 'WB Credit Union Treasury Notice', required: true },
          { id: 'msg', type: 'textarea', label: 'Message Body *', value: 'Your recent account verification and regulatory clearances have been approved by the Treasury department.', required: true }
        ],
        onSubmit: ({ subj, msg }) => {
          showToast(`Email dispatched to ${user.email}.`, 'success', 'Email Sent');
        }
      });
    };
  }
}

/**
 * Universal In-App Action Modal System (Avoids browser prompt/confirm blocks in iframes)
 */
export function showAdminFormModal({ title, subtitle = '', fields = [], submitText = 'Save Changes', onSubmit }) {
  let modal = document.getElementById('adminDynamicActionModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.id = 'adminDynamicActionModal';
    document.body.appendChild(modal);
  }

  const fieldHtml = fields.map((f) => {
    if (f.type === 'select') {
      return `
        <div class="admin-form-group mb-3">
          <label class="admin-form-label">${escapeHtml(f.label)}</label>
          <select id="${f.id}" class="admin-form-control" ${f.required ? 'required' : ''}>
            ${(f.options || []).map(opt => `<option value="${escapeHtml(opt.value)}" ${opt.value === f.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
          </select>
          ${f.help ? `<div class="text-xs text-muted mt-1">${escapeHtml(f.help)}</div>` : ''}
        </div>
      `;
    }
    if (f.type === 'textarea') {
      return `
        <div class="admin-form-group mb-3">
          <label class="admin-form-label">${escapeHtml(f.label)}</label>
          <textarea id="${f.id}" class="admin-form-control" rows="${f.rows || 3}" placeholder="${escapeHtml(f.placeholder || '')}" ${f.required ? 'required' : ''}>${escapeHtml(f.value || '')}</textarea>
          ${f.help ? `<div class="text-xs text-muted mt-1">${escapeHtml(f.help)}</div>` : ''}
        </div>
      `;
    }
    return `
      <div class="admin-form-group mb-3">
        <label class="admin-form-label">${escapeHtml(f.label)}</label>
        <input type="${f.type || 'text'}" id="${f.id}" class="admin-form-control ${f.fontMono ? 'font-mono' : ''}" value="${escapeHtml(String(f.value ?? ''))}" placeholder="${escapeHtml(f.placeholder || '')}" step="${f.step || 'any'}" ${f.required ? 'required' : ''} ${f.readonly ? 'readonly style="background:rgba(255,255,255,0.05);"' : ''} />
        ${f.help ? `<div class="text-xs text-muted mt-1">${escapeHtml(f.help)}</div>` : ''}
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="admin-modal-card" style="max-width: 540px; width: 95%;">
      <div class="admin-modal-header">
        <div>
          <h3 class="admin-modal-title">${escapeHtml(title)}</h3>
          ${subtitle ? `<p class="text-xs text-muted mb-0">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="admin-modal-close" id="closeDynamicActionModalBtn">&times;</button>
      </div>
      <form id="adminDynamicActionForm">
        <div class="admin-modal-body">
          ${fieldHtml}
        </div>
        <div class="admin-modal-footer">
          <button type="button" class="admin-btn admin-btn-outline" id="cancelDynamicActionModalBtn">Cancel</button>
          <button type="submit" class="admin-btn admin-btn-primary">${escapeHtml(submitText)}</button>
        </div>
      </form>
    </div>
  `;

  modal.classList.add('show');

  const closeFn = () => modal.classList.remove('show');
  const closeBtn = modal.querySelector('#closeDynamicActionModalBtn');
  const cancelBtn = modal.querySelector('#cancelDynamicActionModalBtn');
  if (closeBtn) closeBtn.onclick = closeFn;
  if (cancelBtn) cancelBtn.onclick = closeFn;
  modal.onclick = (e) => { if (e.target === modal) closeFn(); };

  const dynForm = modal.querySelector('#adminDynamicActionForm');
  if (dynForm) {
    dynForm.onsubmit = (e) => {
      e.preventDefault();
      const result = {};
      fields.forEach((f) => {
        const el = document.getElementById(f.id);
        if (el) result[f.id] = el.value.trim();
      });
      closeFn();
      onSubmit(result);
    };
  }
}


/** TAB 2: Accounts & Balances */
function renderDrawerAccountsTab(user) {
  const container = document.getElementById('drawer-tab-accounts');
  if (!container) return;

  // Ensure all 8 standard multi-currency accounts are present
  const standardCurrencies = [
    { currency: 'USD', name: 'US Dollar Primary Vault', type: 'Checking' },
    { currency: 'EUR', name: 'Euro Global Holding Vault', type: 'Offshore' },
    { currency: 'GBP', name: 'British Pound Sterling Vault', type: 'Offshore' },
    { currency: 'CHF', name: 'Swiss Franc Reserve Vault', type: 'Offshore' },
    { currency: 'CAD', name: 'Canadian Dollar Commercial Vault', type: 'Business' },
    { currency: 'AUD', name: 'Australian Dollar Treasury Vault', type: 'Business' },
    { currency: 'JPY', name: 'Japanese Yen Multi-Asset Vault', type: 'Business' },
    { currency: 'NGN', name: 'Nigerian Naira International Vault', type: 'Savings' },
  ];

  if (!Array.isArray(user.accounts)) user.accounts = [];
  standardCurrencies.forEach((sc) => {
    let exists = user.accounts.find(a => a.currency === sc.currency);
    if (!exists) {
      user.accounts.push({
        accountNumber: `${sc.currency}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`,
        type: sc.type,
        name: sc.name,
        currency: sc.currency,
        balance: 0.00,
        available: 0.00,
        status: user.status || 'inactive',
        routingNumber: '021000089',
        isPrimary: sc.currency === 'USD',
      });
    }
  });

  // Ensure matching wallets array
  if (!Array.isArray(user.wallets)) user.wallets = [];
  user.accounts.forEach((a) => {
    let wExists = user.wallets.find(w => w.currency === a.currency);
    if (!wExists) {
      user.wallets.push({
        currency: a.currency,
        name: a.name,
        balance: a.balance || 0.00,
        isPrimary: a.isPrimary || false,
      });
    } else {
      wExists.balance = a.balance;
    }
  });

  container.innerHTML = `
    <div class="d-flex justify-between items-center mb-3">
      <h4 class="text-white text-sm font-bold m-0">Managed Multi-Currency Accounts (${user.accounts.length})</h4>
      <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" id="btnDrawerOpenNewAcct">
        + Open Custom Vault
      </button>
    </div>

    ${user.accounts.map((acct, idx) => `
      <div class="admin-user-acct-box mb-3">
        <div class="d-flex justify-between items-start mb-2">
          <div>
            <div class="font-bold text-white text-md">${escapeHtml(acct.name)}</div>
            <div class="font-mono text-xs text-muted">${acct.accountNumber} • Routing: ${acct.routingNumber || '021000089'}</div>
          </div>
          <span class="action-chip ${acct.status === 'active' ? 'action-chip-approve' : 'action-chip-flag'}">
            ${acct.status.toUpperCase()}
          </span>
        </div>

        <div class="d-flex justify-between items-baseline mb-3 p-3" style="background:#090d16; border-radius:8px;">
          <span class="text-xs text-muted uppercase">Settled Vault Balance (${acct.currency})</span>
          <span class="font-mono text-xl font-bold text-white">
            ${acct.currency} ${(acct.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div class="d-flex items-center gap-2 flex-wrap">
          <button type="button" class="admin-btn admin-btn-emerald admin-btn-sm btn-drawer-credit" data-acct-idx="${idx}">
            + Credit Account
          </button>
          <button type="button" class="admin-btn admin-btn-danger admin-btn-sm btn-drawer-debit" data-acct-idx="${idx}">
            - Debit Account
          </button>
          <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-drawer-edit-bal" data-acct-idx="${idx}">
            ✏️ Edit Balance
          </button>
          <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-drawer-freeze-acct" data-acct-idx="${idx}">
            ${acct.status === 'active' ? '❄️ Freeze' : '🔓 Unfreeze'}
          </button>
        </div>
      </div>
    `).join('')}
  `;

  // Bind Open New Account for this user (NO PROMPT)
  const openNewAcctBtn = document.getElementById('btnDrawerOpenNewAcct');
  if (openNewAcctBtn) {
    openNewAcctBtn.onclick = () => {
      showAdminFormModal({
        title: 'Open New Account Portfolio',
        subtitle: `Provision additional vault facility for ${user.fullName}`,
        submitText: 'Open Account',
        fields: [
          {
            id: 'acctType',
            type: 'select',
            label: 'Account Facility Type *',
            value: 'Checking',
            options: [
              { value: 'Checking', label: 'Premier Checking Account' },
              { value: 'Savings', label: 'Wealth Savings Reserve' },
              { value: 'Business', label: 'Institutional Business Vault' },
              { value: 'Offshore', label: 'Swiss Sovereign Offshore Vault' },
              { value: 'Fixed Deposit', label: 'Fixed Deposit Yield Certificate' },
              { value: 'Money Market', label: 'Money Market Treasury Account' }
            ]
          },
          {
            id: 'curr',
            type: 'select',
            label: 'Denomination Currency *',
            value: 'USD',
            options: [
              { value: 'USD', label: 'USD - United States Dollar ($)' },
              { value: 'EUR', label: 'EUR - Euro (€)' },
              { value: 'CHF', label: 'CHF - Swiss Franc (CHF)' },
              { value: 'GBP', label: 'GBP - British Pound (£)' }
            ]
          },
          { id: 'bal', type: 'number', step: '0.01', label: 'Initial Account Balance *', value: '10000.00', required: true },
          { id: 'acctNum', label: 'Account Number *', fontMono: true, value: `9482-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`, required: true }
        ],
        onSubmit: ({ acctType, curr, bal, acctNum }) => {
          const initialBal = parseFloat(bal) || 0;
          const newAcct = {
            accountNumber: acctNum,
            type: acctType,
            name: `${acctType} Account`,
            currency: curr,
            balance: initialBal,
            status: initialBal > 0 ? 'active' : 'inactive',
            routingNumber: '021000089'
          };
          user.accounts.push(newAcct);
          user.activityLog.unshift({
            date: new Date().toISOString().replace('T', ' ').slice(0, 19),
            action: `Opened new ${acctType} account ${acctNum} with ${curr} ${initialBal.toLocaleString()}`,
            ip: 'Admin Console',
            officer: 'Chief Treasury Auditor'
          });
          updateUser(user);
          renderDrawerAccountsTab(user);
          renderUsersTable();
          showToast(`Account ${acctNum} opened for ${user.fullName}.`, 'success', 'Account Opened');
        }
      });
    };
  }

  // Helper to sync account credit / debit / balance edit
  const syncAccountBalanceUpdate = (acct, newBal, txType, val, reason) => {
    acct.balance = newBal;
    acct.available = newBal;
    acct.status = 'active';
    user.status = 'active';

    // Sync matching wallet
    if (!Array.isArray(user.wallets)) user.wallets = [];
    let matchingW = user.wallets.find(w => w.currency === acct.currency);
    if (matchingW) matchingW.balance = newBal;
    else user.wallets.push({ currency: acct.currency, name: acct.name, balance: newBal });

    // Record in user transactions
    if (!Array.isArray(user.transactions)) user.transactions = [];
    const txObj = {
      id: `TX-${Math.floor(1000 + Math.random() * 9000)}`,
      date: 'Just now',
      timestamp: new Date().toISOString(),
      type: txType === 'credit' ? 'Treasury Credit Deposit' : (txType === 'debit' ? 'Treasury Fee Settlement' : 'Admin Balance Adjustment'),
      amount: txType === 'debit' ? -val : val,
      currency: acct.currency,
      description: reason || 'Treasury Administrative Adjustment',
      recipient: user.fullName,
      sender: 'WB Credit Union Treasury',
      status: 'completed',
      ref: `ADM-TRF-${Math.floor(100000 + Math.random() * 900000)}`,
      account: `${acct.name} (${acct.currency} ****${(acct.accountNumber || '').slice(-4)})`,
      accountKey: acct.currency,
      fee: 0.00,
      adminNote: `Account balance adjusted to ${acct.currency} ${newBal.toLocaleString()} by Chief Treasury Auditor.`
    };
    user.transactions.unshift(txObj);

    // Save and sync
    updateUser(user);

    // Dispatch notification
    try {
      createNotification(
        user.id,
        'transaction',
        `Vault Balance Update: ${acct.currency} ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Your ${acct.name || acct.currency + ' Vault'} balance has been updated to ${acct.currency} ${newBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${reason}).`,
        { action_url: '#transactions', transactionId: txObj.id }
      );
    } catch (e) {
      console.warn('In-app notification error:', e);
    }
  };

  // Bind Credit Account
  container.querySelectorAll('.btn-drawer-credit').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-acct-idx'), 10);
      const acct = user.accounts[idx];
      showAdminFormModal({
        title: `Credit Account (+ Add Funds)`,
        subtitle: `Target: ${acct.name} (${acct.accountNumber}) • Current: ${acct.currency} ${(acct.balance || 0).toLocaleString()}`,
        submitText: 'Authorize Credit',
        fields: [
          { id: 'amt', type: 'number', step: '0.01', label: `Credit Amount (${acct.currency}) *`, value: '10000.00', required: true },
          { id: 'reason', label: 'Memo / Audit Description *', value: 'Treasury Liquidity Inflow Authorization', required: true }
        ],
        onSubmit: ({ amt, reason }) => {
          const val = parseFloat(amt);
          if (isNaN(val) || val <= 0) {
            showToast('Please enter a valid credit amount.', 'error', 'Invalid Amount');
            return;
          }
          const newBal = (acct.balance || 0) + val;
          syncAccountBalanceUpdate(acct, newBal, 'credit', val, reason);

          user.activityLog.unshift({
            date: new Date().toISOString().replace('T', ' ').slice(0, 19),
            action: `Credited +${acct.currency} ${val.toLocaleString()} to ${acct.accountNumber} (${reason})`,
            ip: 'Admin Console',
            officer: 'Chief Treasury Auditor'
          });
          updateUser(user);

          renderDrawerAccountsTab(user);
          renderUsersTable();
          showToast(`Credited +${acct.currency} ${val.toLocaleString()} to ${user.fullName}.`, 'success', 'Account Credited');
        }
      });
    };
  });

  // Bind Debit Account
  container.querySelectorAll('.btn-drawer-debit').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-acct-idx'), 10);
      const acct = user.accounts[idx];
      showAdminFormModal({
        title: `Debit Account (- Deduct Funds)`,
        subtitle: `Target: ${acct.name} (${acct.accountNumber}) • Current: ${acct.currency} ${(acct.balance || 0).toLocaleString()}`,
        submitText: 'Authorize Debit',
        fields: [
          { id: 'amt', type: 'number', step: '0.01', label: `Debit Amount (${acct.currency}) *`, value: '1000.00', required: true },
          { id: 'reason', label: 'Memo / Audit Description *', value: 'Treasury Fee Settlement / Chargeback', required: true }
        ],
        onSubmit: ({ amt, reason }) => {
          const val = parseFloat(amt);
          if (isNaN(val) || val <= 0) {
            showToast('Please enter a valid debit amount.', 'error', 'Invalid Amount');
            return;
          }
          const newBal = Math.max(0, (acct.balance || 0) - val);
          syncAccountBalanceUpdate(acct, newBal, 'debit', val, reason);

          user.activityLog.unshift({
            date: new Date().toISOString().replace('T', ' ').slice(0, 19),
            action: `Debited -${acct.currency} ${val.toLocaleString()} from ${acct.accountNumber} (${reason})`,
            ip: 'Admin Console',
            officer: 'Chief Treasury Auditor'
          });
          updateUser(user);

          renderDrawerAccountsTab(user);
          renderUsersTable();
          showToast(`Debited -${acct.currency} ${val.toLocaleString()} from ${user.fullName}.`, 'warning', 'Debit Completed');
        }
      });
    };
  });

  // Bind Edit Balance Directly
  container.querySelectorAll('.btn-drawer-edit-bal').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-acct-idx'), 10);
      const acct = user.accounts[idx];
      showAdminFormModal({
        title: 'Override Account Balance',
        subtitle: `Account: ${acct.accountNumber} (Current: ${acct.currency} ${(acct.balance || 0).toLocaleString()})`,
        submitText: 'Save Exact Balance',
        fields: [
          { id: 'bal', type: 'number', step: '0.01', label: `New Exact Balance (${acct.currency}) *`, value: (acct.balance || 0).toString(), required: true },
          { id: 'reason', label: 'Audit Reason *', value: 'Executive balance adjustment', required: true }
        ],
        onSubmit: ({ bal, reason }) => {
          const val = parseFloat(bal);
          if (isNaN(val) || val < 0) {
            showToast('Please enter a valid balance amount.', 'error', 'Invalid Amount');
            return;
          }
          const old = acct.balance || 0;
          syncAccountBalanceUpdate(acct, val, 'override', Math.abs(val - old), reason);

          user.activityLog.unshift({
            date: new Date().toISOString().replace('T', ' ').slice(0, 19),
            action: `Balance override on ${acct.accountNumber} from ${acct.currency} ${old.toLocaleString()} to ${acct.currency} ${val.toLocaleString()} (${reason})`,
            ip: 'Admin Console',
            officer: 'Chief Treasury Auditor'
          });
          updateUser(user);

          renderDrawerAccountsTab(user);
          renderUsersTable();
          showToast(`Balance updated to ${acct.currency} ${val.toLocaleString()}.`, 'success', 'Balance Overridden');
        }
      });
    };
  });


  // Freeze/Unfreeze Account
  container.querySelectorAll('.btn-drawer-freeze-acct').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-acct-idx'), 10);
      const acct = user.accounts[idx];
      acct.status = acct.status === 'active' ? 'frozen' : 'active';

      user.activityLog.unshift({
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        action: `Account ${acct.accountNumber} marked as ${acct.status.toUpperCase()}`,
        ip: 'Admin Console',
        officer: 'Chief Treasury Auditor'
      });

      updateUser(user);
      renderDrawerAccountsTab(user);
      showToast(`Account ${acct.accountNumber} is now ${acct.status.toUpperCase()}.`, 'info', 'Status Toggled');
    };
  });
}

/** TAB 3: Transactions */
function renderDrawerTransactionsTab(user) {
  const container = document.getElementById('drawer-tab-transactions');
  if (!container) return;

  const txs = user.transactions || [];

  container.innerHTML = `
    <div class="d-flex justify-between items-center mb-3">
      <h4 class="text-white text-sm font-bold m-0">Recent Transactions (${txs.length})</h4>
    </div>

    ${txs.length === 0 ? `
      <div class="text-center p-4 text-muted text-xs">No transactions recorded for this user yet.</div>
    ` : `
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Ref / Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            ${txs.map((tx, idx) => `
              <tr>
                <td>
                  <div class="font-mono text-white text-xs font-bold">${tx.id || tx.reference}</div>
                  <div class="text-xs text-muted">${new Date(tx.date).toLocaleDateString()}</div>
                </td>
                <td>
                  <div class="text-white text-xs">${escapeHtml(tx.description)}</div>
                  ${tx.adminNotes ? `<div class="text-xs" style="color:#38bdf8;">Note: ${escapeHtml(tx.adminNotes)}</div>` : ''}
                </td>
                <td>
                  <span class="font-mono text-white font-semibold">
                    ${tx.currency} ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td>
                  <span class="action-chip ${tx.status === 'completed' ? 'action-chip-approve' : (tx.status === 'pending' ? 'action-chip-pending' : 'action-chip-flag')}">
                    ${tx.status.toUpperCase()}
                  </span>
                </td>
                <td class="text-right">
                  <button class="admin-btn admin-btn-outline admin-btn-sm btn-edit-tx" data-tx-idx="${idx}">
                    Modify
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;

  // Bind Modify Transaction (NO PROMPT)
  container.querySelectorAll('.btn-edit-tx').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-tx-idx'), 10);
      const tx = txs[idx];

      showAdminFormModal({
        title: `Modify Transaction ${tx.id || tx.reference}`,
        subtitle: `Amount: ${tx.currency || 'USD'} ${tx.amount?.toLocaleString()} • Date: ${new Date(tx.date).toLocaleDateString()}`,
        submitText: 'Save Transaction',
        fields: [
          {
            id: 'st',
            type: 'select',
            label: 'Settlement Status *',
            value: tx.status,
            options: [
              { value: 'completed', label: 'Completed (Settled)' },
              { value: 'pending', label: 'Pending Clearance' },
              { value: 'reversed', label: 'Reversed (Chargeback)' },
              { value: 'failed', label: 'Failed / Declined' }
            ]
          },
          { id: 'note', label: 'Compliance Officer Notes', value: tx.adminNotes || 'Audit review authorized' }
        ],
        onSubmit: ({ st, note }) => {
          tx.status = st;
          tx.adminNotes = note;
          user.activityLog.unshift({
            date: new Date().toISOString().replace('T', ' ').slice(0, 19),
            action: `Modified transaction ${tx.id || tx.reference} status to ${tx.status.toUpperCase()}`,
            ip: 'Admin Console',
            officer: 'Chief Treasury Auditor'
          });
          updateUser(user);
          renderDrawerTransactionsTab(user);
          showToast(`Transaction ${tx.id || tx.reference} updated.`, 'success', 'Transaction Modified');
        }
      });
    };
  });
}

/** TAB 4: ATM Cards */
function renderDrawerCardsTab(user) {
  const container = document.getElementById('drawer-tab-cards');
  if (!container) return;

  // Aggregate all cards belonging to this user across all storages
  const allCardsMap = new Map();
  if (Array.isArray(user.cards)) {
    user.cards.forEach((c) => {
      if (c && (c.id || c.cardNumber)) {
        const key = c.id || c.cardNumber;
        allCardsMap.set(key, c);
      }
    });
  }

  try {
    const rawAdminCards = localStorage.getItem('wb_credit_union_admin_cards_db');
    if (rawAdminCards) {
      const aCards = JSON.parse(rawAdminCards);
      if (Array.isArray(aCards)) {
        aCards.forEach((c) => {
          if (!c) return;
          const isMatch = (c.userId && String(c.userId) === String(user.id)) ||
            (c.userEmail && user.email && c.userEmail.toLowerCase() === user.email.toLowerCase()) ||
            (Array.isArray(user.accounts) && user.accounts.some((a) => a.accountNumber === c.accountNumber)) ||
            (c.cardHolder && user.lastName && c.cardHolder.toLowerCase().includes(user.lastName.toLowerCase()));
          if (isMatch) {
            const key = c.id || c.cardNumber;
            allCardsMap.set(key, Object.assign({}, allCardsMap.get(key) || {}, c));
          }
        });
      }
    }
  } catch (e) {}

  try {
    const rawAtm = localStorage.getItem('wb_credit_union_atm_cards');
    if (rawAtm) {
      const uCards = JSON.parse(rawAtm);
      if (Array.isArray(uCards)) {
        uCards.forEach((c) => {
          if (!c) return;
          const isMatch = (c.userId && String(c.userId) === String(user.id)) ||
            (c.userEmail && user.email && c.userEmail.toLowerCase() === user.email.toLowerCase()) ||
            (Array.isArray(user.accounts) && user.accounts.some((a) => a.accountNumber === c.accountNumber));
          if (isMatch) {
            const key = c.id || c.cardNumber;
            allCardsMap.set(key, Object.assign({}, allCardsMap.get(key) || {}, c));
          }
        });
      }
    }
  } catch (e) {}

  const cards = Array.from(allCardsMap.values());
  user.cards = cards;

  container.innerHTML = `
    <div class="d-flex justify-between items-center mb-3 flex-wrap gap-2">
      <div>
        <h4 class="text-white text-sm font-bold m-0">Issued Debit / ATM Cards (${cards.length})</h4>
        <span class="text-xs text-muted">All payment cards issued to <strong class="text-white">${escapeHtml(user.fullName || 'Member')}</strong></span>
      </div>
      <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" id="btnDrawerIssueCard">
        + Issue / Add New Card
      </button>
    </div>

    ${cards.length === 0 ? `
      <div class="text-center p-4 text-muted text-xs">No active ATM cards issued to this member. Click "+ Issue / Add New Card" above.</div>
    ` : cards.map((c, idx) => `
      <div class="admin-user-acct-box mb-3">
        <div class="d-flex justify-between items-start mb-2">
          <div>
            <div class="font-bold text-white text-sm">${escapeHtml(c.type || c.cardType || 'Sovereign Visa Platinum Debit')}</div>
            <div class="font-mono text-xs text-muted">${c.cardNumber || c.cardMasked || '•••• •••• •••• 1234'} • Exp: ${c.expiry || '10/30'} • PIN: <span class="text-white font-bold">${c.pin || '8869'}</span></div>
          </div>
          <span class="action-chip ${c.status === 'active' ? 'action-chip-approve' : 'action-chip-flag'}">
            ${(c.status || 'active').toUpperCase()}
          </span>
        </div>

        <div class="d-grid grid-cols-2 gap-3 mb-3 p-2" style="background:#090d16; border-radius:8px;">
          <div>
            <span class="text-xs text-muted d-block">Daily ATM Limit</span>
            <span class="font-mono text-sm text-white font-bold">$${(c.dailyAtmLimit || 10000).toLocaleString()}</span>
          </div>
          <div>
            <span class="text-xs text-muted d-block">Online POS Limit</span>
            <span class="font-mono text-sm text-white font-bold">$${(c.onlineLimit || c.dailyPosLimit || 50000).toLocaleString()}</span>
          </div>
        </div>

        <div class="d-flex items-center gap-2 flex-wrap">
          <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-edit-card-full" data-crd-idx="${idx}">
            ✏️ Edit Card
          </button>
          <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-toggle-card-lock" data-crd-idx="${idx}">
            ${c.status === 'active' ? '🔒 Lock Card' : '🔓 Unlock Card'}
          </button>
          <button type="button" class="admin-btn admin-btn-danger admin-btn-sm btn-delete-card" data-crd-idx="${idx}">
            🗑️ Delete Card
          </button>
        </div>
      </div>
    `).join('')}
  `;

  // Issue / Add Card (NO PROMPT)
  const issueCardBtn = document.getElementById('btnDrawerIssueCard');
  if (issueCardBtn) {
    issueCardBtn.onclick = () => {
      showAdminFormModal({
        title: 'Issue New ATM / Debit Card',
        subtitle: `Physical & Digital Card Provisioning for ${user.fullName}`,
        submitText: 'Generate & Issue Card',
        fields: [
          {
            id: 'tier',
            type: 'select',
            label: 'Card Tier Model (Pricing & Attributes) *',
            value: 'Visa Infinite Global Elite Black Metal',
            options: [
              { value: 'Visa Standard Debit', label: 'Visa Standard Debit ($100.00)' },
              { value: 'Mastercard Standard Debit', label: 'Mastercard Standard Debit ($100.00)' },
              { value: 'Visa Gold Preferred', label: 'Visa Gold Preferred ($250.00)' },
              { value: 'Mastercard Gold Preferred', label: 'Mastercard Gold Preferred ($250.00)' },
              { value: 'Visa Platinum Premier', label: 'Visa Platinum Premier ($500.00)' },
              { value: 'Mastercard Platinum Premier', label: 'Mastercard Platinum Premier ($500.00)' },
              { value: 'Visa Corporate Executive', label: 'Visa Corporate Executive ($750.00)' },
              { value: 'Mastercard Corporate Executive', label: 'Mastercard Corporate Executive ($750.00)' },
              { value: 'Visa Infinite Global Elite Black Metal', label: 'Visa Infinite Global Elite Black Metal ($1,000.00)' },
              { value: 'Mastercard World Global Elite Black Metal', label: 'Mastercard World Global Elite Black Metal ($1,000.00)' }
            ]
          },
          { id: 'holder', label: 'Cardholder Name *', value: (user.fullName || 'MEMBER').toUpperCase(), required: true },
          { id: 'pan', label: '16-Digit Card Number *', fontMono: true, value: ('4532 ' + Math.floor(1000 + Math.random() * 9000) + ' ' + Math.floor(1000 + Math.random() * 9000) + ' ' + Math.floor(1000 + Math.random() * 9000)), required: true },
          { id: 'exp', label: 'Expiry Date (mm/yy) *', value: '10/30', required: true },
          { id: 'cvv', label: '3-Digit CVV *', value: String(Math.floor(100 + Math.random() * 900)), required: true },
          { id: 'pin', label: '4-Digit Transaction PIN *', value: user.transactionPin || '8869', required: true },
          { id: 'atmLimit', type: 'number', label: 'Daily ATM Withdrawal Limit ($) *', value: '10000', required: true },
          { id: 'posLimit', type: 'number', label: 'Daily POS / E-Commerce Limit ($) *', value: '50000', required: true }
        ],
        onSubmit: ({ tier, holder, pan, exp, cvv, pin, atmLimit, posLimit }) => {
          const newCard = {
            id: `crd-${Date.now()}`,
            userId: user.id,
            cardNumber: pan,
            cardMasked: `•••• •••• •••• ${pan.replace(/\s+/g, '').slice(-4)}`,
            card_number: pan.replace(/\s+/g, ''),
            cardHolder: holder.toUpperCase(),
            cardholder_name: holder.toUpperCase(),
            userEmail: user.email,
            accountNumber: user.accounts?.[0]?.accountNumber || '9482-1049-55',
            type: tier,
            cardType: tier,
            expiry: exp,
            cvv,
            pin,
            status: 'active',
            dailyAtmLimit: parseFloat(atmLimit) || 10000,
            dailyPosLimit: parseFloat(posLimit) || 50000,
            onlineLimit: parseFloat(posLimit) || 50000,
          };
          if (!user.cards) user.cards = [];
          user.cards.push(newCard);
          try {
            const rawCards = localStorage.getItem('wb_credit_union_admin_cards_db');
            const adminCards = rawCards ? JSON.parse(rawCards) : [];
            adminCards.unshift(newCard);
            localStorage.setItem('wb_credit_union_admin_cards_db', JSON.stringify(adminCards));
          } catch (e) {}
          try {
            const rawAtm = localStorage.getItem('wb_credit_union_atm_cards');
            const atmCards = rawAtm ? JSON.parse(rawAtm) : [];
            atmCards.unshift(newCard);
            localStorage.setItem('wb_credit_union_atm_cards', JSON.stringify(atmCards));
          } catch (e) {}

          updateUser(user);
          renderDrawerCardsTab(user);
          if (typeof window.syncAllCardsWithUsersDatabase === 'function') window.syncAllCardsWithUsersDatabase();
          if (typeof window.renderCardsTable === 'function') window.renderCardsTable();
          showToast(`${tier} issued to ${user.fullName}.`, 'success', 'Card Issued');
        }
      });
    };
  }

  // Edit Card (NO PROMPT)
  container.querySelectorAll('.btn-edit-card-full').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-crd-idx'), 10);
      const card = user.cards[idx];
      showAdminFormModal({
        title: 'Edit Card Configuration',
        subtitle: `Card: ${card.cardNumber || card.cardMasked} (${card.type || card.cardType})`,
        submitText: 'Save Card Settings',
        fields: [
          {
            id: 'tier',
            type: 'select',
            label: 'Card Tier Model *',
            value: card.type || card.cardType || 'Visa Infinite Global Elite Black Metal',
            options: [
              { value: 'Visa Standard Debit', label: 'Visa Standard Debit ($100.00)' },
              { value: 'Mastercard Standard Debit', label: 'Mastercard Standard Debit ($100.00)' },
              { value: 'Visa Gold Preferred', label: 'Visa Gold Preferred ($250.00)' },
              { value: 'Mastercard Gold Preferred', label: 'Mastercard Gold Preferred ($250.00)' },
              { value: 'Visa Platinum Premier', label: 'Visa Platinum Premier ($500.00)' },
              { value: 'Mastercard Platinum Premier', label: 'Mastercard Platinum Premier ($500.00)' },
              { value: 'Visa Corporate Executive', label: 'Visa Corporate Executive ($750.00)' },
              { value: 'Mastercard Corporate Executive', label: 'Mastercard Corporate Executive ($750.00)' },
              { value: 'Visa Infinite Global Elite Black Metal', label: 'Visa Infinite Global Elite Black Metal ($1,000.00)' },
              { value: 'Mastercard World Global Elite Black Metal', label: 'Mastercard World Global Elite Black Metal ($1,000.00)' }
            ]
          },
          { id: 'holder', label: 'Cardholder Name *', value: card.cardHolder || card.cardholder_name || user.fullName.toUpperCase(), required: true },
          { id: 'pan', label: 'Card Number *', fontMono: true, value: card.cardNumber || card.card_number || '', required: true },
          { id: 'exp', label: 'Expiry Date (mm/yy) *', value: card.expiry || '10/30', required: true },
          { id: 'pin', label: '4-Digit PIN *', value: card.pin || '8869', required: true },
          { id: 'atmLimit', type: 'number', label: 'Daily ATM Withdrawal Limit ($) *', value: String(card.dailyAtmLimit || 10000), required: true },
          { id: 'posLimit', type: 'number', label: 'Daily POS / E-Commerce Limit ($) *', value: String(card.onlineLimit || card.dailyPosLimit || 50000), required: true },
          {
            id: 'st',
            type: 'select',
            label: 'Card Status *',
            value: card.status || 'active',
            options: [
              { value: 'active', label: 'Active (Unlocked)' },
              { value: 'locked', label: 'Locked / Frozen' },
              { value: 'pending', label: 'Pending Approval' }
            ]
          }
        ],
        onSubmit: ({ tier, holder, pan, exp, pin, atmLimit, posLimit, st }) => {
          card.type = tier;
          card.cardType = tier;
          card.cardHolder = holder.toUpperCase();
          card.cardholder_name = holder.toUpperCase();
          card.cardNumber = pan;
          card.expiry = exp;
          card.pin = pin;
          card.dailyAtmLimit = parseFloat(atmLimit) || 10000;
          card.dailyPosLimit = parseFloat(posLimit) || 50000;
          card.onlineLimit = parseFloat(posLimit) || 50000;
          card.status = st;
          updateUser(user);
          renderDrawerCardsTab(user);
          if (typeof window.syncAllCardsWithUsersDatabase === 'function') window.syncAllCardsWithUsersDatabase();
          if (typeof window.renderCardsTable === 'function') window.renderCardsTable();
          showToast('Card settings updated successfully.', 'success', 'Card Saved');
        }
      });
    };
  });

  // Toggle lock
  container.querySelectorAll('.btn-toggle-card-lock').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-crd-idx'), 10);
      const card = user.cards[idx];
      card.status = card.status === 'active' ? 'locked' : 'active';
      updateUser(user);
      renderDrawerCardsTab(user);
      if (typeof window.syncAllCardsWithUsersDatabase === 'function') window.syncAllCardsWithUsersDatabase();
      if (typeof window.renderCardsTable === 'function') window.renderCardsTable();
      showToast(`Card ${card.cardNumber} status is now ${card.status.toUpperCase()}.`, 'info', 'Card Status Updated');
    };
  });

  // Delete Card (NO PROMPT)
  container.querySelectorAll('.btn-delete-card').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-crd-idx'), 10);
      const card = user.cards[idx];
      showAdminFormModal({
        title: 'Delete ATM Card',
        subtitle: `Are you sure you want to permanently remove card ${card.cardNumber || card.type}? This action cannot be undone.`,
        submitText: 'Confirm Delete Card',
        fields: [],
        onSubmit: () => {
          const removedCardId = card.id;
          const removedCardNum = (card.cardNumber || card.card_number || '').replace(/\s+/g, '');
          user.cards.splice(idx, 1);

          // Also remove from admin cards DB
          try {
            const rawAdminCards = localStorage.getItem('wb_credit_union_admin_cards_db');
            if (rawAdminCards) {
              const aCards = JSON.parse(rawAdminCards);
              if (Array.isArray(aCards)) {
                const rem = aCards.filter((c) => c.id !== removedCardId && (c.cardNumber || '').replace(/\s+/g, '') !== removedCardNum);
                localStorage.setItem('wb_credit_union_admin_cards_db', JSON.stringify(rem));
              }
            }
          } catch (e) {}

          // Also remove from atm cards DB
          try {
            const rawAtm = localStorage.getItem('wb_credit_union_atm_cards');
            if (rawAtm) {
              const uCards = JSON.parse(rawAtm);
              if (Array.isArray(uCards)) {
                const rem = uCards.filter((c) => c.id !== removedCardId && (c.cardNumber || c.card_number || '').replace(/\s+/g, '') !== removedCardNum);
                localStorage.setItem('wb_credit_union_atm_cards', JSON.stringify(rem));
              }
            }
          } catch (e) {}

          updateUser(user);
          renderDrawerCardsTab(user);
          if (typeof window.syncAllCardsWithUsersDatabase === 'function') window.syncAllCardsWithUsersDatabase();
          if (typeof window.renderCardsTable === 'function') window.renderCardsTable();
          showToast('Card deleted from member portfolio.', 'warning', 'Card Deleted');
        }
      });
    };
  });
}

/** TAB 5: Crypto Wallets */
function renderDrawerCryptoTab(user) {
  const container = document.getElementById('drawer-tab-crypto');
  if (!container) return;

  const wallets = user.cryptoWallets || [];

  container.innerHTML = `
    <div class="d-flex justify-between items-center mb-3">
      <h4 class="text-white text-sm font-bold m-0">Digital Asset &amp; Crypto Custody (${wallets.length})</h4>
      <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" id="btnDrawerAddWallet">
        + Add New Wallet
      </button>
    </div>

    ${wallets.length === 0 ? `
      <div class="text-center p-4 text-muted text-xs">No crypto custody accounts initialized.</div>
    ` : wallets.map((w, idx) => `
      <div class="admin-user-acct-box mb-3">
        <div class="d-flex justify-between items-center mb-2">
          <div class="d-flex items-center gap-2">
            <span style="font-size:1.5rem;">${w.currency === 'BTC' ? '₿' : (w.currency === 'ETH' ? 'Ξ' : (w.currency === 'SOL' ? '◎' : '₮'))}</span>
            <div>
              <div class="font-bold text-white">${w.currency} Custody Vault</div>
              <div class="font-mono text-xs text-muted">${escapeHtml(w.address || '0x...')}</div>
            </div>
          </div>
          <span class="font-mono text-md font-bold text-white">
            ${(w.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${w.currency}
          </span>
        </div>

        <div class="d-flex items-center gap-2 flex-wrap">
          <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-edit-wallet" data-w-idx="${idx}">
            ✏️ Edit Wallet
          </button>
          <button type="button" class="admin-btn admin-btn-danger admin-btn-sm btn-delete-wallet" data-w-idx="${idx}">
            🗑️ Delete Wallet
          </button>
        </div>
      </div>
    `).join('')}
  `;

  // Add Wallet (NO PROMPT)
  const addWalletBtn = document.getElementById('btnDrawerAddWallet');
  if (addWalletBtn) {
    addWalletBtn.onclick = () => {
      showAdminFormModal({
        title: 'Add Digital Custody Wallet',
        subtitle: `Provision crypto asset vault for ${user.fullName}`,
        submitText: 'Add Custodial Wallet',
        fields: [
          {
            id: 'sym',
            type: 'select',
            label: 'Digital Asset *',
            value: 'BTC',
            options: [
              { value: 'BTC', label: 'Bitcoin (BTC)' },
              { value: 'ETH', label: 'Ethereum (ETH)' },
              { value: 'USDT', label: 'Tether USD (USDT)' },
              { value: 'USDC', label: 'USD Coin (USDC)' },
              { value: 'SOL', label: 'Solana (SOL)' },
              { value: 'BNB', label: 'Binance Coin (BNB)' },
              { value: 'XRP', label: 'Ripple (XRP)' }
            ]
          },
          { id: 'bal', type: 'number', step: '0.0001', label: 'Initial Asset Balance *', value: '1.00', required: true },
          { id: 'addr', label: 'Cold Storage Multi-Sig Address *', fontMono: true, value: 'bc1q' + Math.random().toString(36).slice(2, 14), required: true }
        ],
        onSubmit: ({ sym, bal, addr }) => {
          if (!user.cryptoWallets) user.cryptoWallets = [];
          const symUpper = sym.toUpperCase();
          const metaMap = {
            BTC: { name: 'Bitcoin', network: 'Bitcoin Mainnet (SegWit)', priceUSD: 64516.12, change24h: 3.42, gradClass: 'btc-grad', color: '#f7931a' },
            ETH: { name: 'Ethereum', network: 'ERC-20 Mainnet', priceUSD: 3389.83, change24h: 4.85, gradClass: 'eth-grad', color: '#627eea' },
            USDT: { name: 'Tether USD', network: 'TRC-20 / ERC-20', priceUSD: 1.00, change24h: 0.02, gradClass: 'usdt-grad', color: '#26a17b' },
            USDC: { name: 'USD Coin', network: 'ERC-20 / Arbitrum', priceUSD: 1.00, change24h: 0.01, gradClass: 'usdc-grad', color: '#2775ca' },
            SOL: { name: 'Solana', network: 'Solana SPL', priceUSD: 145.98, change24h: -1.25, gradClass: 'sol-grad', color: '#9945ff' },
            BNB: { name: 'BNB Chain', network: 'BEP-20', priceUSD: 590.20, change24h: 0.85, gradClass: 'bnb-grad', color: '#f3ba2f' },
            XRP: { name: 'Ripple', network: 'XRPL Ledger', priceUSD: 0.58, change24h: 1.45, gradClass: 'xrp-grad', color: '#23292f' }
          };
          const meta = metaMap[symUpper] || { name: `${symUpper} Vault`, network: `${symUpper} Network`, priceUSD: 1.00, change24h: 0.00, gradClass: 'btc-grad', color: '#3b82f6' };

          user.cryptoWallets.push({
            id: `cw-${symUpper.toLowerCase()}-${Date.now()}`,
            symbol: symUpper,
            currency: symUpper,
            name: `${meta.name} Vault`,
            network: meta.network,
            priceUSD: meta.priceUSD,
            change24h: meta.change24h,
            gradClass: meta.gradClass,
            color: meta.color,
            balance: parseFloat(bal) || 0,
            address: addr,
            status: 'active',
            isActive: true,
            createdAt: new Date().toISOString()
          });
          updateUser(user);
          renderDrawerCryptoTab(user);
          showToast(`${symUpper} custody wallet added to member portfolio.`, 'success', 'Wallet Added');
        }
      });
    };
  }

  // Edit Wallet (NO PROMPT)
  container.querySelectorAll('.btn-edit-wallet').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-w-idx'), 10);
      const wallet = wallets[idx];
      showAdminFormModal({
        title: `Edit ${wallet.currency || wallet.symbol} Custody Wallet`,
        subtitle: `Address: ${wallet.address}`,
        submitText: 'Save Wallet Changes',
        fields: [
          {
            id: 'sym',
            type: 'select',
            label: 'Digital Asset *',
            value: wallet.currency || wallet.symbol,
            options: [
              { value: 'BTC', label: 'Bitcoin (BTC)' },
              { value: 'ETH', label: 'Ethereum (ETH)' },
              { value: 'USDT', label: 'Tether USD (USDT)' },
              { value: 'USDC', label: 'USD Coin (USDC)' },
              { value: 'SOL', label: 'Solana (SOL)' },
              { value: 'BNB', label: 'Binance Coin (BNB)' },
              { value: 'XRP', label: 'Ripple (XRP)' }
            ]
          },
          { id: 'bal', type: 'number', step: '0.0001', label: 'Asset Balance *', value: (wallet.balance !== undefined ? wallet.balance : 0).toString(), required: true },
          { id: 'addr', label: 'Cold Storage Address *', fontMono: true, value: wallet.address || '', required: true }
        ],
        onSubmit: ({ sym, bal, addr }) => {
          const symUpper = sym.toUpperCase();
          wallet.symbol = symUpper;
          wallet.currency = symUpper;
          wallet.balance = parseFloat(bal) || 0;
          wallet.address = addr;
          if (!wallet.id) wallet.id = `cw-${symUpper.toLowerCase()}-${Date.now()}`;
          if (!wallet.name) wallet.name = `${symUpper} Vault`;
          if (!wallet.network) wallet.network = `${symUpper} Mainnet`;
          if (wallet.priceUSD === undefined) wallet.priceUSD = symUpper === 'BTC' ? 64516.12 : (symUpper === 'ETH' ? 3389.83 : 1.00);
          if (wallet.change24h === undefined) wallet.change24h = 0.00;
          updateUser(user);
          renderDrawerCryptoTab(user);
          showToast(`${symUpper} wallet updated.`, 'success', 'Wallet Saved');
        }
      });
    };
  });

  // Delete Wallet (NO PROMPT)
  container.querySelectorAll('.btn-delete-wallet').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-w-idx'), 10);
      const wallet = wallets[idx];
      showAdminFormModal({
        title: 'Delete Custody Wallet',
        subtitle: `Are you sure you want to delete ${wallet.currency} wallet (${wallet.address})? This action cannot be undone.`,
        submitText: 'Confirm Delete Wallet',
        fields: [],
        onSubmit: () => {
          user.cryptoWallets.splice(idx, 1);
          updateUser(user);
          renderDrawerCryptoTab(user);
          showToast(`${wallet.currency} wallet deleted.`, 'warning', 'Wallet Removed');
        }
      });
    };
  });
}

/** TAB 6: Wire Transfer Codes (CRITICAL SECTION) */
function renderDrawerWireCodesTab(user) {
  const container = document.getElementById('drawer-tab-wire-codes');
  if (!container) return;

  const codes = user.wireTransferCodes || {};
  const codeDefinitions = [
    { key: 'COT', name: 'Cost of Transfer (COT) Code', desc: 'Required by Swiss SWIFT clearing system for international wires' },
    { key: 'TAX', name: 'Tax Clearance (TAX) Certificate Code', desc: 'Ensures tax exemption compliance on cross-border wire outflows' },
    { key: 'IMF', name: 'International Monetary Fund (IMF) Code', desc: 'Dual IMF regulatory verification token' },
    { key: 'AML', name: 'Anti-Money Laundering (AML) Key', desc: 'Clears OFAC/AML automated risk threshold hold' },
    { key: 'PAP', name: 'Proof of Anti-Piracy / Swiss Clearance (PAP) Code', desc: 'Authenticates genuine legal source of institutional capital' }
  ];

  container.innerHTML = `
    <div class="mb-4">
      <h4 class="text-white text-sm font-bold mb-1">Assigned Wire Transfer Clearance Codes</h4>
      <p class="text-xs text-muted">
        When <strong>${escapeHtml(user.fullName)}</strong> initiates high-value wire transfers, the digital banking system will require them to input these exact clearance codes to clear each clearance step.
      </p>
    </div>

    ${codeDefinitions.map((def) => {
      const item = codes[def.key] || { code: '', active: false, notes: '' };
      const hasCode = Boolean(item.code);

      return `
        <div class="admin-wire-code-card">
          <div class="d-flex justify-between items-center mb-2">
            <div>
              <div class="font-bold text-white text-sm">${def.name}</div>
              <div class="text-xs text-muted">${def.desc}</div>
            </div>
            <span class="action-chip ${item.active ? 'action-chip-approve' : 'action-chip-flag'}">
              ${item.active ? 'ACTIVE & ENFORCED' : 'DISABLED'}
            </span>
          </div>

          <div class="admin-wire-code-box mb-3">
            <span>${hasCode ? escapeHtml(item.code) : '<span class="admin-wire-code-empty">No code assigned yet</span>'}</span>
            ${hasCode ? `<span class="text-xs text-muted" style="letter-spacing:normal;">Enforced</span>` : ''}
          </div>

          <div class="d-flex items-center justify-between flex-wrap gap-2">
            <div class="d-flex items-center gap-2">
              <button type="button" class="admin-btn admin-btn-primary admin-btn-sm btn-set-wire-code" data-code-key="${def.key}">
                ${hasCode ? 'Change Code' : 'Set Code'}
              </button>
              ${hasCode ? `
                <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-toggle-wire-code" data-code-key="${def.key}">
                  ${item.active ? 'Disable' : 'Enable'}
                </button>
                <button type="button" class="admin-btn admin-btn-danger admin-btn-sm btn-remove-wire-code" data-code-key="${def.key}">
                  Remove
                </button>
              ` : `
                <button type="button" class="admin-btn admin-btn-outline admin-btn-sm btn-gen-wire-code" data-code-key="${def.key}">
                  ⚡ Auto-Generate
                </button>
              `}
            </div>
            <div class="text-xs text-muted font-italic">
              ${item.notes ? `Note: ${escapeHtml(item.notes)}` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;

  // Bind Set Code (NO PROMPT)
  container.querySelectorAll('.btn-set-wire-code').forEach((btn) => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-code-key');
      const def = codeDefinitions.find(d => d.key === key) || { name: key };
      const cur = user.wireTransferCodes?.[key]?.code || '';

      showAdminFormModal({
        title: `Configure ${def.name}`,
        subtitle: `Clearance token for ${user.fullName}`,
        submitText: 'Save Clearance Code',
        fields: [
          { id: 'code', label: 'Regulatory Clearance Code *', fontMono: true, value: cur || `${key}-${Math.floor(10000 + Math.random() * 90000)}`, required: true },
          {
            id: 'active',
            type: 'select',
            label: 'Enforcement Status *',
            value: user.wireTransferCodes?.[key]?.active !== false ? 'true' : 'false',
            options: [
              { value: 'true', label: 'Active & Enforced on Member Transfers' },
              { value: 'false', label: 'Disabled / Bypassed' }
            ]
          },
          { id: 'notes', label: 'Compliance Audit Notes', value: user.wireTransferCodes?.[key]?.notes || `${def.name} authorized for Swiss SWIFT operations.` }
        ],
        onSubmit: ({ code, active, notes }) => {
          if (!user.wireTransferCodes) user.wireTransferCodes = {};
          user.wireTransferCodes[key] = {
            code: code.toUpperCase(),
            active: active === 'true',
            notes: notes || '',
          };

          user.activityLog.unshift({
            date: new Date().toISOString().replace('T', ' ').slice(0, 19),
            action: `Assigned ${key} Wire Code: ${code.toUpperCase()}`,
            ip: 'Admin Console',
            officer: 'Chief Treasury Auditor'
          });

          updateUser(user);
          renderDrawerWireCodesTab(user);
          showToast(`${key} code updated to "${code.toUpperCase()}".`, 'success', 'Code Assigned');
        }
      });
    };
  });

  // Bind Auto Generate
  container.querySelectorAll('.btn-gen-wire-code').forEach((btn) => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-code-key');
      const randomCode = `${key}-${Math.floor(10000 + Math.random() * 90000)}`;

      if (!user.wireTransferCodes) user.wireTransferCodes = {};
      user.wireTransferCodes[key] = {
        code: randomCode,
        active: true,
        notes: 'Auto-generated high security clearance key',
      };

      user.activityLog.unshift({
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        action: `Auto-generated ${key} Wire Code: ${randomCode}`,
        ip: 'Admin Console',
        officer: 'Chief Treasury Auditor'
      });

      updateUser(user);
      renderDrawerWireCodesTab(user);
      showToast(`Generated ${key} Code: ${randomCode}`, 'success', 'Code Generated');
    };
  });

  // Bind Toggle
  container.querySelectorAll('.btn-toggle-wire-code').forEach((btn) => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-code-key');
      const item = user.wireTransferCodes[key];
      if (item) {
        item.active = !item.active;
        updateUser(user);
        renderDrawerWireCodesTab(user);
        showToast(`${key} code is now ${item.active ? 'ACTIVE' : 'DISABLED'}.`, 'info', 'Status Changed');
      }
    };
  });

  // Bind Remove (NO PROMPT)
  container.querySelectorAll('.btn-remove-wire-code').forEach((btn) => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-code-key');
      showAdminFormModal({
        title: `Remove ${key} Clearance Code`,
        subtitle: `Remove code for ${user.fullName}? The member will not be prompted for this code during transfers.`,
        submitText: 'Confirm Remove Code',
        fields: [],
        onSubmit: () => {
          if (user.wireTransferCodes[key]) {
            user.wireTransferCodes[key] = { code: '', active: false, notes: '' };
            updateUser(user);
            renderDrawerWireCodesTab(user);
            showToast(`${key} code removed.`, 'warning', 'Code Cleared');
          }
        }
      });
    };
  });
}

/** TAB 7: Notifications */
function renderDrawerNotificationsTab(user) {
  const container = document.getElementById('drawer-tab-notifications');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-user-acct-box mb-4">
      <h4 class="text-white text-sm font-bold mb-2">Send Direct Notice to ${escapeHtml(user.fullName)}</h4>
      <p class="text-xs text-muted mb-3">Dispatches an instant in-app notification and email to ${user.email}.</p>

      <form id="drawerSendNotifForm">
        <div class="admin-form-group">
          <label class="admin-form-label">Notification Title</label>
          <input type="text" id="drawerNotifTitle" class="admin-form-control" placeholder="e.g. Wire Transfer COT Code Requirement" required />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">Message Content</label>
          <textarea id="drawerNotifMsg" class="admin-form-control" rows="3" placeholder="Type specific member instructions..." required></textarea>
        </div>

        <div class="d-grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="admin-form-label">Notification Type</label>
            <select id="drawerNotifType" class="admin-form-control">
              <option value="security_alert">Security Alert / Code</option>
              <option value="transaction_alert">Transaction Update</option>
              <option value="account_update">Account Clearance</option>
              <option value="system_update">General Notice</option>
            </select>
          </div>
          <div>
            <label class="admin-form-label">Delivery Channel</label>
            <select id="drawerNotifChannel" class="admin-form-control">
              <option value="both">In-App + Email (Priority)</option>
              <option value="in_app">In-App Banner Only</option>
            </select>
          </div>
        </div>

        <button type="submit" class="admin-btn admin-btn-amber">
          📤 Send Direct Notification
        </button>
      </form>
    </div>
  `;

  const form = document.getElementById('drawerSendNotifForm');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const title = document.getElementById('drawerNotifTitle')?.value;
      const msg = document.getElementById('drawerNotifMsg')?.value;
      const type = document.getElementById('drawerNotifType')?.value;

      try {
        createNotification({
          title,
          message: msg,
          type,
          channel: 'in_app',
        });
      } catch {
        // Fallback
      }

      user.activityLog.unshift({
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        action: `Sent notice to member: "${title}"`,
        ip: 'Admin Console',
        officer: 'Chief Treasury Auditor'
      });

      updateUser(user);
      form.reset();
      showToast(`Notification sent to ${user.fullName}.`, 'success', 'Notice Dispatched');
    };
  }
}

/** TAB 8: Activity Log */
function renderDrawerActivityTab(user) {
  const container = document.getElementById('drawer-tab-activity');
  if (!container) return;

  const logs = user.activityLog || [];

  container.innerHTML = `
    <h4 class="text-white text-sm font-bold mb-3">Audit Trail & Session Telemetry (${logs.length})</h4>

    ${logs.length === 0 ? `
      <div class="text-center p-4 text-muted text-xs">No audit events logged yet.</div>
    ` : `
      <div class="d-flex flex-column gap-2">
        ${logs.map((log) => `
          <div class="p-3" style="background:#090d16; border:1px solid #334155; border-radius:8px;">
            <div class="d-flex justify-between items-center mb-1">
              <span class="font-mono text-xs text-white font-bold">${log.action}</span>
              <span class="text-xs text-muted">${log.date}</span>
            </div>
            <div class="text-xs text-muted">
              Officer/Source: <span style="color:#38bdf8;">${log.officer || 'SYSTEM'}</span> • IP: ${log.ip || 'Zurich Hub'}
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

function setupDrawerActionButtons() {
  // Helpers
}

/* ----------------------------------------------------------------------------
 * 10. CREATE NEW USER MODAL HANDLER
 * ---------------------------------------------------------------------------- */
function setupCreateUserModal() {
  const form = document.getElementById('adminFullCreateUserForm');
  const modal = document.getElementById('createUserFullModal');

  // Populate Nationality Select with ALL world countries
  const natSelect = document.getElementById('adminNewUserNationality');
  if (natSelect) {
    populateWorldCountriesDropdown(natSelect, 'Afghanistan');
  }

  // Auto-randomize account numbers and clearance codes without pre-filling fake names
  const randomizeCreateUserModalFields = () => {
    const acctTypeInput = document.getElementById('adminNewUserAcctType');
    const pwdInput = document.getElementById('adminNewUserPassword');
    const pwdConfirmInput = document.getElementById('adminNewUserConfirmPassword');
    const acctNumInput = document.getElementById('adminNewUserAccountNum');
    const cotInput = document.getElementById('adminNewUserCotCode');
    const imfInput = document.getElementById('adminNewUserImfCode');
    const taxInput = document.getElementById('adminNewUserTaxCode');
    const pinInput = document.getElementById('adminNewUserTxPin');

    if (acctTypeInput) acctTypeInput.value = 'Checking';
    
    const generatedPwd = 'MemberPass' + Math.floor(100 + Math.random() * 900) + '!';
    if (pwdInput) pwdInput.value = generatedPwd;
    if (pwdConfirmInput) pwdConfirmInput.value = generatedPwd;
    
    if (acctNumInput) acctNumInput.value = generateRandomAccountNumber();
    if (cotInput) cotInput.value = generateRandomCotCode();
    if (imfInput) imfInput.value = generateRandomImfCode();
    if (taxInput) taxInput.value = generateRandomTaxCode();
    if (pinInput) pinInput.value = generateRandomPin();

    // Also randomize username if it was auto-generated before
    const unInput = document.getElementById('adminNewUserUsername');
    if (unInput) {
      const base = (document.getElementById('adminNewUserFirstName')?.value || 'user').toLowerCase().replace(/[^a-z]/g, '');
      unInput.value = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
      unInput.setAttribute('data-auto', 'true');
    }
  };

  // Expose to window for global access
  if (typeof window !== 'undefined') {
    window.wbRandomizeCreateUserModalFields = randomizeCreateUserModalFields;
  }

  // Pre-seed with fresh random codes immediately
  randomizeCreateUserModalFields();

  // Randomize button listeners
  const genAcctBtn = document.getElementById('btnAdminGenAccountNum');
  if (genAcctBtn) {
    genAcctBtn.addEventListener('click', () => {
      const acctNumInput = document.getElementById('adminNewUserAccountNum');
      if (acctNumInput) {
        acctNumInput.value = generateRandomAccountNumber();
        showToast('Generated unique random Account Number', 'info', 'Account Randomized');
      }
    });
  }

  const genAllCodesBtn = document.getElementById('btnAdminGenAllCodes');
  if (genAllCodesBtn) {
    genAllCodesBtn.addEventListener('click', () => {
      randomizeCreateUserModalFields();
      showToast('Re-generated all clearance codes & security tokens', 'info', 'Codes Randomized');
    });
  }

  // Open Full Create User Modal triggers
  const openFullModal = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    randomizeCreateUserModalFields();
    const targetModal = document.getElementById('createUserFullModal') || modal;
    if (targetModal) {
      targetModal.classList.add('show');
      targetModal.style.display = 'flex';
      const fnInput = document.getElementById('adminNewUserFirstName');
      if (fnInput) setTimeout(() => fnInput.focus(), 80);
    }
  };

  window.openCreateUserModal = openFullModal;
  window.wbRandomizeCreateUserModalFields = randomizeCreateUserModalFields;

  const fullBtn = document.getElementById('btnOpenFullCreateUserModal');
  if (fullBtn) fullBtn.addEventListener('click', openFullModal);

  const quickBtn = document.getElementById('btnOpenCreateUserModal');
  if (quickBtn) quickBtn.addEventListener('click', openFullModal);

  document.querySelectorAll('[data-open-modal="createUserFullModal"], [data-open-modal="createUserModal"]').forEach((el) => {
    el.addEventListener('click', openFullModal);
  });

  // Handle Photo File Upload & URL input (using document delegation to ensure 100% reliability)
  if (!window._wbPhotoUploadDelegated) {
    window._wbPhotoUploadDelegated = true;
    document.addEventListener('change', (e) => {
      if (!e.target) return;
      const targetId = e.target.id;
      
      // Handle Profile Photo Uploads (Create & Edit)
      if (targetId === 'adminNewUserProfilePhotoFile' || targetId === 'editUserProfilePhotoFile') {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const dataUrl = evt.target?.result;
            const targetUrlInput = (targetId === 'editUserProfilePhotoFile') ? 'editUserProfilePhoto' : 'adminNewUserProfilePhotoUrl';
            const targetPreview = (targetId === 'editUserProfilePhotoFile') ? 'editUserPhotoPreview' : 'adminNewUserPhotoPreview';
            
            const urlEl = document.getElementById(targetUrlInput);
            const previewEl = document.getElementById(targetPreview);
            if (urlEl) urlEl.value = dataUrl;
            if (previewEl) {
              previewEl.innerHTML = `<img src="${dataUrl}" alt="Profile Photo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
            }
          };
          reader.readAsDataURL(file);
        }
      }

      // Handle Passport / ID Uploads (Create & Edit)
      if (targetId === 'adminNewUserPassportFile' || targetId === 'editUserPassportFile') {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const dataUrl = evt.target?.result;
            const targetUrlInput = (targetId === 'editUserPassportFile') ? 'editUserPassport' : 'adminNewUserPassportUrl';
            const targetPreview = (targetId === 'editUserPassportFile') ? 'editUserPassportPreview' : 'adminNewUserPassportPreview';
            
            const urlEl = document.getElementById(targetUrlInput);
            const previewEl = document.getElementById(targetPreview);
            if (urlEl) urlEl.value = dataUrl;
            if (previewEl) {
              previewEl.innerHTML = `<img src="${dataUrl}" alt="Passport" style="width: 100%; height: 100%; border-radius: 8px; object-fit: cover;" />`;
            }
            showToast('Biometric ID document captured.', 'success', 'ID Uploaded');
          };
          reader.readAsDataURL(file);
        }
      }
    });
  }

  const photoUrlInput = document.getElementById('adminNewUserProfilePhotoUrl');
  const photoPreview = document.getElementById('adminNewUserPhotoPreview');
  const clearPhotoBtn = document.getElementById('btnClearAdminNewUserPhoto');

  if (photoUrlInput) {
    photoUrlInput.addEventListener('input', () => {
      const url = photoUrlInput.value.trim();
      if (photoPreview) {
        if (url) {
          photoPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Profile Photo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'color:#f87171;font-size:0.65rem;\\'>Invalid</span>';" />`;
        } else {
          photoPreview.textContent = 'No photo';
        }
      }
    });
  }

  if (clearPhotoBtn) {
    clearPhotoBtn.addEventListener('click', () => {
      const photoFile = document.getElementById('adminNewUserProfilePhotoFile');
      if (photoFile) photoFile.value = '';
      if (photoUrlInput) photoUrlInput.value = '';
      if (photoPreview) photoPreview.innerHTML = 'No photo';
    });
  }

  const clearPassportBtn = document.getElementById('btnClearAdminNewUserPassport');
  const passportUrlInput = document.getElementById('adminNewUserPassportUrl');
  const passportPreview = document.getElementById('adminNewUserPassportPreview');

  if (clearPassportBtn) {
    clearPassportBtn.addEventListener('click', () => {
      const passFile = document.getElementById('adminNewUserPassportFile');
      if (passFile) passFile.value = '';
      if (passportUrlInput) passportUrlInput.value = '';
      if (passportPreview) passportPreview.innerHTML = 'No ID';
    });
  }

  if (passportUrlInput) {
    passportUrlInput.addEventListener('input', () => {
      const url = passportUrlInput.value.trim();
      if (passportPreview) {
        if (url) {
          passportPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Passport" style="width: 100%; height: 100%; border-radius: 8px; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'color:#f87171;font-size:0.65rem;\\'>Invalid</span>';" />`;
        } else {
          passportPreview.innerHTML = 'No ID';
        }
      }
    });
  }

  // Handle New User Password Show/Hide & Generator
  const newPwdInput = document.getElementById('adminNewUserPassword');
  const newConfirmPwdInput = document.getElementById('adminNewUserConfirmPassword');
  const toggleNewPwdBtn = document.getElementById('btnToggleAdminNewUserPwd');
  const genNewPwdBtn = document.getElementById('btnAdminNewUserGenPwd');

  if (toggleNewPwdBtn && newPwdInput) {
    toggleNewPwdBtn.addEventListener('click', () => {
      const isPwd = newPwdInput.type === 'password';
      newPwdInput.type = isPwd ? 'text' : 'password';
      if (newConfirmPwdInput) newConfirmPwdInput.type = isPwd ? 'text' : 'password';
      toggleNewPwdBtn.textContent = isPwd ? '🙈 Hide' : '👁️ Show';
    });
  }

  if (genNewPwdBtn && newPwdInput) {
    genNewPwdBtn.addEventListener('click', () => {
      const prefixList = ['SwissVault', 'Sovereign', 'Alpine', 'Zurich', 'CreditUnion', 'Premier'];
      const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
      const num = Math.floor(1000 + Math.random() * 9000);
      const symbols = ['!', '@', '#', '$', '%', '&', '*'];
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      const newGeneratedPwd = `${prefix}#${num}${sym}`;
      newPwdInput.value = newGeneratedPwd;
      if (newConfirmPwdInput) newConfirmPwdInput.value = newGeneratedPwd;
      newPwdInput.type = 'text';
      if (newConfirmPwdInput) newConfirmPwdInput.type = 'text';
      if (toggleNewPwdBtn) toggleNewPwdBtn.textContent = '🙈 Hide';
      showToast(`Generated secure password: ${newGeneratedPwd}`, 'success', 'Password Ready');
    });
  }

  // Auto-suggest username as user types name or email
  const fnInput = document.getElementById('adminNewUserFirstName');
  const lnInput = document.getElementById('adminNewUserLastName');
  const emailInput = document.getElementById('adminNewUserEmail');
  const unInput = document.getElementById('adminNewUserUsername');

  function updateSuggestedUsername(force = false) {
    if (!unInput) return;
    if (force || !unInput.value || unInput.getAttribute('data-auto') === 'true' || unInput.value === 'mbrymo88') {
      const fn = (fnInput?.value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const ln = (lnInput?.value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const em = (emailInput?.value || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const base = (fn + ln) || em || 'mbrymo';
      unInput.value = `${base}${Math.floor(10 + Math.random() * 90)}`;
      unInput.setAttribute('data-auto', 'true');
    }
  }

  window.wbGenUsername = () => updateSuggestedUsername(true);

  const genUsernameBtn = document.getElementById('btnAdminGenUsername');
  if (genUsernameBtn) {
    genUsernameBtn.addEventListener('click', () => {
      updateSuggestedUsername(true);
      showToast('Generated new random Username', 'info', 'Username Randomized');
    });
  }

  if (fnInput) fnInput.addEventListener('input', () => updateSuggestedUsername(false));
  if (lnInput) lnInput.addEventListener('input', () => updateSuggestedUsername(false));
  if (emailInput) emailInput.addEventListener('input', () => updateSuggestedUsername(false));
  if (unInput) {
    unInput.addEventListener('input', () => { unInput.removeAttribute('data-auto'); });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fn = document.getElementById('adminNewUserFirstName')?.value.trim() || '';
      const mn = document.getElementById('adminNewUserMiddleName')?.value.trim() || '';
      const ln = document.getElementById('adminNewUserLastName')?.value.trim() || '';
      const fullName = [fn, mn, ln].filter(Boolean).join(' ') || 'New Banking Member';

      const username = document.getElementById('adminNewUserUsername')?.value.trim() || `user_${Math.floor(1000 + Math.random() * 9000)}`;
      const email = document.getElementById('adminNewUserEmail')?.value.trim() || `member_${Date.now()}@wbcu.net`;
      const phone = document.getElementById('adminNewUserPhone')?.value.trim() || '+41 44 915 0000';
      const dob = document.getElementById('adminNewUserDob')?.value.trim() || '01/01/1985';
      const occupation = document.getElementById('adminNewUserOccupation')?.value.trim() || 'Executive Director';
      const address = document.getElementById('adminNewUserAddress')?.value.trim() || 'Zurich, Switzerland';
      const nationality = document.getElementById('adminNewUserNationality')?.value || 'Switzerland';
      const acctType = document.getElementById('adminNewUserAcctType')?.value || 'Checking';

      // Codes and numbers - preserve entered values or generate fresh unique random values
      let acctNum = document.getElementById('adminNewUserAccountNum')?.value.trim();
      if (!acctNum) {
        acctNum = generateRandomAccountNumber();
      }
      let cotCode = document.getElementById('adminNewUserCotCode')?.value.trim();
      if (!cotCode) {
        cotCode = generateRandomCotCode();
      }
      let imfCode = document.getElementById('adminNewUserImfCode')?.value.trim();
      if (!imfCode) {
        imfCode = generateRandomImfCode();
      }
      let taxCode = document.getElementById('adminNewUserTaxCode')?.value.trim();
      if (!taxCode) {
        taxCode = generateRandomTaxCode();
      }
      let txPin = document.getElementById('adminNewUserTxPin')?.value.trim() || generateRandomPin();
      if (!txPin) {
        txPin = generateRandomPin();
      }

      const amlCode = generateRandomAmlCode();
      const papCode = generateRandomPapCode();
      const otpCode = generateRandomOtpCode();

      // Profile photo, Passport & Password
      const profilePhoto = document.getElementById('adminNewUserProfilePhotoUrl')?.value || '';
      const passportPhoto = document.getElementById('adminNewUserPassportUrl')?.value || profilePhoto;
      const password = document.getElementById('adminNewUserPassword')?.value || '';
      const confirmPassword = document.getElementById('adminNewUserConfirmPassword')?.value || '';

      if (password && confirmPassword && password !== confirmPassword) {
        showToast('Password and Confirm Password do not match.', 'error', 'Validation Error');
        return;
      }

      // Initial Account Balance is $0.00 and status is INACTIVE until Admin credits & activates it
      const balance = 0.00;
      const status = 'inactive';
      const kycStatus = 'pending';

      const randomId = `usr-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`;

      // Generate complete official bank ATM Card for new member
      const cardRawNum = '4532' + Math.floor(100000000000 + Math.random() * 900000000000).toString();
      const cardFormatted = cardRawNum.replace(/(.{4})/g, '$1 ').trim();
      const expYear = String((new Date().getFullYear() + 5) % 100).padStart(2, '0');

      const newAtmCard = {
        id: `crd-${Date.now()}`,
        cardNumber: cardFormatted,
        cardMasked: `•••• •••• •••• ${cardRawNum.slice(-4)}`,
        card_number: cardRawNum,
        cardHolder: fullName.toUpperCase(),
        cardholder_name: fullName.toUpperCase(),
        userEmail: email,
        accountNumber: acctNum,
        cardType: 'Sovereign Visa Platinum Debit',
        theme: 'card-theme-corporate',
        expiry: `09/${expYear}`,
        expiry_month: '09',
        expiry_year: expYear,
        cvv: String(Math.floor(100 + Math.random() * 900)),
        pin: txPin,
        status: 'pending_approval',
        is_frozen: false,
        printStatus: 'requested',
        trackingNumber: `CH-POST-${Math.floor(10000000 + Math.random() * 90000000)}-SWISS`,
        shippingAddress: address,
        dailyAtmLimit: 5000,
        dailyPosLimit: 25000,
        monthlyLimit: 50000,
        allowOnline: true,
        allowInternational: true,
        allowContactless: true,
        createdAt: new Date().toISOString(),
        recentTransactions: []
      };

      // Sync new ATM card into Admin Cards Database
      try {
        const adminCardsRaw = localStorage.getItem('wb_credit_union_admin_cards_db');
        const adminCards = adminCardsRaw ? JSON.parse(adminCardsRaw) : [];
        adminCards.unshift(newAtmCard);
        localStorage.setItem('wb_credit_union_admin_cards_db', JSON.stringify(adminCards));
      } catch (e) {
        console.warn('Sync admin cards error:', e);
      }

      const newUser = {
        id: randomId,
        firstName: fn,
        middleName: mn,
        lastName: ln,
        fullName,
        username,
        email,
        phone,
        dob,
        occupation,
        address,
        nationality,
        profilePhoto,
        avatarUrl: profilePhoto,
        passportPhoto,
        passportUrl: passportPhoto,
        kycDocument: passportPhoto,
        password: password || 'MemberPass123!',
        avatar: fullName.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'MB',
        avatarColor: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        status,
        statusReason: 'Pending Administrative Credit & Activation',
        kycStatus,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        pin: txPin,
        transactionPin: txPin,
        accounts: [
          { accountNumber: acctNum, type: acctType || 'Checking', name: 'US Dollar Primary Vault', currency: 'USD', balance: 0.00, available: 0.00, status: 'inactive', routingNumber: '021000089', isPrimary: true },
          { accountNumber: `EUR-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`, type: 'Offshore', name: 'Euro Global Holding Vault', currency: 'EUR', balance: 0.00, available: 0.00, status: 'inactive', routingNumber: '021000089' },
          { accountNumber: `GBP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`, type: 'Offshore', name: 'British Pound Sterling Vault', currency: 'GBP', balance: 0.00, available: 0.00, status: 'inactive', routingNumber: '021000089' },
          { accountNumber: `CHF-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`, type: 'Offshore', name: 'Swiss Franc Reserve Vault', currency: 'CHF', balance: 0.00, available: 0.00, status: 'inactive', routingNumber: '021000089' },
          { accountNumber: `CAD-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`, type: 'Business', name: 'Canadian Dollar Commercial Vault', currency: 'CAD', balance: 0.00, available: 0.00, status: 'inactive', routingNumber: '021000089' },
          { accountNumber: `AUD-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`, type: 'Business', name: 'Australian Dollar Treasury Vault', currency: 'AUD', balance: 0.00, available: 0.00, status: 'inactive', routingNumber: '021000089' },
          { accountNumber: `JPY-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`, type: 'Business', name: 'Japanese Yen Multi-Asset Vault', currency: 'JPY', balance: 0.00, available: 0.00, status: 'inactive', routingNumber: '021000089' },
          { accountNumber: `NGN-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`, type: 'Savings', name: 'Nigerian Naira International Vault', currency: 'NGN', balance: 0.00, available: 0.00, status: 'inactive', routingNumber: '021000089' },
        ],
        wallets: [
          { currency: 'USD', name: 'US Dollar Primary', balance: 0.00, isPrimary: true },
          { currency: 'EUR', name: 'Euro Global Holding', balance: 0.00, isPrimary: false },
          { currency: 'GBP', name: 'British Pound Sterling', balance: 0.00, isPrimary: false },
          { currency: 'CHF', name: 'Swiss Franc Vault Reserve', balance: 0.00, isPrimary: false },
          { currency: 'CAD', name: 'Canadian Dollar Commercial', balance: 0.00, isPrimary: false },
          { currency: 'AUD', name: 'Australian Dollar Treasury', balance: 0.00, isPrimary: false },
          { currency: 'JPY', name: 'Japanese Yen Multi-Asset', balance: 0.00, isPrimary: false },
          { currency: 'NGN', name: 'Nigerian Naira International', balance: 0.00, isPrimary: false },
        ],
        transactions: [],
        grants: [],
        loans: [],
        cards: [newAtmCard],
        cryptoWallets: [
          { id: 'cw-btc', symbol: 'BTC', name: 'Bitcoin Vault', address: 'bc1q' + Math.random().toString(36).slice(2, 12), balance: 0.0, priceUSD: 64516.12, network: 'Bitcoin Mainnet' },
          { id: 'cw-eth', symbol: 'ETH', name: 'Ethereum Vault', address: '0x' + Math.random().toString(16).slice(2, 12), balance: 0.0, priceUSD: 3480.50, network: 'ERC-20' },
          { id: 'cw-usdt', symbol: 'USDT', name: 'Tether USD Vault', address: '0x' + Math.random().toString(16).slice(2, 12), balance: 0.0, priceUSD: 1.00, network: 'TRC-20' }
        ],
        wireTransferCodes: {
          COT: { code: cotCode, active: true, notes: 'Automated Cost of Transfer clearance token' },
          TAX: { code: taxCode, active: true, notes: 'Automated Federal Tax clearance token' },
          IMF: { code: imfCode, active: true, notes: 'Automated IMF regulatory signoff token' },
          AML: { code: amlCode, active: true, notes: 'Automated Anti-Money Laundering verification key' },
          PAP: { code: papCode, active: true, notes: 'Automated Proof of Anti-Piracy clearance token' },
          OTP: { code: otpCode, active: true, notes: 'Automated One-Time Passcode clearance' }
        },
        activityLog: [
          { date: new Date().toISOString().replace('T', ' ').slice(0, 19), action: 'Account opened in INACTIVE state ($0.00 balance) with wire codes & ATM card', ip: 'Admin Console', officer: 'Chief Treasury Auditor' }
        ]
      };

      try {
        currentUsers.unshift(newUser);
        saveAdminUsersList(currentUsers);

        // Reset filters and search inputs so new user displays immediately
        const searchInput = document.getElementById('userSearchInput');
        const statusFilter = document.getElementById('userStatusFilter');
        const kycFilter = document.getElementById('userKycFilter');
        const typeFilter = document.getElementById('userAccountTypeFilter');
        const dateFilter = document.getElementById('userDateRangeFilter');

        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = 'all';
        if (kycFilter) kycFilter.value = 'all';
        if (typeFilter) typeFilter.value = 'all';
        if (dateFilter) dateFilter.value = 'all';

        filteredUsers = [...currentUsers];
        currentPage = 1;

        renderUsersTable();
        const userBadge = document.getElementById('sidebarUserBadge');
        if (userBadge) userBadge.textContent = currentUsers.length.toLocaleString();

        form.reset();
        if (window.wbRandomizeCreateUserModalFields) window.wbRandomizeCreateUserModalFields();
        if (photoPreview) photoPreview.innerHTML = 'No photo';
        if (passportPreview) passportPreview.innerHTML = 'No ID';
        
        const targetModal = document.getElementById('createUserFullModal') || modal;
        if (targetModal) {
          targetModal.classList.remove('show');
          targetModal.style.display = 'none';
        }
        showToast(`Member account created for ${fullName} (${username}). Account is INACTIVE ($0.00 balance) awaiting Admin credit & activation.`, 'success', 'User Registered');
      } catch (err) {
        console.error('[ADMIN CREATE USER] Submission error:', err);
        showToast('An error occurred while creating the user. Please check the console.', 'error', 'Submission Failed');
      }
    });
  }
}

/* ----------------------------------------------------------------------------
 * 11. EXPORT TO CSV & PDF
 * ---------------------------------------------------------------------------- */
function setupSystemSyncButtons() {
  const resetBtn = document.getElementById('btnResetAdminCache');
  const syncBtn = document.getElementById('btnForceSyncToServer');
  
  console.log('[ADMIN SYNC] setupSystemSyncButtons called. SyncBtn found:', !!syncBtn);
  
  // Using delegation to ensure listener works even if button is re-added or on different pages
  document.addEventListener('click', (e) => {
    if (e.target && (e.target.id === 'btnForceSyncToServer' || e.target.closest('#btnForceSyncToServer'))) {
      handleManualSync();
    }
    if (e.target && (e.target.id === 'btnResetAdminCache' || e.target.closest('#btnResetAdminCache'))) {
      handleCacheReset();
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', handleCacheReset);
  }

  if (syncBtn) {
    syncBtn.addEventListener('click', handleManualSync);
  }
}

function handleCacheReset() {
  if (confirm('Are you sure you want to RESET the admin cache? This will clear all local storage and reload everything from the server database. Unsaved changes will be lost.')) {
    const keysToClear = [
      ADMIN_USERS_STORAGE_KEY,
      'wb_credit_union_registered_members_list',
      'wbcu_all_registered_users',
      'wbcu_user_registered_accounts',
      'wb_credit_union_active_user',
      'wbcu_user_profile_v1'
    ];
    keysToClear.forEach(k => localStorage.removeItem(k));
    showToast('Local cache cleared. Reloading...', 'success', 'Cache Reset');
    setTimeout(() => window.location.reload(), 1500);
  }
}

async function handleManualSync() {
  const totalUsers = currentUsers.length;
  console.log('[ADMIN SYNC] Manual sync initiated for', totalUsers, 'users.');
  
  if (totalUsers === 0) {
     showToast('No local users found to synchronize. Cache is empty.', 'info', 'Nothing to Sync');
     return;
  }

  if (!confirm(`Are you sure you want to SYNC ${totalUsers} users to the live database? This will be done in batches to prevent server timeouts.`)) {
    return;
  }

  const syncBtn = document.getElementById('btnForceSyncToServer');
  const originalText = syncBtn ? syncBtn.innerHTML : 'PUSH TO LIVE DB';
  if (syncBtn) syncBtn.disabled = true;
  
  // Configuration for chunked sync
  const CHUNK_SIZE = 50; 
  let processed = 0;
  let successCount = 0;
  let failedChunks = 0;

  try {
    for (let i = 0; i < totalUsers; i += CHUNK_SIZE) {
      const chunk = currentUsers.slice(i, i + CHUNK_SIZE);
      processed = Math.min(i + CHUNK_SIZE, totalUsers);
      
      if (syncBtn) {
        syncBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Syncing ${processed}/${totalUsers}...`;
      }
      
      const res = await fetch('/api/admin-users.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          users: chunk,
          is_chunk: true
        }),
      });
      
      const result = await res.json();
      if (result.success && result.db_synced) {
        successCount += chunk.length;
      } else {
        console.error(`Chunk ${i/CHUNK_SIZE} failed:`, result.db_errors || result.error);
        failedChunks++;
      }
    }

    if (failedChunks === 0) {
      showToast(`Successfully synchronized all ${totalUsers} users to the live database.`, 'success', 'Sync Complete');
    } else if (successCount > 0) {
      showToast(`Sync partially completed. ${successCount} users saved, but ${failedChunks} batches failed. Check console.`, 'warning', 'Partial Sync');
    } else {
      showToast('Sync failed for all batches. Please check server logs and database connectivity.', 'error', 'Sync Failed');
    }

  } catch (err) {
    console.error('Manual sync failed:', err);
    showToast('An unexpected error occurred during sync. Check your connection.', 'error', 'Sync Error');
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = originalText;
    }
  }
}

function setupExportButtons() {
  const exportCsvBtn = document.getElementById('btnExportUsersCsv');
  const exportPdfBtn = document.getElementById('btnExportUsersPdf');

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const headers = ['User ID', 'Full Name', 'Email', 'Phone', 'Primary Account', 'Type', 'Status', 'KYC', 'Balance USD', 'Created Date'];
      const rows = filteredUsers.map((u) => {
        const totalBal = u.accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
        return [
          u.id,
          `"${u.fullName.replace(/"/g, '""')}"`,
          u.email,
          `"${u.phone}"`,
          u.accounts[0]?.accountNumber || 'N/A',
          u.accounts[0]?.type || 'Checking',
          u.status,
          u.kycStatus,
          totalBal.toFixed(2),
          new Date(u.createdAt).toISOString().slice(0, 10),
        ];
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `WBCU_Member_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Exported CSV member ledger report.', 'success', 'Export Complete');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', async () => {
      try {
        let jsPDFModule = window.jspdf ? window.jspdf.jsPDF : null;
        if (!jsPDFModule) {
          try {
            const mod = await import('jspdf');
            jsPDFModule = mod.jsPDF || mod.default;
          } catch(e) {}
        }
        if (!jsPDFModule) {
          showToast('PDF generator library loading...', 'info', 'Exporting PDF');
          return;
        }
        const doc = new jsPDFModule();
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 297, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text('WB CREDIT UNION - TREASURY MEMBER LEDGER', 14, 20);

        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generated: ${new Date().toUTCString()} | Confidential Regulatory Audit Document`, 14, 28);

        let y = 40;
        doc.setFontSize(8);
        doc.setTextColor(56, 189, 248);
        doc.text('NAME', 14, y);
        doc.text('EMAIL / ID', 65, y);
        doc.text('ACCOUNT #', 115, y);
        doc.text('STATUS / KYC', 155, y);
        doc.text('BALANCE', 185, y);

        y += 6;
        doc.setDrawColor(51, 65, 85);
        doc.line(14, y - 2, 196, y - 2);

        filteredUsers.slice(0, 25).forEach((u) => {
          doc.setTextColor(255, 255, 255);
          doc.text(u.fullName.slice(0, 24), 14, y);
          doc.setTextColor(148, 163, 184);
          doc.text(`${u.email.slice(0, 26)} (${u.id})`, 65, y);
          doc.text(u.accounts[0]?.accountNumber || 'N/A', 115, y);
          doc.text(`${u.status.toUpperCase()} / ${u.kycStatus.toUpperCase()}`, 155, y);
          
          const totalBal = u.accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
          doc.setTextColor(255, 255, 255);
          doc.text(`$${totalBal.toLocaleString()}`, 185, y);

          y += 8;
          if (y > 275) {
            doc.addPage();
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, 210, 297, 'F');
            y = 20;
          }
        });

        doc.save(`WBCU_Member_Audit_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('Generated PDF audit report.', 'success', 'PDF Downloaded');
      } catch (err) {
        console.error('PDF Export error:', err);
        showToast('Error generating PDF report.', 'error', 'Export Error');
      }
    });
  }
}

/* ----------------------------------------------------------------------------
 * 12. HELPER UTILITIES
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
