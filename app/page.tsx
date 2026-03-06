"use client";

import NextImage from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type OutputFormat = "keep" | "image/jpeg" | "image/png" | "image/webp";
type ItemStatus = "idle" | "compressing" | "done" | "error";

type CompressSettings = {
  quality: number; // 0.1 ~ 0.95
  maxWidth?: number;
  maxHeight?: number;
  outputFormat: OutputFormat;
};

type ImageItem = {
  id: string;
  file: File;
  originalUrl: string;
  originalBytes: number;
  status: ItemStatus;
  error?: string;
  compressedBlob?: Blob;
  compressedUrl?: string;
  compressedBytes?: number;
  outputType?: Exclude<OutputFormat, "keep"> | string;
  outputName?: string;
  resizedTo?: { width: number; height: number };
  warning?: string;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  const units = ["B", "KB", "MB", "GB"] as const;
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const fixed = i === 0 ? 0 : n < 10 ? 2 : 1;
  return `${n.toFixed(fixed)} ${units[i]}`;
}

function getBaseName(fileName: string) {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

function extFromMime(mime: string) {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "img";
  }
}

// 智能截断文件名的工具函数
// 保留开头8个字符 + 拓展名，中间用...替代
function truncateFileName(fileName: string, keepStartLength = 8) {
  // 分离文件名和拓展名
  const dotIndex = fileName.lastIndexOf(".");
  const name = dotIndex > -1 ? fileName.slice(0, dotIndex - 1) : fileName;
  const ext = dotIndex > -1 ? fileName.slice(dotIndex - 1) : "";

  // 如果文件名长度小于等于保留长度，直接返回
  if (name.length <= keepStartLength) {
    return fileName;
  }

  // 截断中间部分，保留开头 + ... + 拓展名
  return `${name.slice(0, keepStartLength)}...${ext}`;
}

async function decodeImage(file: File) {
  // createImageBitmap 更快；失败则回退到 HTMLImageElement
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // fallback below
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("图片解码失败"));
      el.src = url;
    });
    // 用 ImageBitmap 统一后续绘制逻辑
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 Canvas 上下文");
    ctx.drawImage(img, 0, 0);
    const bmp = await createImageBitmap(canvas);
    return bmp;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("压缩失败：无法导出图片"))),
      type,
      quality,
    );
  });
}

