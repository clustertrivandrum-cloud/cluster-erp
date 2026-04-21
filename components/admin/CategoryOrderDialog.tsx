'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Loader2, X } from 'lucide-react'
import { getCategoryOrderHierarchy, updateCategoryOrder, type CategoryOrderGroup } from '@/lib/actions/category-actions'

type CategoryOrderItem = {
    id: string
    name: string
    parent_id: string | null
    sort_order: number
}

type SortableCategoryGroup = {
    id: string
    title: string
    parentId: string | null
    items: CategoryOrderItem[]
}

type CategoryOrderDialogProps = {
    onClose: () => void
    onSaved: () => void
}

function createGroupId(parentId: string | null) {
    return parentId ?? 'top-level'
}

function buildGroups(categories: CategoryOrderItem[]): SortableCategoryGroup[] {
    const topLevel = categories.filter((category) => category.parent_id === null)
    const childrenByParent = new Map<string, CategoryOrderItem[]>()

    for (const category of categories) {
        if (!category.parent_id) continue

        const current = childrenByParent.get(category.parent_id) ?? []
        current.push(category)
        childrenByParent.set(category.parent_id, current)
    }

    const groups: SortableCategoryGroup[] = [
        {
            id: createGroupId(null),
            title: 'Top-level categories',
            parentId: null,
            items: topLevel,
        },
    ]

    for (const parent of topLevel) {
        const items = childrenByParent.get(parent.id) ?? []
        if (items.length === 0) continue

        groups.push({
            id: createGroupId(parent.id),
            title: `${parent.name} subcategories`,
            parentId: parent.id,
            items,
        })
    }

    return groups
}

function SortableCategoryRow({
    item,
    groupId,
    onMove,
    isFirst,
    isLast,
}: {
    item: CategoryOrderItem
    groupId: string
    onMove: (id: string, direction: 'up' | 'down') => void
    isFirst: boolean
    isLast: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: item.id,
        data: { groupId },
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm ${isDragging ? 'z-10 opacity-70 border-gray-900 ring-2 ring-gray-900/10' : ''}`}
        >
            <button
                type="button"
                className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/20 touch-none"
                aria-label={`Drag ${item.name}`}
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{item.name}</span>

            {/* Mobile/Touch Fallback Buttons */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    disabled={isFirst}
                    onClick={() => onMove(item.id, 'up')}
                    className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-500 hover:bg-white hover:text-gray-900 disabled:opacity-30"
                    title="Move up"
                >
                    ↑
                </button>
                <button
                    type="button"
                    disabled={isLast}
                    onClick={() => onMove(item.id, 'down')}
                    className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-500 hover:bg-white hover:text-gray-900 disabled:opacity-30"
                    title="Move down"
                >
                    ↓
                </button>
            </div>
        </li>
    )
}


export default function CategoryOrderDialog({ onClose, onSaved }: CategoryOrderDialogProps) {
    const [groups, setGroups] = useState<SortableCategoryGroup[]>([])
    const [initialSignature, setInitialSignature] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isSaving, startSaving] = useTransition()
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const currentSignature = useMemo(() => {
        return JSON.stringify(groups.map((group) => ({
            parentId: group.parentId,
            orderedIds: group.items.map((item) => item.id),
        })))
    }, [groups])

    const isDirty = currentSignature !== initialSignature

    const loadHierarchy = useCallback(async () => {
        setLoading(true)
        setError(null)

        const result = await getCategoryOrderHierarchy()

        if (result.error) {
            setGroups([])
            setError(result.error)
            setInitialSignature('')
            setLoading(false)
            return
        }

        const nextGroups = buildGroups((result.data ?? []) as CategoryOrderItem[])
        const signature = JSON.stringify(nextGroups.map((group) => ({
            parentId: group.parentId,
            orderedIds: group.items.map((item) => item.id),
        })))

        setGroups(nextGroups)
        setInitialSignature(signature)
        setLoading(false)
    }, [])

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadHierarchy()
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [loadHierarchy])

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const activeGroupId = active.data.current?.groupId
        const overGroupId = over.data.current?.groupId

        if (!activeGroupId || activeGroupId !== overGroupId) {
            setError('Categories can only be reordered within their current parent group.')
            return
        }

        setError(null)
        setGroups((currentGroups) => currentGroups.map((group) => {
            if (group.id !== activeGroupId) return group

            const oldIndex = group.items.findIndex((item) => item.id === active.id)
            const newIndex = group.items.findIndex((item) => item.id === over.id)

            if (oldIndex < 0 || newIndex < 0) return group

            return {
                ...group,
                items: arrayMove(group.items, oldIndex, newIndex),
            }
        }))
    }

    const handleMove = (id: string, direction: 'up' | 'down') => {
        setGroups((currentGroups) => currentGroups.map((group) => {
            const index = group.items.findIndex((item) => item.id === id)
            if (index < 0) return group

            const newIndex = direction === 'up' ? index - 1 : index + 1
            if (newIndex < 0 || newIndex >= group.items.length) return group

            return {
                ...group,
                items: arrayMove(group.items, index, newIndex),
            }
        }))
    }

    const handleSave = () => {
        const payload: CategoryOrderGroup[] = groups.map((group) => ({
            parentId: group.parentId,
            orderedIds: group.items.map((item) => item.id),
        }))

        startSaving(async () => {
            setError(null)
            const result = await updateCategoryOrder(payload)

            if (result.error) {
                setError(result.error)
                return
            }

            onSaved()
            onClose()
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Manage category order</h3>
                        <p className="mt-1 text-sm text-gray-500">Drag categories within each group to control storefront and admin display order.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading categories...
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
                            No categories found.
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <div className="space-y-5">
                                {groups.map((group) => (
                                    <section key={group.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <h4 className="text-sm font-semibold text-gray-900">{group.title}</h4>
                                            <span className="text-xs font-medium text-gray-500">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                                        </div>
                                        <SortableContext items={group.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                                            <ul className="space-y-2">
                                                {group.items.map((item, index) => (
                                                    <SortableCategoryRow
                                                        key={item.id}
                                                        item={item}
                                                        groupId={group.id}
                                                        onMove={handleMove}
                                                        isFirst={index === 0}
                                                        isLast={index === group.items.length - 1}
                                                    />
                                                ))}
                                            </ul>
                                        </SortableContext>
                                    </section>
                                ))}
                            </div>
                        </DndContext>
                    )}

                    {error && (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-500">
                        {isDirty ? 'You have unsaved ordering changes.' : 'No ordering changes yet.'}
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!isDirty || loading || isSaving}
                            className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save order
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
