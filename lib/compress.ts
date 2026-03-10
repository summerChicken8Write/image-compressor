import type { CompressSettings } from "./types";
import { getBaseName, extFromMime } from "./utils";

async function decodeImage(file: File) {
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

export async function compressImageFile(file: File, settings: CompressSettings) {
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

    const maxW =
      settings.maxWidth && settings.maxWidth > 0 ? settings.maxWidth : undefined;
    const maxH =
      settings.maxHeight && settings.maxHeight > 0
        ? settings.maxHeight
        : undefined;

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

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function getOutputFileName(fileName: string, outputType: string) {
  return `${getBaseName(fileName)}.compressed.${extFromMime(outputType)}`;
}
