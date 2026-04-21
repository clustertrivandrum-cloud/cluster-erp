#!/usr/bin/env node

// Category fix script - runs from cluster-erp directory
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
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
            .from('categories')
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

async function fixCategories() {
    console.log('🔧 Starting category fixes...\n');

    try {
        const { data: categories, error } = await supabase
            .from('categories')
            .select('id, name, slug, parent_id')
            .order('created_at');

        if (error) {
            console.error('Error fetching categories:', error);
            return;
        }

        console.log(`📊 Found ${categories.length} categories\n`);

        let fixedCount = 0;

        for (const category of categories) {
            let needsUpdate = false;
            let updates = {};

            // Fix missing name
            if (!category.name || category.name.trim() === '') {
                updates.name = `Category ${category.id.slice(0, 8)}`;
                needsUpdate = true;
                console.log(`📝 Fixing missing name for ${category.id}`);
            }

            // Fix missing or malformed slug
            if (!category.slug || category.slug.trim() === '') {
                const baseSlug = normalizeSlug(updates.name || category.name || `category-${category.id.slice(0, 8)}`);
                updates.slug = await generateUniqueSlug(baseSlug, category.id);
                needsUpdate = true;
                console.log(`📝 Fixing missing slug: "${updates.name || category.name}" -> "${updates.slug}"`);
            } else {
                const normalized = normalizeSlug(category.name);
                if (category.slug !== normalized) {
                    updates.slug = await generateUniqueSlug(normalized, category.id);
                    needsUpdate = true;
                    console.log(`📝 Fixing malformed slug: "${category.name}" "${category.slug}" -> "${updates.slug}"`);
                }
            }

            // Fix self-reference
            if (category.parent_id === category.id) {
                updates.parent_id = null;
                needsUpdate = true;
                console.log(`📝 Fixing self-reference: "${category.name}" -> top-level`);
            }

            // Apply updates
            if (needsUpdate) {
                const { error: updateError } = await supabase
                    .from('categories')
                    .update(updates)
                    .eq('id', category.id);

                if (updateError) {
                    console.error(`❌ Error updating ${category.id}:`, updateError);
                } else {
                    fixedCount++;
                }
            }
        }

        // Check for orphaned categories
        console.log('\n🔍 Checking for orphaned categories...');
        const categoryIds = new Set(categories.map(c => c.id));
        
        for (const category of categories) {
            if (category.parent_id && !categoryIds.has(category.parent_id)) {
                const { error } = await supabase
                    .from('categories')
                    .update({ parent_id: null })
                    .eq('id', category.id);

                if (error) {
                    console.error(`❌ Error fixing orphaned ${category.id}:`, error);
                } else {
                    console.log(`📝 Fixed orphaned: "${category.name}" -> top-level`);
                    fixedCount++;
                }
            }
        }

        console.log(`\n🎉 Successfully fixed ${fixedCount} categories!`);
        console.log('✅ All category issues resolved!');

    } catch (error) {
        console.error('❌ Error during fixes:', error);
    }
}

fixCategories();
