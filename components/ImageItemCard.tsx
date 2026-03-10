"use client";

import NextImage from "next/image";
import type { ImageItem } from "@/lib/types";
import { formatBytes, truncateFileName } from "@/lib/utils";
import { downloadBlob } from "@/lib/compress";

type ImageItemCardProps = {
  item: ImageItem;
  isBusy: boolean;
  onRemove: (id: string) => void;
};

export function ImageItemCard({ item, isBusy, onRemove }: ImageItemCardProps) {
  const ratio =
    item.compressedBytes && item.originalBytes
      ? Math.max(0, 1 - item.compressedBytes / item.originalBytes)
      : 0;

  return (
    <li className="border-4 border-(--pixel-ink) bg-white p-4 shadow-[4px_4px_0_0_var(--pixel-ink)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="pixel-title mb-1 w-full truncate text-sm text-(--pixel-ink)">
            {truncateFileName(item.file.name)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--pixel-ink) opacity-80">
            <span>原始：{formatBytes(item.originalBytes)}</span>
            {item.status === "done" ? (
              <>
                <span>压缩：{formatBytes(item.compressedBytes || 0)}</span>
                <span>节省：{Math.round(ratio * 100)}%</span>
                {item.resizedTo ? (
                  <span>
                    尺寸：{item.resizedTo.width}×{item.resizedTo.height}
                  </span>
                ) : null}
                {item.outputType ? (
                  <span>格式：{item.outputType}</span>
                ) : null}
              </>
            ) : null}
          </div>
          {item.warning ? (
            <div className="mt-2 text-xs text-[#8b3d26]">提示：{item.warning}</div>
          ) : null}
          {item.status === "error" ? (
            <div className="mt-2 text-xs text-[#b00020]">
              错误：{item.error || "压缩失败"}
            </div>
          ) : null}
          {item.status === "compressing" ? (
            <div className="mt-2 text-xs text-(--pixel-ink)">压缩中...</div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {item.status === "done" && item.compressedBlob && item.outputName ? (
            <button
              className="pixel-btn pixel-focus bg-(--pixel-brick) px-3 py-2 text-xs text-white"
              onClick={() =>
                downloadBlob(item.compressedBlob!, item.outputName!)
              }
            >
              下载
            </button>
          ) : null}
          <button
            className="pixel-btn pixel-focus bg-white px-3 py-2 text-xs text-(--pixel-ink)"
            onClick={() => onRemove(item.id)}
            disabled={isBusy}
          >
            移除
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="border-4 border-(--pixel-ink) bg-(--pixel-cream) p-2">
          <div className="pixel-title mb-2 text-xs text-(--pixel-ink)">
            原图
          </div>
          <div className="relative h-56 w-full">
            <NextImage
              src={item.originalUrl}
              alt={`原图预览：${item.file.name}`}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-contain"
              draggable={false}
              unoptimized
            />
          </div>
        </div>
        <div className="border-4 border-(--pixel-ink) bg-(--pixel-cream) p-2">
          <div className="pixel-title mb-2 text-xs text-(--pixel-ink)">
            压缩后
          </div>
          {item.compressedUrl ? (
            <div className="relative h-56 w-full">
              <NextImage
                src={item.compressedUrl}
                alt={`压缩后预览：${item.file.name}`}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-contain"
                draggable={false}
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-56 items-center justify-center text-xs text-(--pixel-ink) opacity-70">
              {item.status === "compressing" ? "生成中..." : "还没压缩"}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
