export function formatBytes(bytes: number) {
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

export function getBaseName(fileName: string) {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

export function extFromMime(mime: string) {
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

/** 智能截断文件名：保留开头 N 字符 + 拓展名，中间用 ... 替代 */
export function truncateFileName(fileName: string, keepStartLength = 8) {
  const dotIndex = fileName.lastIndexOf(".");
  const name = dotIndex > -1 ? fileName.slice(0, dotIndex) : fileName;
  const ext = dotIndex > -1 ? fileName.slice(dotIndex) : "";

  if (name.length <= keepStartLength) {
    return fileName;
  }

  return `${name.slice(0, keepStartLength)}...${ext}`;
}
