"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { TAFSIR_DISPLAY_NAMES, TAFSIR_ARABIC_NAMES, type TafsirId } from "@/lib/types";
import { normalizeTafsirOrder } from "@/lib/tafsir/order";

export function TafsirOrderPicker() {
  const { prefs, setPref } = usePreferences();
  const order = normalizeTafsirOrder(prefs.tafsirOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as TafsirId);
    const to = order.indexOf(over.id as TafsirId);
    if (from === -1 || to === -1) return;
    setPref("tafsirOrder", arrayMove(order, from, to));
  };

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Tafsir Order
      </h3>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 gap-1.5">
            {order.map((id) => (
              <SortableTafsirRow key={id} id={id} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortableTafsirRow({ id }: { id: TafsirId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: "rgba(0,0,0,0.08)",
        backgroundColor: "var(--color-bg)",
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="font-arabic text-sm text-[var(--color-text)]" dir="rtl">
          {TAFSIR_ARABIC_NAMES[id]}
        </span>
        <span className="text-xs text-[var(--color-muted)]">
          {TAFSIR_DISPLAY_NAMES[id]}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Drag to reorder ${TAFSIR_DISPLAY_NAMES[id]}`}
        className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface)] active:cursor-grabbing active:scale-95 transition"
        style={{ touchAction: "none" }}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}
