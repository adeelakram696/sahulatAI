-- ============================================================================
-- Seed data — service categories + providers (NO REAL PII)
-- ============================================================================

-- Service categories (8) with bilingual labels + Roman Urdu keywords
insert into public.service_categories(slug, name_en, name_ur, icon, keywords) values
  ('ac_repair',        'AC Technician',     'اے سی ٹیکنیشن',     'snowflake',  array['ac','air conditioner','cooling','thanda','gas','kool','air-conditioning']),
  ('plumber',          'Plumber',           'پلمبر',               'wrench',     array['plumber','pani','leakage','pipe','tap','nal','plumbing','leak','tank','tanki','tank clean','water tank','drainage','sewerage']),
  ('electrician',      'Electrician',       'الیکٹریشن',           'zap',        array['electrician','wiring','bijli','meter','switch','light','electric']),
  ('tutor',            'Tutor',             'استاد',               'book-open',  array['tutor','teacher','ustad','math','physics','english','tuition']),
  ('beautician',       'Beautician',        'بیوٹیشن',             'sparkles',   array['beautician','salon','makeup','hair','threading','facial']),
  ('carpenter',        'Carpenter',         'بڑھئی',               'hammer',     array['carpenter','furniture','wood','barhai','carpentry']),
  ('car_wash',         'Car Wash',          'کار واش',             'car',        array['car wash','dhulai','detailing','car cleaning']),
  ('mobile_repair',    'Mobile Repair',     'موبائل ریپیئر',       'smartphone', array['mobile','phone','screen','battery','mobile repair']),
  ('car_mechanic',     'Car Mechanic',      'کار میکینک',          'wrench',     array['mechanic','car repair','engine','brake','gaari','workshop','tune up','clutch']),
  ('house_cleaning',   'House Cleaning',    'گھر کی صفائی',        'sparkles',   array['cleaning','house cleaning','saafai','safai','maid','jhaaru','pocha','dusting']),
  ('cook',             'Cook',              'باورچی',              'utensils',   array['cook','chef','khansama','khana','catering','baawarchi','dawat','party']),
  ('painter',          'Painter',           'رنگ ساز',             'paintbrush', array['painter','paint','wall paint','rang','polish','distemper','enamel']),
  ('mason',            'Mason',             'راج مستری',            'hammer',     array['mason','raj','rajmistri','brick','cement','plaster','construction']),
  ('appliance_repair', 'Appliance Repair',  'اپلائنس ریپیئر',      'tool',       array['fridge','refrigerator','washing machine','dryer','microwave','oven','appliance']),
  ('gardening',        'Gardener',          'مالی',                'leaf',       array['gardener','mali','garden','lawn','plant','trees','grass','pruning']),
  ('pest_control',     'Pest Control',      'پیسٹ کنٹرول',          'bug',        array['pest control','fumigation','cockroach','rats','termite','keera','spray'])
on conflict (slug) do nothing;

