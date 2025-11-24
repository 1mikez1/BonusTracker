import type { Database } from '@/types/database';

type Table<K extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][K]['Row'];

const now = new Date();

const sampleClients: Array<Table<'clients'>> = [
  {
    id: 'client-1',
    name: 'Alessia',
    surname: 'Rossi',
    contact: '@alessia',
    email: 'alessia@example.com',
    trusted: true,
    tier_id: 'tier-top',
    invited_by_client_id: null,
    invited_by_name: null,
    goated: false,
    needs_rewrite: false,
    rewrite_j: false,
    notes: 'Prefers crypto apps',
    created_at: now.toISOString()
  },
  {
    id: 'client-2',
    name: 'Marco',
    surname: 'Bianchi',
    contact: '+39 333 000 0000',
    email: 'marco@example.com',
    trusted: false,
    tier_id: 'tier-1',
    invited_by_client_id: 'client-1',
    invited_by_name: null,
    goated: false,
    needs_rewrite: false,
    rewrite_j: false,
    notes: 'Waiting Revolut bonus payout',
    created_at: now.toISOString()
  }
];

const sampleTiers: Array<Table<'tiers'>> = [
  { id: 'tier-top', name: 'TOP', priority: 1, notes: '€10k+ lifetime profit' },
  { id: 'tier-1', name: 'TIER 1', priority: 2, notes: 'Reliable depositors' }
];

const sampleApps: Array<Table<'apps'>> = [
  {
    id: 'app-revolut',
    name: 'Revolut',
    app_type: 'bank',
    country: 'IT',
    is_active: true,
    notes: 'Daily limit 5 signups'
  },
  {
    id: 'app-bybit',
    name: 'Bybit',
    app_type: 'crypto',
    country: 'EU',
    is_active: true,
    notes: 'Monitor anti-fraud requests'
  }
];

const samplePromotions: Array<Table<'promotions'>> = [
  {
    id: 'promo-revolut-1',
    app_id: 'app-revolut',
    name: 'Revolut Spring Cashback',
    client_reward: 30,
    our_reward: 20,
    deposit_required: 10,
    freeze_days: 0,
    time_to_get_bonus: 'Instant',
    start_date: now.toISOString(),
    end_date: null,
    terms_conditions: 'Deposit €10 and complete KYC',
    notes: 'Send ID guide',
    expense: null,
    is_active: true,
    max_invites: null,
    profit_type: null
  },
  {
    id: 'promo-bybit-1',
    app_id: 'app-bybit',
    name: 'Bybit High Roller',
    client_reward: 100,
    our_reward: 75,
    deposit_required: 500,
    freeze_days: 14,
    time_to_get_bonus: 'Within 7 days',
    start_date: now.toISOString(),
    end_date: null,
    terms_conditions: 'Spot trade volume €2k',
    notes: 'Require proof of funds',
    expense: null,
    is_active: true,
    max_invites: null,
    profit_type: null
  }
];

const sampleClientApps: Array<Table<'client_apps'>> = [
  {
    id: 'client-app-1',
    client_id: 'client-1',
    app_id: 'app-revolut',
    promotion_id: 'promo-revolut-1',
    referral_link_id: 'ref-link-1',
    invited_by_client_id: null,
    status: 'waiting_bonus',
    deposited: true,
    finished: false,
    deposit_amount: 100,
    profit_client: 30,
    profit_us: 20,
    created_at: now.toISOString(),
    completed_at: null,
    completed_steps: null,
    notes: 'Bonus expected Friday'
  },
  {
    id: 'client-app-2',
    client_id: 'client-2',
    app_id: 'app-bybit',
    promotion_id: 'promo-bybit-1',
    referral_link_id: 'ref-link-2',
    invited_by_client_id: 'client-1',
    status: 'deposited',
    deposited: true,
    finished: false,
    deposit_amount: 500,
    profit_client: null,
    profit_us: null,
    created_at: now.toISOString(),
    completed_at: null,
    completed_steps: null,
    notes: 'Awaiting futures volume'
  }
];

const sampleReferralLinks: Array<Table<'referral_links'>> = [
  {
    id: 'ref-link-1',
    app_id: 'app-revolut',
    url: 'https://revolut.com/ref/rossi',
    owner_client_id: 'client-1',
    max_uses: 30,
    current_uses: 18,
    is_active: true,
    notes: 'Reserve 5 slots for TOP clients'
  },
  {
    id: 'ref-link-2',
    app_id: 'app-bybit',
    url: 'https://bybit.com/ref/alessia',
    owner_client_id: 'client-1',
    max_uses: 10,
    current_uses: 7,
    is_active: true,
    notes: 'High deposit requirement'
  }
];

const sampleDebts: Array<Table<'referral_link_debts'>> = [
  {
    id: 'debt-1',
    referral_link_id: 'ref-link-2',
    creditor_client_id: 'client-1',
    debtor_client_id: 'client-2',
    amount: 250,
    status: 'open',
    description: 'Fronted deposit for Bybit futures',
    created_at: now.toISOString(),
    settled_at: null
  }
];

const sampleRequests: Array<Table<'requests'>> = [
  {
    id: 'request-1',
    external_form_id: 'mod-102',
    client_id: null,
    name: 'Luca',
    contact: '@luca',
    requested_apps_raw: 'Revolut, Sisal',
    notes: 'Has KYC ready',
    status: 'new',
    created_at: now.toISOString(),
    processed_at: null
  }
];

const sampleCredentials: Array<Table<'credentials'>> = [
  {
    id: 'cred-1',
    client_id: 'client-1',
    app_id: 'app-revolut',
    email: 'alessia.revolut@example.com',
    username: null,
    password_encrypted: '***encrypted***',
    notes: 'Stored in password vault',
    created_at: now.toISOString()
  }
];

const samplePaymentLinks: Array<Table<'payment_links'>> = [
  {
    id: 'pay-1',
    provider: 'SumUp',
    url: 'https://pay.sumup.it/order/123',
    amount: 200,
    purpose: 'Revolut deposit',
    client_id: 'client-2',
    app_id: 'app-revolut',
    used: false,
    created_at: now.toISOString(),
    used_at: null
  }
];

const sampleSlots: Array<Table<'slots'>> = [
  {
    id: 'slot-1',
    name: 'Book of Ra Deluxe',
    provider: 'Novomatic',
    rtp_percentage: 95.1,
    notes: 'High volatility'
  }
];

const sampleMessageTemplates: Array<Table<'message_templates'>> = [
  {
    id: 'msg-1',
    name: 'Revolut Registration - Step 1',
    app_id: 'app-revolut',
    step: 'Registration',
    language: 'it',
    content: 'Scarica l\'app Revolut, aprila e premi su "Inizia". Segui la procedura KYC.',
    notes: 'Send once document list confirmed',
    step_order: 1
  },
  {
    id: 'msg-2',
    name: 'Generic - Bonus reminder',
    app_id: null,
    step: 'Follow-up',
    language: 'it',
    content: 'Ricordati di completare il deposito entro oggi per ricevere il bonus massimo.',
    notes: null,
    step_order: null
  }
];

export const demoData = {
  clients: sampleClients,
  tiers: sampleTiers,
  apps: sampleApps,
  promotions: samplePromotions,
  client_apps: sampleClientApps,
  referral_links: sampleReferralLinks,
  referral_link_debts: sampleDebts,
  requests: sampleRequests,
  credentials: sampleCredentials,
  payment_links: samplePaymentLinks,
  slots: sampleSlots,
  message_templates: sampleMessageTemplates
};
