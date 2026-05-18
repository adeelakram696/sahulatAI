import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SahuliatAI',
    short_name: 'Sahuliat',
    description: 'AI-powered service booking for the informal economy',
    start_url: '/?utm_source=pwa',
    display: 'standalone',
    background_color: '#0b1220',
    theme_color: '#0ea5a4',
    orientation: 'portrait',
    lang: 'en',
    dir: 'auto',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png' },
      { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'New request', url: '/chat' },
      { name: 'My bookings', url: '/bookings' },
    ],
  };
}
