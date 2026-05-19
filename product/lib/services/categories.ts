/**
 * Service categories registry — single source of truth for the home grid,
 * the map view, search dropdowns, and the agent. Slugs MUST stay aligned with
 * the SERVICE_SLUGS list in lib/antigravity/agents/conversation.ts (which is
 * what the LLM tool declaration enums against).
 */

export interface ServiceCategory {
  slug: string;
  label_en: string;
  label_ur: string;
  emoji: string;
  /** A short Roman-Urdu/English prompt the home grid auto-submits to the agent. */
  prompt_en: string;
  prompt_ur: string;
  /** Whether to surface in the compact "quick row" on home. */
  is_quick?: boolean;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { slug: 'ac_repair',        label_en: 'AC repair',        label_ur: 'AC کی مرمت',           emoji: '❄️',  prompt_en: 'My AC is not cooling properly',                       prompt_ur: 'میرا AC ٹھنڈا نہیں کر رہا',         is_quick: true },
  { slug: 'plumber',          label_en: 'Plumber',          label_ur: 'پلمبر',                emoji: '🚰',  prompt_en: 'I need a plumber for a leak / pipe issue',            prompt_ur: 'پلمبر چاہیے، پائپ لیک ہے',         is_quick: true },
  { slug: 'electrician',      label_en: 'Electrician',      label_ur: 'الیکٹریشن',            emoji: '💡',  prompt_en: 'I need an electrician',                               prompt_ur: 'الیکٹریشن چاہیے',                  is_quick: true },
  { slug: 'house_cleaning',   label_en: 'House cleaning',   label_ur: 'صفائی',                emoji: '🧹',  prompt_en: 'I want house cleaning service',                       prompt_ur: 'گھر کی صفائی چاہیے',               is_quick: true },
  { slug: 'tutor',            label_en: 'Tutor',            label_ur: 'استاد',                emoji: '📚',  prompt_en: 'I need a tutor',                                      prompt_ur: 'استاد چاہیے' },
  { slug: 'beautician',       label_en: 'Beautician',       label_ur: 'بیوٹیشن',              emoji: '💄',  prompt_en: 'I need a beautician at home',                         prompt_ur: 'گھر پر بیوٹیشن چاہیے' },
  { slug: 'carpenter',        label_en: 'Carpenter',        label_ur: 'بڑھئی',                emoji: '🪚',  prompt_en: 'I need a carpenter for furniture work',               prompt_ur: 'فرنیچر کے لیے بڑھئی چاہیے' },
  { slug: 'car_wash',         label_en: 'Car wash',         label_ur: 'گاڑی کی صفائی',         emoji: '🚿',  prompt_en: 'I want my car washed',                                prompt_ur: 'گاڑی کی صفائی کرواؤ' },
  { slug: 'car_mechanic',     label_en: 'Car mechanic',     label_ur: 'موٹر مکینک',            emoji: '🔧',  prompt_en: 'My car has a mechanical issue',                       prompt_ur: 'گاڑی میں مکینیکل مسئلہ ہے' },
  { slug: 'mobile_repair',    label_en: 'Mobile repair',    label_ur: 'موبائل ریپیئر',         emoji: '📱',  prompt_en: 'I need to fix my mobile phone',                       prompt_ur: 'موبائل ریپیئر کرنا ہے' },
  { slug: 'cook',             label_en: 'Cook',             label_ur: 'باورچی',               emoji: '🍳',  prompt_en: 'I need a cook for daily meals',                       prompt_ur: 'گھر کے لیے باورچی چاہیے' },
  { slug: 'painter',          label_en: 'Painter',          label_ur: 'پینٹر',                emoji: '🎨',  prompt_en: 'I need a painter for my walls',                       prompt_ur: 'دیواروں کے لیے پینٹر چاہیے' },
  { slug: 'mason',            label_en: 'Mason',            label_ur: 'راج مستری',            emoji: '🧱',  prompt_en: 'I need a mason for brick/cement work',                prompt_ur: 'راج مستری چاہیے' },
  { slug: 'appliance_repair', label_en: 'Appliance repair', label_ur: 'گھریلو آلات کی مرمت', emoji: '🛠️',  prompt_en: 'Fridge / washing machine repair',                     prompt_ur: 'فریج یا واشنگ مشین کی مرمت' },
  { slug: 'gardening',        label_en: 'Gardening',        label_ur: 'باغبانی',              emoji: '🌿',  prompt_en: 'I need help with my garden',                          prompt_ur: 'مالی چاہیے' },
  { slug: 'pest_control',     label_en: 'Pest control',     label_ur: 'کیڑے مار',             emoji: '🐜',  prompt_en: 'I need pest control / cockroach treatment',           prompt_ur: 'کاکروچ / دیمک کی صفائی چاہیے' },
];

export const SERVICE_SLUGS = SERVICE_CATEGORIES.map((c) => c.slug);

export function getCategory(slug: string): ServiceCategory | undefined {
  return SERVICE_CATEGORIES.find((c) => c.slug === slug);
}
