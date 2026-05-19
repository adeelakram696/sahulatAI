#!/usr/bin/env node
/**
 * Writes public/.well-known/assetlinks.json at build time from env vars.
 *
 * Reads:
 *   TWA_SHA256_FINGERPRINTS         comma-separated SHA-256 fingerprints
 *   NEXT_PUBLIC_TWA_PACKAGE_NAME    e.g. ai.sahuliat.app
 *
 * Vercel serves /public/ files from its CDN with lighter DDoS mitigation than
 * route handlers — so this static file path reliably bypasses the JS challenge
 * that was blocking the dynamic /.well-known/assetlinks.json route.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const pkg = (process.env.NEXT_PUBLIC_TWA_PACKAGE_NAME || 'ai.sahuliat.app').trim();
const raw = (process.env.TWA_SHA256_FINGERPRINTS || '').trim();
const fingerprints = raw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const body = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: pkg,
      sha256_cert_fingerprints: fingerprints,
    },
  },
];

const out = resolve(process.cwd(), 'public/.well-known/assetlinks.json');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(body, null, 2) + '\n', 'utf8');

console.log(`-> Wrote ${out}`);
console.log(`   package: ${pkg}`);
console.log(`   fingerprints: ${fingerprints.length}`);
if (fingerprints.length === 0) {
  console.warn('   ⚠ No fingerprints set — TWA verification will fail until TWA_SHA256_FINGERPRINTS is set.');
}
