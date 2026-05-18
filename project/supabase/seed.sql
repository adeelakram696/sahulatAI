insert into service_categories(slug, name_en, name_ur, icon, keywords) values
  ('ac_repair','AC Technician','اے سی ٹیکنیشن','snowflake', array['ac','air conditioner','cooling','thanda','gas','kool']),
  ('plumber','Plumber','پلمبر','wrench', array['plumber','pani','leakage','pipe','tap','nal']),
  ('electrician','Electrician','الیکٹریشن','zap', array['electrician','wiring','bijli','meter','switch','light']),
  ('tutor','Tutor','استاد','book-open', array['tutor','teacher','ustad','math','physics','english']),
  ('beautician','Beautician','بیوٹیشن','sparkles', array['beautician','salon','makeup','hair','threading']),
  ('carpenter','Carpenter','بڑھئی','hammer', array['carpenter','furniture','wood','barhai']),
  ('car_wash','Car Wash','کار واش','car', array['car wash','dhulai','detailing']),
  ('mobile_repair','Mobile Repair','موبائل ریپیئر','smartphone', array['mobile','phone','screen','battery']);

-- Dummy providers, bookings, and agent traces will be added here
-- For the demo seed, some valid auth user IDs would be needed, so we'll leave this basic for now and populate in seed-auth.ts where possible.
