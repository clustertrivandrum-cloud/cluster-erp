-- 20240220_remove_specifications_season.sql
-- Drop specifications and season from products table

alter table products 
drop column if exists specifications,
drop column if exists season;
