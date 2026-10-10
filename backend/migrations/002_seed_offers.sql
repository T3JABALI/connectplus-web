-- Sample Safaricom catalogue. Prices are placeholders: edit them here before first deploy,
-- or change the offers table later. provider_code is filled in once you know your provider's codes.
INSERT INTO offers (id, cat, net, size, title, valid, price_cents, color, sort) VALUES
  ('d1', 'data',    'safaricom', '1GB',       '1GB Data',      'for 24 hours',   5000, '#16a34a', 10),
  ('d2', 'data',    'safaricom', '250MB',     '250MB Data',    'for 24 hours',   2000, '#1565e8', 20),
  ('d3', 'data',    'safaricom', '400MB',     '400MB Data',    'for 7 days',     4900, '#7c3aed', 30),
  ('d4', 'data',    'safaricom', '1.5GB',     '1.5GB Data',    'for 3 hours',    5000, '#f97316', 40),
  ('d5', 'data',    'safaricom', '1.25GB',    '1.25GB Data',   'until midnight', 5500, '#e11d74', 50),
  ('s1', 'sms',     'safaricom', '200',       '200 SMS',       'for 24 hours',   1000, '#1565e8', 60),
  ('s2', 'sms',     'safaricom', '1000',      '1,000 SMS',     'for 7 days',     3000, '#7c3aed', 70),
  ('m1', 'min',     'safaricom', '50 min',    '50 Minutes',    'until midnight', 5100, '#f97316', 80),
  ('m2', 'min',     'safaricom', '100 min',   '100 Minutes',   'for 7 days',     9900, '#e11d74', 90),
  ('x1', 'special', 'safaricom', '3GB + SMS', 'Weekend Combo', 'Sat to Sun',    10000, '#e11d74', 100)
ON CONFLICT (id) DO NOTHING;
