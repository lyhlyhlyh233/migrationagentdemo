import type { Metadata } from 'next';
import './globals.css';
import { preferencesBootstrap } from './preferences';

export const metadata: Metadata = {
  title: 'MigrationDirector Plus',
  icons: { icon: { url: '/favicon.svg?v=huawei', type: 'image/svg+xml' } },
  description: '面向迁移工程师的交付协作工作台',
  openGraph: {
    title: 'MigrationDirector Plus',
    description: '迁移交付与人工确认工作台',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'MigrationDirector Plus' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MigrationDirector Plus',
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
    <html lang="zh-CN" data-theme="white" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: preferencesBootstrap }} /></head>
      <body>
        {children}
      </body>
    </html>
  );
}
