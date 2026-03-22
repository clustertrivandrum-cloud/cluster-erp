'use server'

import { revalidatePath } from 'next/cache'
import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'

export type HomepageSlide = {
    id: string
    badgeText: string
    title: string
    highlightText: string
    description: string
    ctaLabel: string
    ctaHref: string
    imageUrl: string
    mobileImageUrl: string
}

export type BannerSettings = {
    slides: HomepageSlide[]
    announcement_bar_enabled: boolean
    announcement_text: string
    announcement_link_label: string
    announcement_link_href: string
    announcement_background: string
    announcement_text_color: string
    promise_kicker_text: string
    promise_title: string
    promise_description: string
    promise_image_url: string
}

type AppSettingsBannerRow = {
    homepage_slides?: unknown
    announcement_bar_enabled?: boolean | null
    announcement_text?: string | null
    announcement_link_label?: string | null
    announcement_link_href?: string | null
    announcement_background?: string | null
    announcement_text_color?: string | null
    promise_kicker_text?: string | null
    promise_title?: string | null
    promise_description?: string | null
    promise_image_url?: string | null
    hero_badge_text?: string | null
    hero_title?: string | null
    hero_highlight_text?: string | null
    hero_description?: string | null
    hero_cta_label?: string | null
    hero_cta_href?: string | null
    hero_image_url?: string | null
}

const defaultSlides: HomepageSlide[] = [
    {
        id: 'hero-1',
        badgeText: 'Cluster Fascination',
        title: 'Adorn Yourself',
        highlightText: 'In Gold.',
        description: 'Anti-tarnish gold-plated jewellery crafted for everyday elegance. From bracelets to earrings, each piece tells a story.',
        ctaLabel: 'Shop All Collections',
        ctaHref: '/category',
        imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1600&q=80',
        mobileImageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=900&q=80',
    }
]

const defaultBannerSettings: BannerSettings = {
    slides: defaultSlides,
    announcement_bar_enabled: false,
    announcement_text: '',
    announcement_link_label: '',
    announcement_link_href: '',
    announcement_background: '#111111',
    announcement_text_color: '#f5f5f5',
    promise_kicker_text: 'Our Promise',
    promise_title: 'Gold That Lasts.',
    promise_description: 'Every piece in our collection is 18K gold-plated and anti-tarnish — built to maintain its shine through daily wear. No nickel, no compromises. Just timeless jewellery made for real life.',
    promise_image_url: 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=800&q=80',
}

function normalizeText(value: string | null | undefined, fallback = '') {
    const normalized = value?.trim()
    return normalized || fallback
}

function normalizeSlide(row: Partial<HomepageSlide>, index: number): HomepageSlide {
    const imageUrl = normalizeText(row.imageUrl, defaultSlides[0].imageUrl)
    return {
        id: normalizeText(row.id, `hero-${index + 1}`),
        badgeText: normalizeText(row.badgeText, defaultSlides[0].badgeText),
        title: normalizeText(row.title, defaultSlides[0].title),
        highlightText: normalizeText(row.highlightText, defaultSlides[0].highlightText),
        description: normalizeText(row.description, defaultSlides[0].description),
        ctaLabel: normalizeText(row.ctaLabel, defaultSlides[0].ctaLabel),
        ctaHref: normalizeText(row.ctaHref, defaultSlides[0].ctaHref),
        imageUrl,
        mobileImageUrl: normalizeText(row.mobileImageUrl, imageUrl),
    }
}

function getFallbackSlides(row?: AppSettingsBannerRow | null): HomepageSlide[] {
    if (!row) return defaultSlides

    return [
        normalizeSlide({
            id: 'hero-1',
            badgeText: row.hero_badge_text || undefined,
            title: row.hero_title || undefined,
            highlightText: row.hero_highlight_text || undefined,
            description: row.hero_description || undefined,
            ctaLabel: row.hero_cta_label || undefined,
            ctaHref: row.hero_cta_href || undefined,
            imageUrl: row.hero_image_url || undefined,
            mobileImageUrl: row.hero_image_url || undefined,
        }, 0),
    ]
}