-- Providers (30 entries across Islamabad sectors with fake data)
insert into public.providers (business_name, slug, phone, phone_verified, languages, categories, hub_location, service_radius_km, weekly_hours, price_band, google_rating, google_rating_count, response_time_minutes, avg_duration, published, source, whatsapp_opt_in)
values
  -- AC Technicians
  ('Ali AC Services',      'ali-ac-services',     '+92 300 555 0101', true, '{en,ur}',  '{ac_repair}',          st_setsrid(st_makepoint(72.9560, 33.6469), 4326)::geography, 8, '{"mon":["09:00","18:00"],"tue":["09:00","18:00"],"wed":["09:00","18:00"],"thu":["09:00","18:00"],"fri":["09:00","18:00"],"sat":["09:00","16:00"]}'::jsonb, '{"ac_repair":{"min":1500,"max":2500}}'::jsonb, 4.7, 42, 12, '1 hour 30 minutes', true, 'self_onboarded', true),
  ('Cool Tech Islamabad',  'cool-tech-isb',       '+92 300 555 0102', true, '{en,ur}',  '{ac_repair}',          st_setsrid(st_makepoint(73.0479, 33.6844), 4326)::geography, 10,'{"mon":["08:00","20:00"],"tue":["08:00","20:00"],"wed":["08:00","20:00"],"thu":["08:00","20:00"],"fri":["08:00","20:00"],"sat":["10:00","18:00"]}'::jsonb,'{"ac_repair":{"min":2000,"max":3500}}'::jsonb, 4.5, 28, 18, '1 hour 30 minutes', true, 'self_onboarded', true),
  ('Refrigeration Pro',    'refrigeration-pro',   '+92 300 555 0103', true, '{en}',     '{ac_repair}',          st_setsrid(st_makepoint(72.9930, 33.7160), 4326)::geography, 12,'{"mon":["10:00","18:00"],"tue":["10:00","18:00"],"wed":["10:00","18:00"],"thu":["10:00","18:00"],"fri":["10:00","18:00"]}'::jsonb,'{"ac_repair":{"min":1800,"max":2800}}'::jsonb, 4.3, 17, 30, '2 hours', true, 'self_onboarded', false),
  -- Plumbers
  ('G-13 Plumbing Co',     'g13-plumbing',        '+92 300 555 0104', true, '{en,ur}',  '{plumber}',            st_setsrid(st_makepoint(72.9580, 33.6470), 4326)::geography, 5, '{"mon":["08:00","20:00"],"tue":["08:00","20:00"],"wed":["08:00","20:00"],"thu":["08:00","20:00"],"fri":["08:00","20:00"],"sat":["08:00","20:00"]}'::jsonb,'{"plumber":{"min":800,"max":1800}}'::jsonb, 4.6, 35, 15, '1 hour', true, 'self_onboarded', true),
  ('Quick Pipe Fix',       'quick-pipe-fix',      '+92 300 555 0105', true, '{en,ur}',  '{plumber}',            st_setsrid(st_makepoint(73.0479, 33.6844), 4326)::geography, 7, '{"mon":["07:00","21:00"],"tue":["07:00","21:00"],"wed":["07:00","21:00"],"thu":["07:00","21:00"],"fri":["07:00","21:00"],"sat":["09:00","18:00"],"sun":["10:00","16:00"]}'::jsonb,'{"plumber":{"min":1000,"max":2200}}'::jsonb, 4.4, 22, 20, '1 hour', true, 'self_onboarded', true),
  ('Sector F Plumbers',    'sector-f-plumbers',   '+92 300 555 0106', true, '{ur}',     '{plumber}',            st_setsrid(st_makepoint(73.0250, 33.7000), 4326)::geography, 6, '{"mon":["09:00","18:00"],"tue":["09:00","18:00"],"wed":["09:00","18:00"],"thu":["09:00","18:00"],"fri":["09:00","18:00"]}'::jsonb,'{"plumber":{"min":700,"max":1500}}'::jsonb, 4.1, 12, 25, '1 hour', true, 'self_onboarded', false),
  -- Electricians
  ('Spark Electrics',      'spark-electrics',     '+92 300 555 0107', true, '{en,ur}',  '{electrician}',        st_setsrid(st_makepoint(72.9580, 33.6470), 4326)::geography, 8, '{"mon":["08:00","20:00"],"tue":["08:00","20:00"],"wed":["08:00","20:00"],"thu":["08:00","20:00"],"fri":["08:00","20:00"],"sat":["08:00","16:00"]}'::jsonb,'{"electrician":{"min":1200,"max":2500}}'::jsonb, 4.8, 51, 10, '1 hour 30 minutes', true, 'self_onboarded', true),
  ('Bright Wiring',        'bright-wiring',       '+92 300 555 0108', true, '{en}',     '{electrician}',        st_setsrid(st_makepoint(73.0479, 33.6844), 4326)::geography, 10,'{"mon":["09:00","18:00"],"tue":["09:00","18:00"],"wed":["09:00","18:00"],"thu":["09:00","18:00"],"fri":["09:00","18:00"]}'::jsonb,'{"electrician":{"min":1500,"max":3000}}'::jsonb, 4.5, 30, 14, '1 hour 30 minutes', true, 'self_onboarded', true),
  ('Sector I Electric',    'sector-i-electric',   '+92 300 555 0109', true, '{ur}',     '{electrician}',        st_setsrid(st_makepoint(73.0700, 33.6900), 4326)::geography, 7, '{"mon":["10:00","19:00"],"tue":["10:00","19:00"],"wed":["10:00","19:00"],"thu":["10:00","19:00"],"fri":["10:00","19:00"],"sat":["10:00","16:00"]}'::jsonb,'{"electrician":{"min":900,"max":1800}}'::jsonb, 4.2, 18, 22, '1 hour', true, 'self_onboarded', false),
  -- Tutors
  ('Bright Tutors',        'bright-tutors',       '+92 300 555 0110', true, '{en,ur}',  '{tutor}',              st_setsrid(st_makepoint(73.0050, 33.7000), 4326)::geography, 12,'{"mon":["15:00","21:00"],"tue":["15:00","21:00"],"wed":["15:00","21:00"],"thu":["15:00","21:00"],"fri":["15:00","21:00"],"sat":["10:00","18:00"]}'::jsonb,'{"tutor":{"min":1500,"max":4000}}'::jsonb, 4.9, 67, 8, '1 hour', true, 'self_onboarded', true),
  ('Math Mastery',         'math-mastery',        '+92 300 555 0111', true, '{en}',     '{tutor}',              st_setsrid(st_makepoint(72.9900, 33.6900), 4326)::geography, 15,'{"mon":["16:00","20:00"],"tue":["16:00","20:00"],"wed":["16:00","20:00"],"thu":["16:00","20:00"],"fri":["16:00","20:00"]}'::jsonb,'{"tutor":{"min":2000,"max":5000}}'::jsonb, 4.7, 45, 12, '1 hour', true, 'self_onboarded', false),
  ('Science Sphere',       'science-sphere',      '+92 300 555 0112', true, '{en,ur}',  '{tutor}',              st_setsrid(st_makepoint(73.0479, 33.6844), 4326)::geography, 10,'{"mon":["14:00","20:00"],"tue":["14:00","20:00"],"wed":["14:00","20:00"],"thu":["14:00","20:00"],"fri":["14:00","20:00"],"sat":["10:00","18:00"]}'::jsonb,'{"tutor":{"min":1800,"max":4500}}'::jsonb, 4.6, 38, 15, '1 hour', true, 'self_onboarded', true),
  -- Beauticians
  ('Glamour Studio',       'glamour-studio',      '+92 300 555 0113', true, '{en,ur}',  '{beautician}',         st_setsrid(st_makepoint(73.0479, 33.6844), 4326)::geography, 8, '{"mon":["10:00","20:00"],"tue":["10:00","20:00"],"wed":["10:00","20:00"],"thu":["10:00","20:00"],"fri":["10:00","20:00"],"sat":["09:00","20:00"]}'::jsonb,'{"beautician":{"min":1500,"max":5000}}'::jsonb, 4.7, 89, 10, '2 hours', true, 'self_onboarded', true),
  ('Bridal Bliss',         'bridal-bliss',        '+92 300 555 0114', true, '{en,ur}',  '{beautician}',         st_setsrid(st_makepoint(72.9930, 33.7160), 4326)::geography, 10,'{"mon":["09:00","19:00"],"tue":["09:00","19:00"],"wed":["09:00","19:00"],"thu":["09:00","19:00"],"fri":["09:00","19:00"],"sat":["09:00","19:00"]}'::jsonb,'{"beautician":{"min":2500,"max":8000}}'::jsonb, 4.8, 124, 9, '2 hours 30 minutes', true, 'self_onboarded', true),
  ('Hair Haven',           'hair-haven',          '+92 300 555 0115', true, '{ur}',     '{beautician}',         st_setsrid(st_makepoint(72.9580, 33.6470), 4326)::geography, 5, '{"mon":["10:00","18:00"],"tue":["10:00","18:00"],"wed":["10:00","18:00"],"thu":["10:00","18:00"],"fri":["10:00","18:00"]}'::jsonb,'{"beautician":{"min":1000,"max":3000}}'::jsonb, 4.4, 32, 18, '1 hour 30 minutes', true, 'self_onboarded', false),
  -- Carpenters
  ('Wood Works',           'wood-works',          '+92 300 555 0116', true, '{en,ur}',  '{carpenter}',          st_setsrid(st_makepoint(73.0479, 33.6844), 4326)::geography, 15,'{"mon":["08:00","18:00"],"tue":["08:00","18:00"],"wed":["08:00","18:00"],"thu":["08:00","18:00"],"fri":["08:00","18:00"],"sat":["08:00","14:00"]}'::jsonb,'{"carpenter":{"min":2000,"max":6000}}'::jsonb, 4.5, 27, 24, '3 hours', true, 'self_onboarded', true),
  ('Modern Furniture Fix', 'modern-furniture-fix','+92 300 555 0117', true, '{ur}',     '{carpenter}',          st_setsrid(st_makepoint(72.9580, 33.6470), 4326)::geography, 8, '{"mon":["09:00","18:00"],"tue":["09:00","18:00"],"wed":["09:00","18:00"],"thu":["09:00","18:00"],"fri":["09:00","18:00"]}'::jsonb,'{"carpenter":{"min":1500,"max":4500}}'::jsonb, 4.3, 14, 30, '2 hours 30 minutes', true, 'self_onboarded', false),
  -- Car Wash
  ('Sparkle Wash',         'sparkle-wash',        '+92 300 555 0118', true, '{en,ur}',  '{car_wash}',           st_setsrid(st_makepoint(73.0479, 33.6844), 4326)::geography, 10,'{"mon":["08:00","20:00"],"tue":["08:00","20:00"],"wed":["08:00","20:00"],"thu":["08:00","20:00"],"fri":["08:00","20:00"],"sat":["08:00","20:00"],"sun":["10:00","18:00"]}'::jsonb,'{"car_wash":{"min":500,"max":2000}}'::jsonb, 4.6, 76, 8, '1 hour', true, 'self_onboarded', true),
  ('Sector G Auto Care',   'sector-g-auto',       '+92 300 555 0119', true, '{ur}',     '{car_wash}',           st_setsrid(st_makepoint(72.9580, 33.6470), 4326)::geography, 7, '{"mon":["09:00","19:00"],"tue":["09:00","19:00"],"wed":["09:00","19:00"],"thu":["09:00","19:00"],"fri":["09:00","19:00"],"sat":["09:00","19:00"]}'::jsonb,'{"car_wash":{"min":400,"max":1500}}'::jsonb, 4.2, 41, 12, '1 hour', true, 'self_onboarded', false),
  -- Mobile Repair
  ('Phone Doctor',         'phone-doctor',        '+92 300 555 0120', true, '{en,ur}',  '{mobile_repair}',      st_setsrid(st_makepoint(73.0479, 33.6844), 4326)::geography, 10,'{"mon":["10:00","21:00"],"tue":["10:00","21:00"],"wed":["10:00","21:00"],"thu":["10:00","21:00"],"fri":["10:00","21:00"],"sat":["11:00","20:00"]}'::jsonb,'{"mobile_repair":{"min":500,"max":5000}}'::jsonb, 4.8, 103, 6, '45 minutes', true, 'self_onboarded', true),
  ('Mobile Master',        'mobile-master',       '+92 300 555 0121', true, '{en}',     '{mobile_repair}',      st_setsrid(st_makepoint(72.9930, 33.7160), 4326)::geography, 12,'{"mon":["11:00","20:00"],"tue":["11:00","20:00"],"wed":["11:00","20:00"],"thu":["11:00","20:00"],"fri":["11:00","20:00"],"sat":["11:00","20:00"]}'::jsonb,'{"mobile_repair":{"min":600,"max":4500}}'::jsonb, 4.6, 58, 9, '1 hour', true, 'self_onboarded', true),
  ('Quick Fix Cell',       'quick-fix-cell',      '+92 300 555 0122', true, '{ur}',     '{mobile_repair}',      st_setsrid(st_makepoint(72.9580, 33.6470), 4326)::geography, 6, '{"mon":["12:00","20:00"],"tue":["12:00","20:00"],"wed":["12:00","20:00"],"thu":["12:00","20:00"],"fri":["12:00","20:00"],"sat":["12:00","20:00"]}'::jsonb,'{"mobile_repair":{"min":400,"max":3000}}'::jsonb, 4.3, 26, 15, '1 hour', true, 'self_onboarded', false),
  -- Multi-category providers (8 more bringing total to 30)
  ('All-in-One Home Pro',  'all-in-one-home',     '+92 300 555 0123', true, '{en,ur}',  '{plumber,electrician,carpenter}', st_setsrid(st_makepoint(73.0479, 33.6844), 4326)::geography, 15,'{"mon":["08:00","20:00"],"tue":["08:00","20:00"],"wed":["08:00","20:00"],"thu":["08:00","20:00"],"fri":["08:00","20:00"],"sat":["09:00","18:00"]}'::jsonb,'{"plumber":{"min":1000,"max":2500},"electrician":{"min":1200,"max":2800},"carpenter":{"min":2500,"max":6500}}'::jsonb, 4.7, 88, 10, '1 hour 30 minutes', true, 'self_onboarded', true),
  ('Cool & Clean',         'cool-and-clean',      '+92 300 555 0124', true, '{en,ur}',  '{ac_repair,car_wash}', st_setsrid(st_makepoint(72.9900, 33.6900), 4326)::geography, 10,'{"mon":["08:00","19:00"],"tue":["08:00","19:00"],"wed":["08:00","19:00"],"thu":["08:00","19:00"],"fri":["08:00","19:00"],"sat":["08:00","17:00"]}'::jsonb,'{"ac_repair":{"min":1800,"max":3000},"car_wash":{"min":600,"max":1800}}'::jsonb, 4.4, 33, 16, '1 hour 30 minutes', true, 'self_onboarded', false),
  ('Master Tutors Hub',    'master-tutors',       '+92 300 555 0125', true, '{en,ur}',  '{tutor}',              st_setsrid(st_makepoint(72.9580, 33.6470), 4326)::geography, 12,'{"mon":["14:00","21:00"],"tue":["14:00","21:00"],"wed":["14:00","21:00"],"thu":["14:00","21:00"],"fri":["14:00","21:00"],"sat":["10:00","19:00"]}'::jsonb,'{"tutor":{"min":2200,"max":5500}}'::jsonb, 4.8, 95, 7, '1 hour 30 minutes', true, 'self_onboarded', true),
  ('Beauty Hub',           'beauty-hub',          '+92 300 555 0126', true, '{en,ur}',  '{beautician}',         st_setsrid(st_makepoint(73.0050, 33.6900), 4326)::geography, 8, '{"mon":["10:00","20:00"],"tue":["10:00","20:00"],"wed":["10:00","20:00"],"thu":["10:00","20:00"],"fri":["10:00","20:00"],"sat":["10:00","20:00"]}'::jsonb,'{"beautician":{"min":1200,"max":4500}}'::jsonb, 4.5, 47, 13, '1 hour 30 minutes', true, 'self_onboarded', false),
  ('PipeFix Plumbing',     'pipefix-plumbing',    '+92 300 555 0127', true, '{en,ur}',  '{plumber}',            st_setsrid(st_makepoint(73.0250, 33.7100), 4326)::geography, 10,'{"mon":["07:00","22:00"],"tue":["07:00","22:00"],"wed":["07:00","22:00"],"thu":["07:00","22:00"],"fri":["07:00","22:00"],"sat":["07:00","22:00"],"sun":["09:00","18:00"]}'::jsonb,'{"plumber":{"min":1100,"max":2400}}'::jsonb, 4.6, 52, 11, '1 hour', true, 'self_onboarded', true),
  ('VoltMaster',           'voltmaster',          '+92 300 555 0128', true, '{en}',     '{electrician}',        st_setsrid(st_makepoint(73.0700, 33.6900), 4326)::geography, 12,'{"mon":["08:00","18:00"],"tue":["08:00","18:00"],"wed":["08:00","18:00"],"thu":["08:00","18:00"],"fri":["08:00","18:00"]}'::jsonb,'{"electrician":{"min":1400,"max":2700}}'::jsonb, 4.4, 23, 17, '1 hour 30 minutes', true, 'self_onboarded', true),
  ('PolishPro Auto',       'polishpro-auto',      '+92 300 555 0129', true, '{en,ur}',  '{car_wash}',           st_setsrid(st_makepoint(72.9580, 33.6470), 4326)::geography, 8, '{"mon":["09:00","20:00"],"tue":["09:00","20:00"],"wed":["09:00","20:00"],"thu":["09:00","20:00"],"fri":["09:00","20:00"],"sat":["09:00","20:00"]}'::jsonb,'{"car_wash":{"min":700,"max":2500}}'::jsonb, 4.5, 39, 14, '1 hour 30 minutes', true, 'self_onboarded', false),
  ('TechFix Mobile',       'techfix-mobile',      '+92 300 555 0130', true, '{en,ur}',  '{mobile_repair}',      st_setsrid(st_makepoint(73.0479, 33.6844), 4326)::geography, 10,'{"mon":["10:00","21:00"],"tue":["10:00","21:00"],"wed":["10:00","21:00"],"thu":["10:00","21:00"],"fri":["10:00","21:00"],"sat":["11:00","20:00"]}'::jsonb,'{"mobile_repair":{"min":500,"max":3500}}'::jsonb, 4.7, 71, 8, '1 hour', true, 'self_onboarded', true),
  -- Karachi providers (for users in Karachi)
  ('Karachi Car Mechanics','karachi-car-mech',    '+92 300 555 0131', true, '{en,ur}',  '{car_mechanic}',       st_setsrid(st_makepoint(67.0011, 24.8607), 4326)::geography, 15,'{"mon":["09:00","20:00"],"tue":["09:00","20:00"],"wed":["09:00","20:00"],"thu":["09:00","20:00"],"fri":["09:00","20:00"],"sat":["09:00","18:00"]}'::jsonb,'{"car_mechanic":{"min":1500,"max":6000}}'::jsonb, 4.6, 84, 11, '2 hours', true, 'self_onboarded', true),
  ('Engine Wala',          'engine-wala',         '+92 300 555 0132', true, '{ur}',     '{car_mechanic}',       st_setsrid(st_makepoint(67.0301, 24.9000), 4326)::geography, 12,'{"mon":["08:00","19:00"],"tue":["08:00","19:00"],"wed":["08:00","19:00"],"thu":["08:00","19:00"],"fri":["08:00","19:00"],"sat":["08:00","16:00"]}'::jsonb,'{"car_mechanic":{"min":1200,"max":5000}}'::jsonb, 4.3, 41, 16, '2 hours', true, 'self_onboarded', false),
  ('Karachi Home Clean',   'karachi-home-clean',  '+92 300 555 0133', true, '{en,ur}',  '{house_cleaning}',     st_setsrid(st_makepoint(67.0150, 24.8700), 4326)::geography, 10,'{"mon":["08:00","18:00"],"tue":["08:00","18:00"],"wed":["08:00","18:00"],"thu":["08:00","18:00"],"fri":["08:00","18:00"],"sat":["08:00","16:00"]}'::jsonb,'{"house_cleaning":{"min":1000,"max":4000}}'::jsonb, 4.5, 56, 13, '3 hours', true, 'self_onboarded', true),
  ('Saaf Suthra Karachi',  'saaf-suthra-khi',     '+92 300 555 0134', true, '{ur}',     '{house_cleaning}',     st_setsrid(st_makepoint(66.9920, 24.8500), 4326)::geography, 8, '{"mon":["09:00","17:00"],"tue":["09:00","17:00"],"wed":["09:00","17:00"],"thu":["09:00","17:00"],"fri":["09:00","17:00"]}'::jsonb,'{"house_cleaning":{"min":800,"max":3000}}'::jsonb, 4.1, 18, 22, '3 hours', true, 'self_onboarded', false),
  ('Karachi Plumbers',     'karachi-plumbers',    '+92 300 555 0135', true, '{en,ur}',  '{plumber}',            st_setsrid(st_makepoint(67.0500, 24.8800), 4326)::geography, 12,'{"mon":["07:00","20:00"],"tue":["07:00","20:00"],"wed":["07:00","20:00"],"thu":["07:00","20:00"],"fri":["07:00","20:00"],"sat":["08:00","18:00"]}'::jsonb,'{"plumber":{"min":1000,"max":2500}}'::jsonb, 4.7, 92, 9, '1 hour', true, 'self_onboarded', true)
