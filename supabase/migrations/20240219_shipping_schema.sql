-- Migration for Shipping & Return Policy
-- Run this in Supabase SQL Editor

alter table products
add column if not exists shipping_class text default 'standard', -- standard, express, insured-high-value
add column if not exists return_policy text;
