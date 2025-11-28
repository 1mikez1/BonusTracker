import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bonus Tracker Dashboard',
  description: 'Internal operations platform for referral and bonus management'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
