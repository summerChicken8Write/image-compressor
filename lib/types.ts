export type OutputFormat = "keep" | "image/jpeg" | "image/png" | "image/webp";
export type ItemStatus = "idle" | "compressing" | "done" | "error";

export type CompressSettings = {
  quality: number; // 0.1 ~ 0.95
  maxWidth?: number;
  maxHeight?: number;
  outputFormat: OutputFormat;
};

export type ImageItem = {
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
