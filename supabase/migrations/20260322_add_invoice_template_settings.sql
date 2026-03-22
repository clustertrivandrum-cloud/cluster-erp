alter table app_settings
add column if not exists invoice_template jsonb default jsonb_build_object(
  'layout', 'modern',
  'accentColor', '#111827',
  'surfaceColor', '#f5f1ea',
  'headerLabel', 'Order Invoice',
  'heroTitle', 'Thanks for shopping with us',
  'heroMessage', 'Welcome to Cluster Fascination. Discover our trending products and enjoy every purchase.',
  'footerNote', 'Thank you for shopping with Cluster Fascination.',
  'termsTitle', 'Terms & Notes',
  'termsBody', 'Goods once sold will be exchanged or serviced only as per store policy.',
  'showPaymentStatus', true,
  'showCustomerType', true,
  'showNotes', true
);

update app_settings
set invoice_template = coalesce(
  invoice_template,
  jsonb_build_object(
    'layout', 'modern',
    'accentColor', '#111827',
    'surfaceColor', '#f5f1ea',
    'headerLabel', 'Order Invoice',
    'heroTitle', 'Thanks for shopping with us',
    'heroMessage', 'Welcome to Cluster Fascination. Discover our trending products and enjoy every purchase.',
    'footerNote', 'Thank you for shopping with Cluster Fascination.',
    'termsTitle', 'Terms & Notes',
    'termsBody', 'Goods once sold will be exchanged or serviced only as per store policy.',
    'showPaymentStatus', true,
    'showCustomerType', true,
    'showNotes', true
  )
);
