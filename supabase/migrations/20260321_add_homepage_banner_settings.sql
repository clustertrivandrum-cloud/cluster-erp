alter table app_settings
add column if not exists hero_badge_text text default 'Cluster Fascination',
add column if not exists hero_title text default 'Adorn Yourself',
add column if not exists hero_highlight_text text default 'In Gold.',
add column if not exists hero_description text default 'Anti-tarnish gold-plated jewellery crafted for everyday elegance. From bracelets to earrings, each piece tells a story.',
add column if not exists hero_cta_label text default 'Shop All Collections',
add column if not exists hero_cta_href text default '/category',
add column if not exists hero_image_url text default 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1600&q=80',
add column if not exists promise_kicker_text text default 'Our Promise',
add column if not exists promise_title text default 'Gold That Lasts.',
add column if not exists promise_description text default 'Every piece in our collection is 18K gold-plated and anti-tarnish — built to maintain its shine through daily wear. No nickel, no compromises. Just timeless jewellery made for real life.',
add column if not exists promise_image_url text default 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=800&q=80';

update app_settings
set
  hero_badge_text = coalesce(hero_badge_text, 'Cluster Fascination'),
  hero_title = coalesce(hero_title, 'Adorn Yourself'),
  hero_highlight_text = coalesce(hero_highlight_text, 'In Gold.'),
  hero_description = coalesce(hero_description, 'Anti-tarnish gold-plated jewellery crafted for everyday elegance. From bracelets to earrings, each piece tells a story.'),
  hero_cta_label = coalesce(hero_cta_label, 'Shop All Collections'),
  hero_cta_href = coalesce(hero_cta_href, '/category'),
  hero_image_url = coalesce(hero_image_url, 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1600&q=80'),
  promise_kicker_text = coalesce(promise_kicker_text, 'Our Promise'),
  promise_title = coalesce(promise_title, 'Gold That Lasts.'),
  promise_description = coalesce(promise_description, 'Every piece in our collection is 18K gold-plated and anti-tarnish — built to maintain its shine through daily wear. No nickel, no compromises. Just timeless jewellery made for real life.'),
  promise_image_url = coalesce(promise_image_url, 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=800&q=80');
