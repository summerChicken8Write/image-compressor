"use client";

import type { CompressSettings, OutputFormat } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

type ToolPanelProps = {
  settings: CompressSettings;
  setSettings: React.Dispatch<React.SetStateAction<CompressSettings>>;
  itemsCount: number;
  isBusy: boolean;
  totals: { original: number; compressed: number; doneCount: number };
  savings: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  dropActive: boolean;
  onPick: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setDropActiveState: (active: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  compressAll: () => void;
  downloadZip: () => void;
  clearAll: () => void;
};

export function ToolPanel({
  settings,
  setSettings,
  itemsCount,
  isBusy,
  totals,
  savings,
  inputRef,
  dropActive,
  onPick,
  onInputChange,
  setDropActiveState,
  onDrop,
  compressAll,
  downloadZip,
  clearAll,
}: ToolPanelProps) {
  const canDownloadZip = itemsCount > 0 && totals.doneCount > 0;

  return (
    <section className="pixel-panel p-5">
      <h2 className="pixel-title mb-4 text-lg text-(--pixel-ink)">
        工具箱
      </h2>

      <div
        className={[
          "pixel-focus pixel-btn mb-5 cursor-pointer select-none rounded-none bg-white p-4 text-(--pixel-ink)",
          "transition-colors",
          dropActive ? "bg-[#fff2a8]" : "hover:bg-[#fff7d6]",
        ].join(" ")}
        role="button"
        tabIndex={0}
        onClick={onPick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? onPick() : null)}
        onDragEnter={(e) => {
          e.preventDefault();
          setDropActiveState(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDropActiveState(true);
        }}
        onDragLeave={() => setDropActiveState(false)}
        onDrop={onDrop}
      >
        <div className="pixel-title mb-2 text-sm">
          拖拽图片到这里 / 点击选择
        </div>
        <div className="text-xs opacity-80">
          支持 JPG / PNG / WebP（GIF 会转为静态图）
        </div>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="image/*"
          multiple
          onChange={onInputChange}
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-(--pixel-ink)">
            输出格式
          </label>
          <select
            className="pixel-focus w-full border-4 border-(--pixel-ink) bg-white px-3 py-2 text-sm text-(--pixel-ink) shadow-[4px_4px_0_0_var(--pixel-ink)]"
            value={settings.outputFormat}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                outputFormat: e.target.value as OutputFormat,
              }))
            }
          >
            <option value="keep">保持原格式</option>
            <option value="image/jpeg">JPEG（更小，可能丢透明）</option>
            <option value="image/webp">WebP（更小，兼容性好）</option>
            <option value="image/png">PNG（更清晰，体积可能大）</option>
          </select>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium text-(--pixel-ink)">
              质量（JPEG/WebP）
            </label>
            <div className="text-xs font-mono text-(--pixel-ink)">
              {Math.round(settings.quality * 100)}%
            </div>
          </div>
          <input
            className="pixel-focus w-full accent-(--pixel-brick)"
            type="range"
            min={0.1}
            max={0.95}
            step={0.01}
            value={settings.quality}
            onChange={(e) =>
              setSettings((s) => ({ ...s, quality: Number(e.target.value) }))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-(--pixel-ink)">
              最大宽度（px）
            </label>
            <input
              className="pixel-focus w-full border-4 border-(--pixel-ink) bg-white px-3 py-2 text-sm text-(--pixel-ink) shadow-[4px_4px_0_0_var(--pixel-ink)]"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="不限制"
              value={settings.maxWidth ?? ""}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  maxWidth: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-(--pixel-ink)">
              最大高度（px）
            </label>
            <input
              className="pixel-focus w-full border-4 border-(--pixel-ink) bg-white px-3 py-2 text-sm text-(--pixel-ink) shadow-[4px_4px_0_0_var(--pixel-ink)]"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="不限制"
              value={settings.maxHeight ?? ""}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  maxHeight: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <button
            className="pixel-btn pixel-focus bg-(--pixel-brick) px-4 py-3 text-sm text-(--pixel-ink)"
            onClick={compressAll}
            disabled={isBusy || itemsCount === 0}
          >
            {isBusy ? "压缩中..." : "开始压缩"}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              className="pixel-btn pixel-focus bg-white px-4 py-3 text-sm text-(--pixel-ink)"
              onClick={downloadZip}
              disabled={!canDownloadZip}
            >
              打包 ZIP 下载
            </button>
            <button
              className="pixel-btn pixel-focus bg-white px-4 py-3 text-sm text-(--pixel-ink)"
              onClick={clearAll}
              disabled={itemsCount === 0 || isBusy}
            >
              清空
            </button>
          </div>
        </div>

        <div className="border-t-4 border-(--pixel-ink) pt-4 text-xs text-(--pixel-ink)">
          <div className="flex items-center justify-between">
            <span className="font-medium">原始总计</span>
            <span className="font-mono">{formatBytes(totals.original)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-medium">压缩后总计</span>
            <span className="font-mono">
              {totals.doneCount ? formatBytes(totals.compressed) : "-"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-medium">节省</span>
            <span className="font-mono">
              {totals.doneCount ? `${Math.round(savings * 100)}%` : "-"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
