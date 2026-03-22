alter table app_settings
add column if not exists free_shipping_threshold numeric(12,2) default 799,
add column if not exists kerala_shipping_charge numeric(12,2) default 49,
add column if not exists other_states_shipping_charge numeric(12,2) default 59;

update app_settings
set
  free_shipping_threshold = coalesce(free_shipping_threshold, 799),
  kerala_shipping_charge = coalesce(kerala_shipping_charge, 49),
  other_states_shipping_charge = coalesce(other_states_shipping_charge, 59)
where true;