function parseSlides(raw: unknown, row?: AppSettingsBannerRow | null): HomepageSlide[] {
    const slides = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
            ? (() => {
                try {
                    const parsed = JSON.parse(raw)
                    return Array.isArray(parsed) ? parsed : []
                } catch {
                    return []
                }
            })()
            : []

    if (slides.length === 0) {
        return getFallbackSlides(row)
    }

    return slides
        .slice(0, 5)
        .map((slide, index) => normalizeSlide((slide || {}) as Partial<HomepageSlide>, index))
}

export async function getBannerSettings(): Promise<BannerSettings> {
    await requireActionPermission('manage_settings')
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('app_settings')
        .select('homepage_slides, announcement_bar_enabled, announcement_text, announcement_link_label, announcement_link_href, announcement_background, announcement_text_color, promise_kicker_text, promise_title, promise_description, promise_image_url, hero_badge_text, hero_title, hero_highlight_text, hero_description, hero_cta_label, hero_cta_href, hero_image_url')
        .single<AppSettingsBannerRow>()

    if (error || !data) {
        return defaultBannerSettings
    }

    return {
        slides: parseSlides(data.homepage_slides, data),
        announcement_bar_enabled: data.announcement_bar_enabled ?? defaultBannerSettings.announcement_bar_enabled,
        announcement_text: normalizeText(data.announcement_text),
        announcement_link_label: normalizeText(data.announcement_link_label),
        announcement_link_href: normalizeText(data.announcement_link_href),
        announcement_background: normalizeText(data.announcement_background, defaultBannerSettings.announcement_background),
        announcement_text_color: normalizeText(data.announcement_text_color, defaultBannerSettings.announcement_text_color),
        promise_kicker_text: normalizeText(data.promise_kicker_text, defaultBannerSettings.promise_kicker_text),
        promise_title: normalizeText(data.promise_title, defaultBannerSettings.promise_title),
        promise_description: normalizeText(data.promise_description, defaultBannerSettings.promise_description),
        promise_image_url: normalizeText(data.promise_image_url, defaultBannerSettings.promise_image_url),
    }
}

export async function updateBannerSettings(formData: FormData) {
    await requireActionPermission('manage_settings')
    const supabase = await createClient()

    const { data: current, error: currentError } = await supabase
        .from('app_settings')
        .select('id')
        .single<{ id: string }>()

    if (currentError || !current?.id) {
        return { success: false, error: 'Settings not initialized.' }
    }

    let slides = defaultSlides
    const rawSlides = formData.get('homepage_slides')
    if (typeof rawSlides === 'string' && rawSlides.trim()) {
        try {
            slides = parseSlides(JSON.parse(rawSlides))
        } catch {
            return { success: false, error: 'Slides payload is invalid.' }
        }
    }

    const primarySlide = slides[0] || defaultSlides[0]

    const payload = {
        homepage_slides: slides,
        announcement_bar_enabled: formData.get('announcement_bar_enabled') === 'true',
        announcement_text: normalizeText(formData.get('announcement_text') as string | null),
        announcement_link_label: normalizeText(formData.get('announcement_link_label') as string | null),
        announcement_link_href: normalizeText(formData.get('announcement_link_href') as string | null),
        announcement_background: normalizeText(formData.get('announcement_background') as string | null, defaultBannerSettings.announcement_background),
        announcement_text_color: normalizeText(formData.get('announcement_text_color') as string | null, defaultBannerSettings.announcement_text_color),
        promise_kicker_text: normalizeText(formData.get('promise_kicker_text') as string | null, defaultBannerSettings.promise_kicker_text),
        promise_title: normalizeText(formData.get('promise_title') as string | null, defaultBannerSettings.promise_title),
        promise_description: normalizeText(formData.get('promise_description') as string | null, defaultBannerSettings.promise_description),
        promise_image_url: normalizeText(formData.get('promise_image_url') as string | null, defaultBannerSettings.promise_image_url),
        hero_badge_text: primarySlide.badgeText,
        hero_title: primarySlide.title,
        hero_highlight_text: primarySlide.highlightText,
        hero_description: primarySlide.description,
        hero_cta_label: primarySlide.ctaLabel,
        hero_cta_href: primarySlide.ctaHref,
        hero_image_url: primarySlide.imageUrl,
        updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
        .from('app_settings')
        .update(payload)
        .eq('id', current.id)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/admin/banners')
    revalidatePath('/admin/settings')
    revalidatePath('/')
    revalidatePath('/category')
    return { success: true }
}
