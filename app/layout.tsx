import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Echo — The Holographic Brain',
  description: 'A private, persistent memory workspace on an MRI-derived cortical atlas.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
