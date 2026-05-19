import { generateAppIcon } from '@/lib/pwa/icon-response';
export const runtime = 'nodejs';
export const dynamic = 'force-static';
export function GET() {
  return generateAppIcon(256);
}
