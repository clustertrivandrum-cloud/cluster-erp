-- Remove redundant fields from products table
alter table products drop column if exists product_type;
alter table products drop column if exists vendor;
