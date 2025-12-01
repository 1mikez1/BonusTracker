import type { Database } from './database';

export type ClientPartner = Database['public']['Tables']['client_partners']['Row'];
export type ClientPartnerAssignment = Database['public']['Tables']['client_partner_assignments']['Row'] & {
  client?: Database['public']['Tables']['clients']['Row'];
};
export type PartnerPayment = Database['public']['Tables']['partner_payments']['Row'];

export interface PartnerSummary {
  partner: ClientPartner;
  clientsCount: number;
  totalProfit: number;
  partnerShare: number;
  ownerShare: number;
  totalPaid: number;
  balance: number;
}

export interface PartnerClientBreakdown {
  clientId: string;
  clientName: string;
  totalProfit: number;
  partnerShare: number;
  ownerShare: number;
  splitPartner: number;
  splitOwner: number;
  override: boolean;
}

export interface PartnerPaymentHistory {
  id: string;
  amount: number;
  note?: string | null;
  paidAt: string;
}

export interface PartnerBalance {
  partnerId: string;
  totalProfit: number;
  partnerShare: number;
  ownerShare: number;
  totalPaid: number;
  balance: number;
}

