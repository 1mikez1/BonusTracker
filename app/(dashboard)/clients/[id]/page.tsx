'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = Array.isArray(params?.id) ? params?.id[0] : (params?.id as string | undefined);

  const { data: clients } = useSupabaseData({ table: 'clients' });
  const { data: tiers } = useSupabaseData({ table: 'tiers' });
  const { data: clientApps } = useSupabaseData({ table: 'client_apps' });
  const { data: apps } = useSupabaseData({ table: 'apps' });
  const { data: promotions } = useSupabaseData({ table: 'promotions' });
  const { data: referralLinks } = useSupabaseData({ table: 'referral_links' });
  const { data: debts } = useSupabaseData({ table: 'referral_link_debts' });
  const { data: credentials } = useSupabaseData({ table: 'credentials' });
  const { data: paymentLinks } = useSupabaseData({ table: 'payment_links' });

  const client = clients.find((item) => item.id === clientId);
  if (!client) {
    return (
      <div>
        <SectionHeader title="Client not found" actions={<Link href="/clients">Back to clients</Link>} />
        <div className="empty-state">The requested client does not exist in the current dataset.</div>
      </div>
    );
  }

  const clientTier = tiers.find((tier) => tier.id === client.tier_id);
  const invitedBy = clients.find((item) => item.id === client.invited_by_client_id);

  const relatedApps = clientApps
    .filter((item) => item.client_id === client.id)
    .map((entry) => {
      const app = apps.find((item) => item.id === entry.app_id);
      const promotion = promotions.find((item) => item.id === entry.promotion_id ?? '');
      const link = referralLinks.find((item) => item.id === entry.referral_link_id ?? '');
      return {
        ...entry,
        app,
        promotion,
        link
      };
    });

  const clientDebts = debts.filter((debt) => debt.creditor_client_id === client.id || debt.debtor_client_id === client.id);
  const clientCredentials = credentials.filter((credential) => credential.client_id === client.id);
  const clientPaymentLinks = paymentLinks.filter((link) => link.client_id === client.id);

  const totalClientProfit = relatedApps.reduce((sum, item) => sum + Number(item.profit_client ?? 0), 0);
  const totalInternalProfit = relatedApps.reduce((sum, item) => sum + Number(item.profit_us ?? 0), 0);

  return (
    <div>
      <SectionHeader
        title={`${client.name} ${client.surname ?? ''}`.trim()}
        description={`Tier ${clientTier?.name ?? '—'} • Joined ${new Date(client.created_at).toLocaleDateString()}`}
        actions={<Link href="/clients">Back to clients</Link>}
      />
      <div className="detail-grid">
        <div className="detail-section">
          <h2>Client overview</h2>
          <div className="detail-list">
            <div className="detail-item">
              <strong>Contact</strong>
              <span>{client.contact ?? '—'}</span>
            </div>
            <div className="detail-item">
              <strong>Email</strong>
              <span>{client.email ?? '—'}</span>
            </div>
            <div className="detail-item">
              <strong>Trusted</strong>
              <span>{client.trusted ? 'Yes' : 'No'}</span>
            </div>
            <div className="detail-item">
              <strong>Invited by</strong>
              <span>{invitedBy ? invitedBy.name : '—'}</span>
            </div>
            <div className="detail-item">
              <strong>Internal notes</strong>
              <span>{client.notes ?? '—'}</span>
            </div>
          </div>
        </div>
        <div className="detail-section">
          <h2>Value summary</h2>
          <div className="detail-list">
            <div className="detail-item">
              <strong>Apps in progress</strong>
              <span>{relatedApps.length}</span>
            </div>
            <div className="detail-item">
              <strong>Profit to client</strong>
              <span>€{totalClientProfit.toFixed(2)}</span>
            </div>
            <div className="detail-item">
              <strong>Profit to us</strong>
              <span>€{totalInternalProfit.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <section style={{ marginTop: '2rem' }}>
        <h2>App workflow</h2>
        <div className="status-columns">
          {relatedApps.map((item) => (
            <div key={item.id} className="status-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{item.app?.name ?? 'Unknown app'}</strong>
                <StatusBadge status={item.status} />
              </div>
              <span>Promotion: {item.promotion?.name ?? '—'}</span>
              <span>Referral link: {item.link?.url ?? '—'}</span>
              <span>Deposit: €{Number(item.deposit_amount ?? 0).toFixed(2)}</span>
              <span>Client profit: €{Number(item.profit_client ?? 0).toFixed(2)}</span>
              <span>Internal profit: €{Number(item.profit_us ?? 0).toFixed(2)}</span>
              <span>Updated: {new Date(item.created_at).toLocaleDateString()}</span>
              {item.notes ? <span>Notes: {item.notes}</span> : null}
            </div>
          ))}
        </div>
        {!relatedApps.length ? <div className="empty-state">No app progress recorded.</div> : null}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Credentials</h2>
        {clientCredentials.length ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>App</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Notes</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {clientCredentials.map((credential) => {
                  const app = apps.find((item) => item.id === credential.app_id);
                  return (
                    <tr key={credential.id}>
                      <td>{app?.name ?? '—'}</td>
                      <td>{credential.email}</td>
                      <td>{credential.username ?? '—'}</td>
                      <td>{credential.notes ?? '—'}</td>
                      <td>{new Date(credential.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No stored credentials.</div>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Debts</h2>
        {clientDebts.length ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Referral link</th>
                </tr>
              </thead>
              <tbody>
                {clientDebts.map((debt) => {
                  const link = referralLinks.find((item) => item.id === debt.referral_link_id);
                  const isCreditor = debt.creditor_client_id === client.id;
                  return (
                    <tr key={debt.id}>
                      <td>{isCreditor ? 'Creditor' : 'Debtor'}</td>
                      <td>€{Number(debt.amount).toFixed(2)}</td>
                      <td>
                        <StatusBadge status={debt.status} />
                      </td>
                      <td>{debt.description ?? '—'}</td>
                      <td>{link?.url ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No debts tracked for this client.</div>
        )}
      </section>

      <section style={{ marginTop: '2rem', marginBottom: '3rem' }}>
        <h2>Payment links</h2>
        {clientPaymentLinks.length ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>URL</th>
                  <th>Amount</th>
                  <th>Purpose</th>
                  <th>Used</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {clientPaymentLinks.map((link) => (
                  <tr key={link.id}>
                    <td>{link.provider}</td>
                    <td>{link.url}</td>
                    <td>€{Number(link.amount ?? 0).toFixed(2)}</td>
                    <td>{link.purpose ?? '—'}</td>
                    <td>{link.used ? 'Yes' : 'No'}</td>
                    <td>{new Date(link.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No payment link history.</div>
        )}
      </section>
    </div>
  );
}
