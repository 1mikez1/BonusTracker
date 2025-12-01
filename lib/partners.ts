import type { Database } from '@/types/database';
import type {
  ClientPartner,
  ClientPartnerAssignment,
  PartnerBalance,
  PartnerClientBreakdown,
  PartnerPayment
} from '@/types/partners';

export type ClientAppRow = Database['public']['Tables']['client_apps']['Row'] & {
  clients?: Database['public']['Tables']['clients']['Row'];
  apps?: Database['public']['Tables']['apps']['Row'];
};

export interface BuildPartnerTotalsArgs {
  partner: ClientPartner;
  assignments: ClientPartnerAssignment[];
  clientApps: ClientAppRow[];
  payments: PartnerPayment[];
}

export interface MonthlyPoint {
  month: string;
  amount: number;
}

const statusContributes = new Set(['completed', 'paid']);

export function buildPartnerBreakdown({
  partner,
  assignments,
  clientApps
}: {
  partner: ClientPartner;
  assignments: ClientPartnerAssignment[];
  clientApps: ClientAppRow[];
}): PartnerClientBreakdown[] {
  const result: PartnerClientBreakdown[] = [];
  assignments.forEach((assignment) => {
    const splitPartner = assignment.split_partner_override ?? partner.default_split_partner;
    const splitOwner = assignment.split_owner_override ?? partner.default_split_owner;
    const relatedApps = clientApps.filter(
      (app) => app.client_id === assignment.client_id && statusContributes.has(app.status)
    );
    const totalProfit = relatedApps.reduce((sum, app) => sum + Number(app.profit_us ?? 0), 0);
    
    // Get client name - try assignment.client first, then check if it's an array
    let clientName = 'Unknown';
    if (assignment.client) {
      if (typeof assignment.client === 'object' && 'name' in assignment.client) {
        const client = assignment.client as any;
        const surname = client.surname || '';
        clientName = `${client.name}${surname ? ' ' + surname : ''}`.trim() || 'Unknown';
      } else if (Array.isArray(assignment.client) && (assignment.client as any[]).length > 0) {
        const client = (assignment.client as any[])[0] as any;
        const surname = client.surname || '';
        clientName = `${client.name}${surname ? ' ' + surname : ''}`.trim() || 'Unknown';
      }
    }
    
    result.push({
      clientId: assignment.client_id,
      clientName,
      totalProfit,
      partnerShare: totalProfit * splitPartner,
      ownerShare: totalProfit * splitOwner,
      splitPartner,
      splitOwner,
      override:
        assignment.split_partner_override !== null ||
        assignment.split_owner_override !== null
    });
  });
  return result;
}

export function calculatePartnerBalance({
  partner,
  assignments,
  clientApps,
  payments
}: BuildPartnerTotalsArgs): PartnerBalance {
  const breakdown = buildPartnerBreakdown({ partner, assignments, clientApps });
  const partnerShare = breakdown.reduce((sum, item) => sum + item.partnerShare, 0);
  const ownerShare = breakdown.reduce((sum, item) => sum + item.ownerShare, 0);
  const totalProfit = breakdown.reduce((sum, item) => sum + item.totalProfit, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  return {
    partnerId: partner.id,
    totalProfit,
    partnerShare,
    ownerShare,
    totalPaid,
    balance: partnerShare - totalPaid
  };
}

export function buildMonthlySeries(breakdown: PartnerClientBreakdown[], clientApps: ClientAppRow[]): MonthlyPoint[] {
  const monthlyMap = new Map<string, number>();
  breakdown.forEach((item) => {
    const apps = clientApps.filter(
      (app) => app.client_id === item.clientId && statusContributes.has(app.status)
    );
    apps.forEach((app) => {
      if (!app.completed_at && !app.created_at) return;
      const rawDate = app.completed_at ?? app.created_at ?? '';
      if (!rawDate) return;
      const monthKey = rawDate.slice(0, 7);
      const partnerShare = Number(app.profit_us ?? 0) * item.splitPartner;
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + partnerShare);
    });
  });
  return Array.from(monthlyMap.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([month, amount]) => ({ month, amount }));
}

export function filterAssignmentsByPartner(
  assignments: ClientPartnerAssignment[] | undefined,
  partnerId: string
): ClientPartnerAssignment[] {
  if (!assignments) return [];
  return assignments.filter((assignment) => assignment.partner_id === partnerId);
}

