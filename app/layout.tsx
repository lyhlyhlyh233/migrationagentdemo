import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MigrationDirector +',
  icons: { icon: '/favicon.svg' },
  description: '面向迁移工程师的交付协作工作台',
  openGraph: {
    title: 'MigrationDirector +',
    description: '迁移交付与人工确认工作台',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'MigrationDirector +' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MigrationDirector +',
    description: '迁移交付与人工确认工作台',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>
    </html>
  );
}