on conflict (slug) do nothing;

-- ============================================================================
-- Backfill extra columns for the 8-factor matching + pricing engine.
-- (Existing rows + the new ones above all get reasonable defaults.)
-- ============================================================================
update public.providers
  set on_time_score      = 0.80 + (random() * 0.15),
      cancellation_rate  = 0.02 + (random() * 0.06),
      risk_score         = 0.05 + (random() * 0.10),
      capacity           = 1,
      base_visit_fee     = 500,
      base_hourly_rate   = case
        when 'beautician' = any(categories) then 1500
        when 'tutor' = any(categories)      then 1200
        when 'cook' = any(categories)       then 1000
        when 'mason' = any(categories)      then 700
        when 'gardening' = any(categories)  then 600
        else 800
      end,
      last_review_at = now() - (random() * interval '60 days')
  where on_time_score = 0.85
    and cancellation_rate = 0.05
    and risk_score = 0.10;

-- Specializations per category (rough taxonomy — provides bonuses for complex jobs)
update public.providers set specializations = '{gas_refill,inverter_ac,split_ac}'
  where 'ac_repair' = any(categories) and array_length(specializations,1) is null;
update public.providers set specializations = '{water_tank,sewerage,fixtures}'
  where 'plumber' = any(categories) and array_length(specializations,1) is null;
update public.providers set specializations = '{wiring,fan_repair,switchboard}'
  where 'electrician' = any(categories) and array_length(specializations,1) is null;
update public.providers set specializations = '{engine,brakes,clutch}'
  where 'car_mechanic' = any(categories) and array_length(specializations,1) is null;
update public.providers set specializations = '{deep_clean,daily,party_setup}'
  where 'house_cleaning' = any(categories) and array_length(specializations,1) is null;

