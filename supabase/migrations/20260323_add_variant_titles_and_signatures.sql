alter table public.product_variants
add column if not exists title text,
add column if not exists option_signature text;

with variant_metadata as (
    select
        pv.id,
        nullif(
            string_agg(pov.value, ' / ' order by coalesce(po.position, 0), coalesce(pov.position, 0), pov.value),
            ''
        ) as variant_title,
        nullif(
            jsonb_agg(
                jsonb_build_array(lower(trim(po.name)), lower(trim(pov.value)))
                order by coalesce(po.position, 0), coalesce(pov.position, 0), pov.value
            )::text,
            '[]'
        ) as variant_signature
    from public.product_variants pv
    left join public.variant_option_values vov on vov.variant_id = pv.id
    left join public.product_option_values pov on pov.id = vov.option_value_id
    left join public.product_options po on po.id = pov.option_id
    group by pv.id
)
update public.product_variants pv
set
    title = coalesce(variant_metadata.variant_title, 'Default Variant'),
    option_signature = variant_metadata.variant_signature
from variant_metadata
where pv.id = variant_metadata.id;

update public.product_variants
set title = 'Default Variant'
where title is null or btrim(title) = '';

create unique index if not exists idx_variants_product_option_signature
on public.product_variants(product_id, option_signature)
where option_signature is not null;
