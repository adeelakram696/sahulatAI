import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'ur', 'ur-Latn'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  let requested = (await requestLocale) ?? 'en';
  if (!locales.includes(requested as Locale)) requested = 'en';
  const messages = (await import(`./messages/${requested}.json`)).default;
  return { locale: requested as Locale, messages };
});
