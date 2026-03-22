'use client'

import { useMemo, useState } from 'react'
import { BellRing, ChevronLeft, ChevronRight, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import Input from '@/components/ui/Input'
import ImageUpload from '@/components/admin/ImageUpload'
import { type BannerSettings, type HomepageSlide, updateBannerSettings } from '@/lib/actions/banner-actions'

type BannerManagerProps = {
    initialSettings: BannerSettings
}

type TextareaProps = {
    label: string
    value: string
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
    rows?: number
    helperText?: string
}

function Textarea({ label, value, onChange, rows = 4, helperText }: TextareaProps) {
    return (
        <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
            <textarea
                rows={rows}
                className="block w-full rounded-lg border-[1.5px] border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                value={value}
                onChange={onChange}
            />
            {helperText ? <p className="mt-1.5 text-xs text-gray-500">{helperText}</p> : null}
        </div>
    )
}

function createEmptySlide(nextIndex: number): HomepageSlide {
    return {
        id: `hero-${Date.now()}-${nextIndex}`,
        badgeText: 'New Collection',
        title: 'Fresh Drop',
        highlightText: 'Live Now.',
        description: 'Add slide copy, mobile image, and CTA for your next campaign.',
        ctaLabel: 'Shop Now',
        ctaHref: '/category',
        imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1600&q=80',
        mobileImageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=900&q=80',
    }
}

export default function BannerManager({ initialSettings }: BannerManagerProps) {
    const [settings, setSettings] = useState(initialSettings)
    const [selectedSlideIndex, setSelectedSlideIndex] = useState(0)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

    const selectedSlide = settings.slides[selectedSlideIndex] || settings.slides[0]

    const activeAnnouncementPreview = useMemo(() => ({
        text: settings.announcement_text || 'Use the announcement bar to highlight shipping, offers, or launch messages.',
        label: settings.announcement_link_label || 'Learn More',
    }), [settings.announcement_link_label, settings.announcement_text])

    const updateSlide = (index: number, patch: Partial<HomepageSlide>) => {
        setSettings((current) => ({
            ...current,
            slides: current.slides.map((slide, slideIndex) =>
                slideIndex === index ? { ...slide, ...patch } : slide
            ),
        }))
    }

    const handleSave = async () => {
        setSaving(true)
        setFeedback(null)

        const formData = new FormData()
        formData.append('homepage_slides', JSON.stringify(settings.slides))
        formData.append('announcement_bar_enabled', String(settings.announcement_bar_enabled))
        formData.append('announcement_text', settings.announcement_text)
        formData.append('announcement_link_label', settings.announcement_link_label)
        formData.append('announcement_link_href', settings.announcement_link_href)
        formData.append('announcement_background', settings.announcement_background)
        formData.append('announcement_text_color', settings.announcement_text_color)
        formData.append('promise_kicker_text', settings.promise_kicker_text)
        formData.append('promise_title', settings.promise_title)
        formData.append('promise_description', settings.promise_description)
        formData.append('promise_image_url', settings.promise_image_url)

        const result = await updateBannerSettings(formData)
        setSaving(false)

        if (!result.success) {
            setFeedback({ tone: 'error', text: result.error || 'Could not save banner settings.' })
            return
        }

        setFeedback({ tone: 'success', text: 'Banner settings updated.' })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="rounded-xl bg-gray-900 p-3 text-white">
                    <ImagePlus className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
                    <p className="text-sm text-gray-500">Manage the homepage carousel, mobile banners, announcement bar, and promise section.</p>
                </div>
            </div>

            {feedback ? (
                <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    {feedback.text}
                </div>
            ) : null}

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <BellRing className="h-5 w-5 text-gray-700" />
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Announcement Bar</h2>
                            <p className="text-sm text-gray-500">Optional top strip for offers, delivery messages, or launches.</p>
                        </div>
                    </div>
                </div>
                <div className="grid gap-6 p-5 xl:grid-cols-[1.2fr,0.8fr]">
                    <div className="space-y-5">
                        <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={settings.announcement_bar_enabled}
                                onChange={(event) => setSettings((current) => ({ ...current, announcement_bar_enabled: event.target.checked }))}
                            />
                            Show announcement bar on storefront
                        </label>
                        <Textarea
                            label="Announcement Text"
                            value={settings.announcement_text}
                            onChange={(event) => setSettings((current) => ({ ...current, announcement_text: event.target.value }))}
                            rows={3}
                        />
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Link Label"
                                value={settings.announcement_link_label}
                                onChange={(event) => setSettings((current) => ({ ...current, announcement_link_label: event.target.value }))}
                                placeholder="Shop now"
                            />
                            <Input
                                label="Link Href"
                                value={settings.announcement_link_href}
                                onChange={(event) => setSettings((current) => ({ ...current, announcement_link_href: event.target.value }))}
                                placeholder="/category/new-arrivals"
                            />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Background Color"
                                value={settings.announcement_background}
                                onChange={(event) => setSettings((current) => ({ ...current, announcement_background: event.target.value }))}
                                placeholder="#111111"
                            />
                            <Input
                                label="Text Color"
                                value={settings.announcement_text_color}
                                onChange={(event) => setSettings((current) => ({ ...current, announcement_text_color: event.target.value }))}
                                placeholder="#f5f5f5"
                            />
                        </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-gray-200">
                        <div
                            className="flex min-h-[124px] flex-col items-center justify-center gap-2 px-6 py-5 text-center"
                            style={{
                                backgroundColor: settings.announcement_background || '#111111',
                                color: settings.announcement_text_color || '#f5f5f5',
                            }}
                        >
                            <span className="text-xs uppercase tracking-[0.3em] opacity-70">Announcement Preview</span>
                            <p className="max-w-md text-sm font-medium">{activeAnnouncementPreview.text}</p>
                            {settings.announcement_link_label ? (
                                <span className="text-xs uppercase tracking-[0.25em] underline underline-offset-4">
                                    {activeAnnouncementPreview.label}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                <div className="space-y-6">
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Homepage Carousel</h2>
                                <p className="text-sm text-gray-500">Up to 5 slides. The first slide stays synced with the legacy hero fields.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (settings.slides.length >= 5) return
                                    const nextSlides = [...settings.slides, createEmptySlide(settings.slides.length + 1)]
                                    setSettings((current) => ({ ...current, slides: nextSlides }))
                                    setSelectedSlideIndex(nextSlides.length - 1)
                                }}
                                disabled={settings.slides.length >= 5}
                                className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                <Plus className="mr-2 h-3.5 w-3.5" />
                                Add Slide
                            </button>
                        </div>
                        <div className="space-y-5 p-5">
                            <div className="space-y-3">
                                {settings.slides.map((slide, index) => (
                                    <div
                                        key={slide.id}
                                        className={`flex items-start justify-between rounded-xl border px-4 py-3 transition-colors ${selectedSlideIndex === index ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSlideIndex(index)}
                                                className="text-left"
                                            >
                                                <div className="text-xs uppercase tracking-[0.25em] text-gray-400">Slide {index + 1}</div>
                                                <div className="mt-1 text-sm font-semibold text-gray-900">{slide.title}</div>
                                                <div className="mt-1 text-xs text-gray-500">{slide.ctaLabel} {'->'} {slide.ctaHref}</div>
                                            </button>
                                        </div>
                                        {settings.slides.length > 1 ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const nextSlides = settings.slides.filter((_, slideIndex) => slideIndex !== index)
                                                    setSettings((current) => ({ ...current, slides: nextSlides }))
                                                    setSelectedSlideIndex((current) => Math.max(0, Math.min(current, nextSlides.length - 1)))
                                                }}
                                                className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                            </div>

                            {selectedSlide ? (
                                <div className="space-y-5 rounded-2xl border border-gray-200 p-5">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Input
                                            label="Badge Text"
                                            value={selectedSlide.badgeText}
                                            onChange={(event) => updateSlide(selectedSlideIndex, { badgeText: event.target.value })}
                                        />
                                        <Input
                                            label="CTA Label"
                                            value={selectedSlide.ctaLabel}
                                            onChange={(event) => updateSlide(selectedSlideIndex, { ctaLabel: event.target.value })}
                                        />
                                        <Input
                                            label="Title"
                                            value={selectedSlide.title}
                                            onChange={(event) => updateSlide(selectedSlideIndex, { title: event.target.value })}
                                        />
                                        <Input
                                            label="Highlight Text"
                                            value={selectedSlide.highlightText}
                                            onChange={(event) => updateSlide(selectedSlideIndex, { highlightText: event.target.value })}
                                        />
                                    </div>
                                    <Textarea
                                        label="Description"
                                        value={selectedSlide.description}
                                        onChange={(event) => updateSlide(selectedSlideIndex, { description: event.target.value })}
                                    />
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Input
                                            label="CTA Link"
                                            value={selectedSlide.ctaHref}
                                            onChange={(event) => updateSlide(selectedSlideIndex, { ctaHref: event.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-5">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-gray-700">Desktop Banner Image</label>
                                            <ImageUpload
                                                value={selectedSlide.imageUrl ? [selectedSlide.imageUrl] : []}
                                                onChange={(url) => updateSlide(selectedSlideIndex, { imageUrl: url })}
                                                onRemove={() => updateSlide(selectedSlideIndex, { imageUrl: '' })}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-gray-700">Mobile Banner Image</label>
                                            <ImageUpload
                                                value={selectedSlide.mobileImageUrl ? [selectedSlide.mobileImageUrl] : []}
                                                onChange={(url) => updateSlide(selectedSlideIndex, { mobileImageUrl: url })}
                                                onRemove={() => updateSlide(selectedSlideIndex, { mobileImageUrl: '' })}
                                            />
                                            <p className="mt-1.5 text-xs text-gray-500">Used on mobile homepage views below the `md` breakpoint.</p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-200 px-5 py-4">
                            <h2 className="text-lg font-semibold text-gray-900">Brand Promise Banner</h2>
                        </div>
                        <div className="space-y-5 p-5">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Input
                                    label="Kicker"
                                    value={settings.promise_kicker_text}
                                    onChange={(event) => setSettings((current) => ({ ...current, promise_kicker_text: event.target.value }))}
                                />
                                <Input
                                    label="Title"
                                    value={settings.promise_title}
                                    onChange={(event) => setSettings((current) => ({ ...current, promise_title: event.target.value }))}
                                />
                            </div>
                            <Textarea
                                label="Description"
                                value={settings.promise_description}
                                onChange={(event) => setSettings((current) => ({ ...current, promise_description: event.target.value }))}
                            />
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">Promise Banner Image</label>
                                <ImageUpload
                                    value={settings.promise_image_url ? [settings.promise_image_url] : []}
                                    onChange={(url) => setSettings((current) => ({ ...current, promise_image_url: url }))}
                                    onRemove={() => setSettings((current) => ({ ...current, promise_image_url: '' }))}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                            <h2 className="text-lg font-semibold text-gray-900">Carousel Preview</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedSlideIndex((current) => Math.max(0, current - 1))}
                                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedSlideIndex((current) => Math.min(settings.slides.length - 1, current + 1))}
                                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        {selectedSlide ? (
                            <div className="p-5">
                                <div className="relative min-h-[420px] overflow-hidden rounded-2xl bg-gray-950 text-white">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={selectedSlide.imageUrl}
                                        alt="Slide preview"
                                        className="absolute inset-0 hidden h-full w-full object-cover md:block"
                                    />
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={selectedSlide.mobileImageUrl || selectedSlide.imageUrl}
                                        alt="Mobile slide preview"
                                        className="absolute inset-0 h-full w-full object-cover md:hidden"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
                                    <div className="absolute inset-x-0 bottom-0 space-y-4 p-6">
                                        <span className="inline-flex border border-amber-300/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-amber-300">
                                            {selectedSlide.badgeText}
                                        </span>
                                        <div className="text-4xl font-semibold leading-tight text-white">
                                            {selectedSlide.title}
                                            <br />
                                            <span className="text-amber-300">{selectedSlide.highlightText}</span>
                                        </div>
                                        <p className="max-w-md text-sm leading-6 text-gray-200">{selectedSlide.description}</p>
                                        <div className="inline-flex rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-gray-950">
                                            {selectedSlide.ctaLabel}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-center gap-2">
                                    {settings.slides.map((slide, index) => (
                                        <button
                                            key={slide.id}
                                            type="button"
                                            onClick={() => setSelectedSlideIndex(index)}
                                            className={`h-2.5 rounded-full transition-all ${index === selectedSlideIndex ? 'w-8 bg-gray-900' : 'w-2.5 bg-gray-300'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-200 px-5 py-4">
                            <h2 className="text-lg font-semibold text-gray-900">Promise Preview</h2>
                        </div>
                        <div className="grid gap-0 md:grid-cols-2">
                            <div className="relative min-h-[260px]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={settings.promise_image_url}
                                    alt="Promise preview"
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            </div>
                            <div className="flex flex-col justify-center gap-4 p-6">
                                <span className="text-xs uppercase tracking-[0.3em] text-emerald-600">{settings.promise_kicker_text}</span>
                                <h3 className="text-3xl font-semibold leading-tight text-gray-900">{settings.promise_title}</h3>
                                <p className="text-sm leading-6 text-gray-600">{settings.promise_description}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Banner Settings'}
                </button>
            </div>
        </div>
    )
}
