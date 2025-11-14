import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';

const cards = [
  { label: 'Active clients', value: '128', href: '/clients' },
  { label: 'Apps in pipeline', value: '64', href: '/pipeline' },
  { label: 'Open debts', value: '€4,850', href: '/debts' },
  { label: 'Pending requests', value: '12', href: '/requests' }
];

export default function HomePage() {
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
          {cards.map((card) => (
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
                <span>Revolut x3, Bybit x2, Kraken x1</span>
              </div>
              <div className="detail-item">
                <strong>Upcoming expirations</strong>
                <span>2 promotions ending within 48h</span>
              </div>
              <div className="detail-item">
                <strong>Money in transit</strong>
                <span>€9,200 pending across 6 payment links</span>
              </div>
            </div>
          </div>
          <div className="detail-section">
            <h2>Standard operating procedures</h2>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>
              Use the sidebar to manage every stage of the workflow: intake new form submissions, onboard
              clients, assign the best referral links and promotions, manage frozen funds, and deploy the right
              payment channels. Message templates keep support fast and consistent.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
