import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'SahuliatAI',
  description: 'AI-powered service booking for the informal economy',
  manifest: '/manifest.webmanifest',
  applicationName: 'SahuliatAI',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'SahuliatAI' },
};

export const viewport: Viewport = {
  themeColor: '#0ea5a4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === 'ur' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background text-foreground">
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
        <Toaster richColors position="top-center" />
        <script
          // Register service worker
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}`,
          }}
        />
      </body>
    </html>
  );
}