async function compressImageFile(file: File, settings: CompressSettings) {
  const originalType = file.type || "application/octet-stream";
  const isGif = originalType === "image/gif";

  let outputType: string;
  if (settings.outputFormat === "keep") {
    outputType =
      originalType === "image/jpeg" ||
        originalType === "image/png" ||
        originalType === "image/webp"
        ? originalType
        : "image/jpeg";
  } else {
    outputType = settings.outputFormat;
  }

  let warning: string | undefined;
  if (isGif) {
    warning = "GIF 无法原样压缩，已转为静态图片（可能只保留一帧）。";
    if (settings.outputFormat === "keep") outputType = "image/png";
  }

  const bmp = await decodeImage(file);
  try {
    const srcW = bmp.width;
    const srcH = bmp.height;

    const maxW = settings.maxWidth && settings.maxWidth > 0 ? settings.maxWidth : undefined;
    const maxH =
      settings.maxHeight && settings.maxHeight > 0 ? settings.maxHeight : undefined;

    const scaleW = maxW ? maxW / srcW : 1;
    const scaleH = maxH ? maxH / srcH : 1;
    const scale = Math.min(1, scaleW, scaleH);

    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 Canvas 上下文");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, dstW, dstH);

    const quality = outputType === "image/png" ? 1 : settings.quality;
    const blob = await canvasToBlob(canvas, outputType, quality);

    return {
      blob,
      outputType,
      resizedTo: { width: dstW, height: dstH },
      warning,
    };
  } finally {
    bmp.close?.();
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState<CompressSettings>({
    quality: 0.78,
    maxWidth: 1920,
    maxHeight: 1920,
    outputFormat: "keep",
  });
  const [items, setItems] = useState<ImageItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);

  // 清理 ObjectURL
  useEffect(() => {
    return () => {
      for (const it of items) {
        URL.revokeObjectURL(it.originalUrl);
        if (it.compressedUrl) URL.revokeObjectURL(it.compressedUrl);
      }
    };
  }, [items]);

  const totals = useMemo(() => {
    const original = items.reduce((sum, it) => sum + (it.originalBytes || 0), 0);
    const compressed = items.reduce(
      (sum, it) => sum + (it.compressedBytes || 0),
      0,
    );
    const doneCount = items.filter((it) => it.status === "done").length;
    return { original, compressed, doneCount };
  }, [items]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const next: ImageItem[] = [];
    for (const f of arr) {
      if (!f.type.startsWith("image/")) continue;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      next.push({
        id,
        file: f,
        originalUrl: URL.createObjectURL(f),
        originalBytes: f.size,
        status: "idle",
      });
    }
    if (next.length === 0) return;
    setItems((prev) => [...next, ...prev]);
  }, []);

  const onPick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) addFiles(files);
      e.target.value = "";
    },
    [addFiles],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) {
        URL.revokeObjectURL(it.originalUrl);
        if (it.compressedUrl) URL.revokeObjectURL(it.compressedUrl);
      }
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      for (const it of prev) {
        URL.revokeObjectURL(it.originalUrl);
        if (it.compressedUrl) URL.revokeObjectURL(it.compressedUrl);
      }
      return [];
    });
  }, []);

  const compressAll = useCallback(async () => {
    if (isBusy) return;
    if (items.length === 0) return;
    setIsBusy(true);
    try {
      // 先把所有条目设为 compressing（不覆盖 done 的结果 URL）
      setItems((prev) =>
        prev.map((it) =>
          it.status === "compressing"
            ? it
            : { ...it, status: "compressing", error: undefined, warning: undefined },
        ),
      );

      for (const it of items) {
        try {
          const res = await compressImageFile(it.file, settings);
          const compressedUrl = URL.createObjectURL(res.blob);
          const outputName = `${getBaseName(it.file.name)}.compressed.${extFromMime(
            res.outputType,
          )}`;

          setItems((prev) =>
            prev.map((x) => {
              if (x.id !== it.id) return x;
              if (x.compressedUrl) URL.revokeObjectURL(x.compressedUrl);
              return {
                ...x,
                status: "done",
                compressedBlob: res.blob,
                compressedUrl,
                compressedBytes: res.blob.size,
                outputType: res.outputType,
                outputName,
                resizedTo: res.resizedTo,
                warning: res.warning,
              };
            }),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "压缩失败";
          setItems((prev) =>
            prev.map((x) =>
              x.id === it.id ? { ...x, status: "error", error: msg } : x,
            ),
          );
        }
        // 让 UI 有机会刷新
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, items, settings]);

  const downloadZip = useCallback(async () => {
    const done = items.filter((it) => it.status === "done" && it.compressedBlob && it.outputName);
    if (done.length === 0) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const it of done) {
      zip.file(it.outputName!, it.compressedBlob!);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const stamp = new Date()
      .toISOString()
      .replaceAll(":", "-")
      .replaceAll(".", "-");
    downloadBlob(blob, `compressed_${stamp}.zip`);
  }, [items]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropActive(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const savings =
    totals.doneCount > 0 && totals.original > 0 && totals.compressed > 0
      ? Math.max(0, 1 - totals.compressed / totals.original)
      : 0;

  return (
    <div className="pixel-bg min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-col gap-3">
          <div className="inline-flex items-center gap-3">
            <div
              aria-hidden
              className="h-10 w-10 shrink-0 border-4 border-[var(--pixel-ink)] bg-[var(--pixel-brick)] shadow-[4px_4px_0_0_var(--pixel-ink)]"
            />
            <h1 className="pixel-title text-2xl text-[var(--pixel-ink)] sm:text-3xl">
              像素图片压缩器
            </h1>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[color-mix(in_oklab,var(--pixel-ink)_70%,transparent)]">
            纯前端压缩：图片不会上传到服务器。支持批量上传，压缩后可单张下载或打包 ZIP 下载。
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* 左侧：参数与上传 */}
          <section className="pixel-panel p-5">
            <h2 className="pixel-title mb-4 text-lg text-[var(--pixel-ink)]">
              工具箱
            </h2>

            <div
              className={[
                "pixel-focus pixel-btn mb-5 cursor-pointer select-none rounded-none bg-white p-4 text-[var(--pixel-ink)]",
                "transition-colors",
                dropActive ? "bg-[#fff2a8]" : "hover:bg-[#fff7d6]",
              ].join(" ")}
              role="button"
              tabIndex={0}
              onClick={onPick}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? onPick() : null)}
              onDragEnter={(e) => {
                e.preventDefault();
                setDropActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
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
                <label className="mb-1 block text-xs font-medium text-[var(--pixel-ink)]">
                  输出格式
                </label>
                <select
                  className="pixel-focus w-full border-4 border-[var(--pixel-ink)] bg-white px-3 py-2 text-sm text-[var(--pixel-ink)] shadow-[4px_4px_0_0_var(--pixel-ink)]"
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
                  <label className="block text-xs font-medium text-[var(--pixel-ink)]">
                    质量（JPEG/WebP）
                  </label>
                  <div className="text-xs font-mono text-[var(--pixel-ink)]">
                    {Math.round(settings.quality * 100)}%
                  </div>
                </div>
                <input
                  className="pixel-focus w-full accent-[var(--pixel-brick)]"
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
                  <label className="mb-1 block text-xs font-medium text-[var(--pixel-ink)]">
                    最大宽度（px）
                  </label>
                  <input
                    className="pixel-focus w-full border-4 border-[var(--pixel-ink)] bg-white px-3 py-2 text-sm text-[var(--pixel-ink)] shadow-[4px_4px_0_0_var(--pixel-ink)]"
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
                  <label className="mb-1 block text-xs font-medium text-[var(--pixel-ink)]">
                    最大高度（px）
                  </label>
                  <input
                    className="pixel-focus w-full border-4 border-[var(--pixel-ink)] bg-white px-3 py-2 text-sm text-[var(--pixel-ink)] shadow-[4px_4px_0_0_var(--pixel-ink)]"
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
                  className="pixel-btn pixel-focus bg-[var(--pixel-brick)] px-4 py-3 text-sm text-[var(--pixel-ink)]"
                  onClick={compressAll}
                  disabled={isBusy || items.length === 0}
                >
                  {isBusy ? "压缩中..." : "开始压缩"}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    className="pixel-btn pixel-focus bg-white px-4 py-3 text-sm text-[var(--pixel-ink)]"
                    onClick={downloadZip}
                    disabled={items.every((it) => it.status !== "done")}
                  >
                    打包 ZIP 下载
                  </button>
                  <button
                    className="pixel-btn pixel-focus bg-white px-4 py-3 text-sm text-[var(--pixel-ink)]"
                    onClick={clearAll}
                    disabled={items.length === 0 || isBusy}
                  >
                    清空
                  </button>
                </div>
              </div>

              <div className="border-t-4 border-[var(--pixel-ink)] pt-4 text-xs text-[var(--pixel-ink)]">
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

          {/* 右侧：列表 */}
          <section className="pixel-panel p-5">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="pixel-title text-lg text-[var(--pixel-ink)]">
                任务列表
              </h2>
              <div className="text-xs text-[var(--pixel-ink)] opacity-80">
                {items.length ? `共 ${items.length} 张` : "还没有图片"}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="border-4 border-dashed border-[var(--pixel-ink)] bg-white p-10 text-center text-sm text-[var(--pixel-ink)]">
                把图片拖进来吧，勇者！
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((it) => {
                  const ratio =
                    it.compressedBytes && it.originalBytes
                      ? Math.max(0, 1 - it.compressedBytes / it.originalBytes)
                      : 0;
                  return (
                    <li
                      key={it.id}
                      className="border-4 border-[var(--pixel-ink)] bg-white p-4 shadow-[4px_4px_0_0_var(--pixel-ink)]"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          {/* 关键修改：替换为Tailwind类名，移除内联样式 */}
                          <div className="pixel-title mb-1 truncate text-sm text-[var(--pixel-ink)] w-full whitespace-nowrap overflow-hidden text-ellipsis">
                            {truncateFileName(it.file.name)}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--pixel-ink)] opacity-80">
                            <span>原始：{formatBytes(it.originalBytes)}</span>
                            {it.status === "done" ? (
                              <>
                                <span>压缩：{formatBytes(it.compressedBytes || 0)}</span>
                                <span>节省：{Math.round(ratio * 100)}%</span>
                                {it.resizedTo ? (
                                  <span>
                                    尺寸：{it.resizedTo.width}×{it.resizedTo.height}
                                  </span>
                                ) : null}
                                {it.outputType ? <span>格式：{it.outputType}</span> : null}
                              </>
                            ) : null}
                          </div>
                          {it.warning ? (
                            <div className="mt-2 text-xs text-[#8b3d26]">
                              提示：{it.warning}
                            </div>
                          ) : null}
                          {it.status === "error" ? (
                            <div className="mt-2 text-xs text-[#b00020]">
                              错误：{it.error || "压缩失败"}
                            </div>
                          ) : null}
                          {it.status === "compressing" ? (
                            <div className="mt-2 text-xs text-[var(--pixel-ink)]">
                              压缩中...
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          {it.status === "done" && it.compressedBlob && it.outputName ? (
                            <button
                              className="pixel-btn pixel-focus bg-[var(--pixel-brick)] px-3 py-2 text-xs text-white"
                              onClick={() => downloadBlob(it.compressedBlob!, it.outputName!)}
                            >
                              下载
                            </button>
                          ) : null}
                          <button
                            className="pixel-btn pixel-focus bg-white px-3 py-2 text-xs text-[var(--pixel-ink)]"
                            onClick={() => removeItem(it.id)}
                            disabled={isBusy}
                          >
                            移除
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="border-4 border-[var(--pixel-ink)] bg-[var(--pixel-cream)] p-2">
                          <div className="pixel-title mb-2 text-xs text-[var(--pixel-ink)]">
                            原图
                          </div>
                          <div className="relative h-56 w-full">
                            <NextImage
                              src={it.originalUrl}
                              alt={`原图预览：${it.file.name}`}
                              fill
                              sizes="(max-width: 640px) 100vw, 50vw"
                              className="object-contain"
                              draggable={false}
                              unoptimized
                            />
                          </div>
                        </div>
                        <div className="border-4 border-[var(--pixel-ink)] bg-[var(--pixel-cream)] p-2">
                          <div className="pixel-title mb-2 text-xs text-[var(--pixel-ink)]">
                            压缩后
                          </div>
                          {it.compressedUrl ? (
                            <div className="relative h-56 w-full">
                              <NextImage
                                src={it.compressedUrl}
                                alt={`压缩后预览：${it.file.name}`}
                                fill
                                sizes="(max-width: 640px) 100vw, 50vw"
                                className="object-contain"
                                draggable={false}
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="flex h-56 items-center justify-center text-xs text-[var(--pixel-ink)] opacity-70">
                              {it.status === "compressing"
                                ? "生成中..."
                                : "还没压缩"}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className="mt-10 text-center text-xs text-[var(--pixel-ink)] opacity-70">
          Made with Canvas. 纯前端运行。
        </footer>
      </div>
    </div>
  );
}