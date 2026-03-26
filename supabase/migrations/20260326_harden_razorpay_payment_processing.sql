create unique index if not exists payments_provider_provider_reference_uidx
  on public.payments(provider, provider_reference)
  where provider_reference is not null;

create or replace function public.complete_order_payment(p_order_id uuid)
returns text
language plpgsql
as $function$
declare
  order_row record;
  item_row record;
  inventory_row record;
begin
  select id, financial_status
  into order_row
  from public.orders
  where id = p_order_id
  for update;

  if order_row.id is null then
    raise exception 'Order not found.';
  end if;

  if lower(coalesce(order_row.financial_status, '')) = 'paid' then
    return 'already_paid';
  end if;

  for item_row in
    select variant_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id
      and variant_id is not null
    group by variant_id
  loop
    select id, location_id, available_quantity, reserved_quantity
    into inventory_row
    from public.inventory_items
    where variant_id = item_row.variant_id
    order by updated_at asc, id asc
    limit 1
    for update;

    if inventory_row.id is null then
      raise exception 'Inventory not found for variant %', item_row.variant_id;
    end if;

    insert into public.inventory_movements (variant_id, location_id, quantity, movement_type, reference_id)
    values (item_row.variant_id, inventory_row.location_id, -item_row.quantity, 'sale', p_order_id);

    update public.inventory_items
    set available_quantity = greatest(coalesce(available_quantity, 0) - item_row.quantity, 0),
        reserved_quantity = greatest(coalesce(reserved_quantity, 0) - item_row.quantity, 0),
        updated_at = now()
    where id = inventory_row.id;
  end loop;

  update public.orders
  set financial_status = 'paid',
      fulfillment_status = 'processing'
  where id = p_order_id;

  update public.preorders
  set status = 'fulfilled'
  where order_id = p_order_id
    and coalesce(status, '') <> 'cancelled';

  return 'paid';
end;
$function$;
