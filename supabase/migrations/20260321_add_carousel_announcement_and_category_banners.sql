alter table app_settings
add column if not exists homepage_slides jsonb default '[]'::jsonb,
add column if not exists announcement_bar_enabled boolean default false,
add column if not exists announcement_text text,
add column if not exists announcement_link_label text,
add column if not exists announcement_link_href text,
add column if not exists announcement_background text default '#111111',
add column if not exists announcement_text_color text default '#f5f5f5';

update app_settings
set
  homepage_slides = case
    when homepage_slides is null or homepage_slides = '[]'::jsonb then jsonb_build_array(
      jsonb_build_object(
        'id', 'default-hero',
        'badgeText', coalesce(hero_badge_text, 'Cluster Fascination'),
        'title', coalesce(hero_title, 'Adorn Yourself'),
        'highlightText', coalesce(hero_highlight_text, 'In Gold.'),
        'description', coalesce(hero_description, 'Anti-tarnish gold-plated jewellery crafted for everyday elegance. From bracelets to earrings, each piece tells a story.'),
        'ctaLabel', coalesce(hero_cta_label, 'Shop All Collections'),
        'ctaHref', coalesce(hero_cta_href, '/category'),
        'imageUrl', coalesce(hero_image_url, 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1600&q=80'),
        'mobileImageUrl', coalesce(hero_image_url, 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1600&q=80')
      )
    )
    else homepage_slides
  end,
  announcement_background = coalesce(announcement_background, '#111111'),
  announcement_text_color = coalesce(announcement_text_color, '#f5f5f5');

alter table categories
add column if not exists banner_kicker text,
add column if not exists banner_title text,
add column if not exists banner_description text,
add column if not exists banner_image_url text,
add column if not exists banner_mobile_image_url text;
