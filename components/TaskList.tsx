"use client";

import type { ImageItem } from "@/lib/types";
import { ImageItemCard } from "./ImageItemCard";

type TaskListProps = {
  items: ImageItem[];
  isBusy: boolean;
  onRemove: (id: string) => void;
};

export function TaskList({ items, isBusy, onRemove }: TaskListProps) {
  return (
    <section className="pixel-panel p-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="pixel-title text-lg text-(--pixel-ink)">任务列表</h2>
        <div className="text-xs text-(--pixel-ink) opacity-80">
          {items.length ? `共 ${items.length} 张` : "还没有图片"}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="border-4 border-dashed border-(--pixel-ink) bg-white p-10 text-center text-sm text-(--pixel-ink)">
          把图片拖进来吧，勇者！
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((it) => (
            <ImageItemCard
              key={it.id}
              item={it}
              isBusy={isBusy}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
