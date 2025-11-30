'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/clients', label: 'Clients' },
  { href: '/apps', label: 'Apps' },
  { href: '/promotions', label: 'Promotions' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/deadlines', label: 'Deadlines' },
  { href: '/fast-check', label: 'Fast-Check' },
  { href: '/referral-links', label: 'Referral Links' },
  { href: '/debts', label: 'Debts' },
  { href: '/requests', label: 'Requests' },
  { href: '/payment-links', label: 'Payment Links' },
  { href: '/slots', label: 'Slots RTP' },
  { href: '/message-templates', label: 'Message Templates' }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div>
        <strong style={{ fontSize: '1.1rem' }}>Bonus Tracker</strong>
        <p style={{ marginTop: '0.25rem', color: 'rgba(148,163,184,0.8)', fontSize: '0.85rem' }}>
          Operational cockpit
        </p>
      </div>
      <nav>
        {links.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
          return (
            <Link className={isActive ? 'active' : ''} href={link.href} key={link.href}>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
