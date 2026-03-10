"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompressSettings, ImageItem } from "@/lib/types";
import { compressImageFile, downloadBlob, getOutputFileName } from "@/lib/compress";

const DEFAULT_SETTINGS: CompressSettings = {
  quality: 0.78,
  maxWidth: 1920,
  maxHeight: 1920,
  outputFormat: "keep",
};

function generateId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function useImageCompressor() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState<CompressSettings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);

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
      next.push({
        id: generateId(),
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
          const outputName = getOutputFileName(it.file.name, res.outputType);

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
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, items, settings]);

  const downloadZip = useCallback(async () => {
    const done = items.filter(
      (it) => it.status === "done" && it.compressedBlob && it.outputName,
    );
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

  const setDropActiveState = useCallback((active: boolean) => {
    setDropActive(active);
  }, []);

  return {
    inputRef,
    settings,
    setSettings,
    items,
    isBusy,
    dropActive,
    totals,
    addFiles,
    onPick,
    onInputChange,
    removeItem,
    clearAll,
    compressAll,
    downloadZip,
    onDrop,
    setDropActiveState,
  };
}
