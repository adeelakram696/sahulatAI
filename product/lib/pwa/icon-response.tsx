/**
 * Shared icon generator — produces a simple branded PNG for any size.
 * Used by /icons/*.png route handlers so we don't need binary files in /public.
 */
import { ImageResponse } from 'next/og';

export function generateAppIcon(size: number, maskable = false): ImageResponse {
  // Maskable icons need ~20% padding so the design isn't clipped by adaptive masks.
  const inner = maskable ? Math.round(size * 0.6) : Math.round(size * 0.8);
  const fontSize = Math.round(inner * 0.55);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: maskable ? '#0ea5a4' : '#0b1220',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: maskable ? 0 : Math.round(inner * 0.22),
            background: maskable
              ? 'linear-gradient(135deg, #0ea5a4 0%, #0d9488 100%)'
              : 'linear-gradient(135deg, #0ea5a4 0%, #0d9488 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize,
            fontWeight: 800,
            letterSpacing: -2,
            fontFamily: 'sans-serif',
          }}
        >
          S
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        'Cache-Control': 'public, max-age=86400, immutable',
        'Content-Type': 'image/png',
      },
    },
  );
}
