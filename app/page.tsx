'use client';

import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useMemo } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';

export default function HomePage() {
  const { data: clients, isLoading: clientsLoading, error: clientsError } = useSupabaseData({ table: 'clients' });
  const { data: clientApps, isLoading: appsLoading, error: appsError } = useSupabaseData({ table: 'client_apps' });
  const { data: debts, isLoading: debtsLoading, error: debtsError } = useSupabaseData({ table: 'referral_link_debts' });
  const { data: requests, isLoading: requestsLoading, error: requestsError } = useSupabaseData({ table: 'requests' });
  const { data: apps } = useSupabaseData({ table: 'apps' });
  const { data: promotions } = useSupabaseData({ table: 'promotions' });
  const { data: paymentLinks } = useSupabaseData({ table: 'payment_links' });

  const isLoading = clientsLoading || appsLoading || debtsLoading || requestsLoading;
  const error = clientsError || appsError || debtsError || requestsError;

  const metrics = useMemo(() => {
    const activeClients = clients.filter((c) => c.trusted).length;
    const pipelineApps = clientApps.filter((ca) => ca.status !== 'cancelled' && ca.status !== 'paid').length;
    const openDebts = debts
      .filter((d) => d.status === 'open' || d.status === 'partial')
      .reduce((sum, d) => sum + Number(d.amount), 0);
    const pendingRequests = requests.filter((r) => r.status === 'new').length;

    return [
      { label: 'Active clients', value: activeClients.toString(), href: '/clients' },
      { label: 'Apps in pipeline', value: pipelineApps.toString(), href: '/pipeline' },
      { label: 'Open debts', value: `€${openDebts.toFixed(2)}`, href: '/debts' },
      { label: 'Pending requests', value: pendingRequests.toString(), href: '/requests' }
    ];
  }, [clients, clientApps, debts, requests]);

  const operationalFocus = useMemo(() => {
    // Today's onboarding - client apps created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayApps = clientApps.filter((ca) => {
      const created = new Date(ca.created_at);
      return created >= today && ca.status === 'registered';
    });

    // Group by app
    const appCounts: Record<string, number> = {};
    todayApps.forEach((ca) => {
      const app = apps.find((a) => a.id === ca.app_id);
      if (app) {
        appCounts[app.name] = (appCounts[app.name] || 0) + 1;
      }
    });
    const todayOnboarding = Object.entries(appCounts)
      .map(([name, count]) => `${name} x${count}`)
      .join(', ') || 'None';

    // Upcoming expirations - promotions ending in next 48h
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const expiringPromos = promotions.filter((p) => {
      if (!p.end_date) return false;
      const endDate = new Date(p.end_date);
      return endDate >= new Date() && endDate <= twoDaysFromNow;
    });

    // Money in transit - unused payment links
    const unusedLinks = paymentLinks?.filter((pl) => !pl.used) || [];
    const totalPending = unusedLinks.reduce((sum, pl) => sum + Number(pl.amount || 0), 0);

    return {
      todayOnboarding,
      expiringPromos: expiringPromos.length,
      totalPending,
      pendingLinks: unusedLinks.length
    };
  }, [clientApps, apps, promotions, paymentLinks]);

  if (isLoading) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main">
          <LoadingSpinner message="Loading dashboard metrics..." />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main">
          <ErrorMessage error={error} title="Failed to load dashboard" />
        </main>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <header className="section-header">
          <div>
            <h1>Mission Control</h1>
            <p style={{ color: '#64748b', marginTop: '0.35rem' }}>
              Track every client, promotion, referral and payout in one place.
            </p>
          </div>
          <div className="actions">
            <Link href="/clients" className="primary">
              Open clients
            </Link>
            <Link href="/requests">Process requests</Link>
          </div>
        </header>
        <section className="card-grid">
          {metrics.map((card) => (
            <Link key={card.label} href={card.href} className="card">
              <h3>{card.label}</h3>
              <strong>{card.value}</strong>
            </Link>
          ))}
        </section>
        <section className="detail-grid">
          <div className="detail-section">
            <h2>Operational focus</h2>
            <div className="detail-list">
              <div className="detail-item">
                <strong>Today&apos;s onboarding</strong>
                <span>{operationalFocus.todayOnboarding}</span>
              </div>
              <div className="detail-item">
                <strong>Upcoming expirations</strong>
                <span>
                  {operationalFocus.expiringPromos} promotion{operationalFocus.expiringPromos !== 1 ? 's' : ''} ending
                  within 48h
                </span>
              </div>
              <div className="detail-item">
                <strong>Money in transit</strong>
                <span>
                  €{operationalFocus.totalPending.toFixed(2)} pending across {operationalFocus.pendingLinks} payment
                  link{operationalFocus.pendingLinks !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
          <div className="detail-section">
            <h2>Standard operating procedures</h2>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>
              Use the sidebar to manage every stage of the workflow: intake new form submissions, onboard clients,
              assign the best referral links and promotions, manage frozen funds, and deploy the right payment
              channels. Message templates keep support fast and consistent.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
