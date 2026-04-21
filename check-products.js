#!/usr/bin/env node

// Product analysis script - checks for issues in products table
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

async function checkProducts() {
    console.log('🔍 Analyzing products table...\n');

    try {
        // Get all products with related data
        const { data: products, error } = await supabase
            .from('products')
            .select(`
                id, 
                title, 
                slug, 
                status,
                category_id,
                created_at,
                categories(name, slug),
                product_variants(id, sku, price, is_active)
            `)
            .order('created_at');

        if (error) {
            console.error('Error fetching products:', error);
            return;
        }

        console.log(`📊 Found ${products.length} products\n`);

        const issues = {
            missingTitles: [],
            missingSlugs: [],
            malformedSlugs: [],
            duplicateSlugs: [],
            duplicateTitles: [],
            invalidStatus: [],
            orphanedCategories: [],
            noVariants: [],
            inactiveVariants: []
        };

        // 1. Check basic data issues
        console.log('🔍 Checking basic product data...');
        
        for (const product of products) {
            // Missing titles
            if (!product.title || product.title.trim() === '') {
                issues.missingTitles.push(product);
            }

            // Missing slugs
            if (!product.slug || product.slug.trim() === '') {
                issues.missingSlugs.push(product);
            }

            // Malformed slugs
            if (product.slug) {
                const normalized = normalizeSlug(product.title);
                if (product.slug !== normalized) {
                    issues.malformedSlugs.push({
                        ...product,
                        suggestedSlug: normalized
                    });
                }
            }

            // Invalid status
            const validStatuses = ['draft', 'active', 'archived'];
            if (product.status && !validStatuses.includes(product.status)) {
                issues.invalidStatus.push(product);
            }

            
            // Orphaned categories
            if (product.category_id && !product.categories) {
                issues.orphanedCategories.push(product);
            }
        }

        // 2. Check for duplicate slugs
        console.log('🔍 Checking for duplicate slugs...');
        const slugCounts = {};
        products.forEach(product => {
            if (product.slug) {
                slugCounts[product.slug] = (slugCounts[product.slug] || 0) + 1;
            }
        });

        Object.entries(slugCounts).forEach(([slug, count]) => {
            if (count > 1) {
                const duplicateProducts = products.filter(p => p.slug === slug);
                issues.duplicateSlugs.push(duplicateProducts);
            }
        });

        // 3. Check for duplicate titles
        console.log('🔍 Checking for duplicate titles...');
        const titleCounts = {};
        products.forEach(product => {
            if (product.title) {
                titleCounts[product.title] = (titleCounts[product.title] || 0) + 1;
            }
        });

        Object.entries(titleCounts).forEach(([title, count]) => {
            if (count > 1) {
                const duplicateProducts = products.filter(p => p.title === title);
                issues.duplicateTitles.push(duplicateProducts);
            }
        });

        // 4. Check variants
        console.log('🔍 Checking product variants...');
        for (const product of products) {
            const variants = product.product_variants || [];
            
            // No variants
            if (variants.length === 0) {
                issues.noVariants.push(product);
            }

            // All variants inactive
            const activeVariants = variants.filter(v => v.is_active !== false);
            if (variants.length > 0 && activeVariants.length === 0) {
                issues.inactiveVariants.push(product);
            }
        }

        // Report findings
        console.log('\n📋 Product Issues Found:');
        console.log(`  ❌ Missing titles: ${issues.missingTitles.length}`);
        console.log(`  ❌ Missing slugs: ${issues.missingSlugs.length}`);
        console.log(`  ⚠️  Malformed slugs: ${issues.malformedSlugs.length}`);
        console.log(`  🔄 Duplicate slug groups: ${issues.duplicateSlugs.length}`);
        console.log(`  🔄 Duplicate title groups: ${issues.duplicateTitles.length}`);
        console.log(`  ⚠️  Invalid status: ${issues.invalidStatus.length}`);
                console.log(`  👻 Orphaned categories: ${issues.orphanedCategories.length}`);
        console.log(`  📦 No variants: ${issues.noVariants.length}`);
        console.log(`  ⚠️  All variants inactive: ${issues.inactiveVariants.length}`);

        // Show specific issues
        if (issues.missingTitles.length > 0) {
            console.log('\n❌ Products with missing titles:');
            issues.missingTitles.forEach(p => {
                console.log(`  - ${p.id}: "${p.title}"`);
            });
        }

        if (issues.missingSlugs.length > 0) {
            console.log('\n❌ Products with missing slugs:');
            issues.missingSlugs.forEach(p => {
                console.log(`  - ${p.id}: "${p.title}"`);
            });
        }

        if (issues.malformedSlugs.length > 0) {
            console.log('\n⚠️  Products with malformed slugs:');
            issues.malformedSlugs.forEach(p => {
                console.log(`  - "${p.title}": "${p.slug}" -> "${p.suggestedSlug}"`);
            });
        }

        if (issues.duplicateSlugs.length > 0) {
            console.log('\n🔄 Duplicate slug groups:');
            issues.duplicateSlugs.forEach(group => {
                console.log(`  - "${group[0].slug}" (${group.length} products):`);
                group.forEach(p => console.log(`    * ${p.title}`));
            });
        }

        if (issues.duplicateTitles.length > 0) {
            console.log('\n🔄 Duplicate title groups:');
            issues.duplicateTitles.forEach(group => {
                console.log(`  - "${group[0].title}" (${group.length} products):`);
                group.forEach(p => console.log(`    * ${p.slug}`));
            });
        }

        if (issues.invalidStatus.length > 0) {
            console.log('\n⚠️  Products with invalid status:');
            issues.invalidStatus.forEach(p => {
                console.log(`  - "${p.title}": "${p.status}"`);
            });
        }

        if (issues.orphanedCategories.length > 0) {
            console.log('\n👻 Products with orphaned categories:');
            issues.orphanedCategories.forEach(p => {
                console.log(`  - "${p.title}" -> category_id: ${p.category_id}`);
            });
        }

        if (issues.noVariants.length > 0) {
            console.log('\n📦 Products with no variants:');
            issues.noVariants.forEach(p => {
                console.log(`  - "${p.title}"`);
            });
        }

        // Summary
        const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
        
        if (totalIssues === 0) {
            console.log('\n✅ No product issues found! All products are properly formatted.');
        } else {
            console.log(`\n📊 Summary: ${totalIssues} total issues found across ${products.length} products`);
        }

    } catch (error) {
        console.error('❌ Error during product analysis:', error);
    }
}

checkProducts();
