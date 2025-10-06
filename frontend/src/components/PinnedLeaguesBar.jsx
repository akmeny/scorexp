// src/components/PinnedLeaguesBar.jsx
import React from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PinToggle from "./PinToggle";

function SortableItem({ id, league, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-xl px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <div
        className="flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
        {...attributes}
        {...listeners}
      >
        <span className="text-xl">⋮⋮</span>
        <img src={league?.logo} alt="" className="w-5 h-5 rounded-sm" />
        <div className="text-sm">
          <div className="font-semibold">{league?.name}</div>
          <div className="text-[11px] opacity-70">{league?.country?.name}</div>
        </div>
      </div>

      <PinToggle active={true} onClick={() => onToggle(league.id)} />
    </div>
  );
}

/**
 * leagues: pinned (bugün maç olan) lig objeleri
 * order: pinned ID sırası (normalized)
 * onOrderChange(newOrderIds: number[])
 * onToggle: pin toggle (çıkarma/ekleme)
 */
export default function PinnedLeaguesBar({ leagues = [], order = [], onOrderChange, onToggle }) {
  const ids = leagues.map((l) => Number(l.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    const newIds = arrayMove(ids, oldIndex, newIndex);

    // order’da sadece pinned’i güncelleyeceğiz:
    // order’dan "pinned olanları" sırasıyla alıp bunların yerini newIds’e göre değiştir
    const pinnedSet = new Set(ids);
    const others = order.filter((x) => !pinnedSet.has(Number(x)));
    const next = [...newIds, ...others];
    onOrderChange?.(next);
  };

  if (!leagues.length) return null;

  return (
    <div className="mb-3 space-y-2">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 px-1">
        Sabit Ligler
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {leagues.map((l) => (
              <SortableItem key={l.id} id={Number(l.id)} league={l} onToggle={onToggle} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}