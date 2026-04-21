#!/usr/bin/env node

// Product fix script - fixes all product issues
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeSlug(value) {
    return (value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(baseSlug, excludeId) {
    let slug = baseSlug;
    let counter = 1;
    
    while (true) {
        const { data, error } = await supabase
            .from('products')
            .select('id')
            .eq('slug', slug)
            .neq('id', excludeId || '')
            .single();
        
        if (error && error.code === 'PGRST116') {
            return slug;
        }
        
        if (error) {
            console.error('Error checking slug uniqueness:', error);
            throw error;
        }
        
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
}

async function fixProducts() {
    console.log('🔧 Starting product fixes...\n');

    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, title, slug, status, category_id')
            .order('created_at');

        if (error) {
            console.error('Error fetching products:', error);
            return;
        }

        console.log(`📊 Found ${products.length} products\n`);

        let fixedCount = 0;

        for (const product of products) {
            let needsUpdate = false;
            let updates = {};

            // Fix missing title
            if (!product.title || product.title.trim() === '') {
                updates.title = `Product ${product.id.slice(0, 8)}`;
                needsUpdate = true;
                console.log(`📝 Fixing missing title for ${product.id}`);
            }

            // Fix missing or malformed slug
            if (!product.slug || product.slug.trim() === '') {
                const baseSlug = normalizeSlug(updates.title || product.title || `product-${product.id.slice(0, 8)}`);
                updates.slug = await generateUniqueSlug(baseSlug, product.id);
                needsUpdate = true;
                console.log(`📝 Fixing missing slug: "${updates.title || product.title}" -> "${updates.slug}"`);
            } else {
                const normalized = normalizeSlug(product.title);
                if (product.slug !== normalized) {
                    updates.slug = await generateUniqueSlug(normalized, product.id);
                    needsUpdate = true;
                    console.log(`📝 Fixing malformed slug: "${product.title}" "${product.slug}" -> "${updates.slug}"`);
                }
            }

            // Fix invalid status
            const validStatuses = ['draft', 'active', 'archived'];
            if (product.status && !validStatuses.includes(product.status)) {
                updates.status = 'draft';
                needsUpdate = true;
                console.log(`📝 Fixing invalid status: "${product.title}" "${product.status}" -> "draft"`);
            }

            // Apply updates
            if (needsUpdate) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update(updates)
                    .eq('id', product.id);

                if (updateError) {
                    console.error(`❌ Error updating ${product.id}:`, updateError);
                } else {
                    fixedCount++;
                }
            }
        }

        // Check for orphaned categories
        console.log('\n🔍 Checking for products with orphaned categories...');
        const categoryIds = new Set(products.map(p => p.id));
        
        for (const product of products) {
            if (product.category_id && !categoryIds.has(product.category_id)) {
                const { error } = await supabase
                    .from('products')
                    .update({ category_id: null })
                    .eq('id', product.id);

                if (error) {
                    console.error(`❌ Error fixing orphaned category for ${product.id}:`, error);
                } else {
                    console.log(`📝 Fixed orphaned category: "${product.title}" -> no category`);
                    fixedCount++;
                }
            }
        }

        // Create default variants for products without variants
        console.log('\n🔍 Checking products without variants...');
        
        // Get products with variants first
        const { data: productsWithVariants } = await supabase
            .from('product_variants')
            .select('product_id');

        const productIdsWithVariants = new Set(productsWithVariants?.map(pv => pv.product_id) || []);
        
        // Find products without variants
        const productsWithoutVariants = products.filter(p => !productIdsWithVariants.has(p.id));
        
        console.log(`📦 Found ${productsWithoutVariants.length} products without variants`);

        for (const product of productsWithoutVariants) {
            // Create default variant
            const { error: variantError } = await supabase
                .from('product_variants')
                .insert({
                    product_id: product.id,
                    title: 'Default Variant',
                    option_signature: null,
                    sellable_status: 'draft',
                    is_default: true,
                    variant_rank: 0,
                    price: 0,
                    is_active: true
                });

            if (variantError) {
                console.error(`❌ Error creating variant for ${product.id}:`, variantError);
            } else {
                console.log(`📦 Created default variant for: "${product.title}"`);
                fixedCount++;
            }
        }

        console.log(`\n🎉 Successfully fixed ${fixedCount} products!`);
        console.log('✅ All product issues resolved!');

    } catch (error) {
        console.error('❌ Error during product fixes:', error);
    }
}

fixProducts();
