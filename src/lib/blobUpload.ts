import { upload } from '@vercel/blob/client';
import type { FileData } from '@/src/types';

export type BlobUploadResult = {
  fileData: FileData;
  blobUrl: string;
  bytes: number;
};

export type BlobUploadProgress = {
  fileName: string;
  loaded: number;
  total: number;
  percent: number;
};

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

function sanitizePath(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  const ts = Date.now();
  return `merchant-docs/${ts}-${cleaned}`;
}

export async function uploadFileToBlob(
  file: File,
  opts: { documentType?: string; onProgress?: (p: BlobUploadProgress) => void } = {}
): Promise<BlobUploadResult> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`${file.name} is larger than 25 MB and cannot be uploaded.`);
  }

  const pathname = sanitizePath(file.name);

  const blob = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/upload-token',
    contentType: file.type || 'application/octet-stream',
    onUploadProgress: opts.onProgress
      ? (p) =>
          opts.onProgress!({
            fileName: file.name,
            loaded: p.loaded,
            total: p.total,
            percent: p.percentage,
          })
      : undefined,
  });

  const fileData: FileData = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    data: blob.url,
    uploadDate: new Date().toISOString(),
    documentType: opts.documentType,
    status: 'Uploaded',
  };

  return { fileData, blobUrl: blob.url, bytes: file.size };
}

export async function uploadMultipleToBlob(
  files: File[],
  opts: { documentType?: string; onProgress?: (p: BlobUploadProgress) => void } = {}
): Promise<BlobUploadResult[]> {
  const results = await Promise.all(files.map((file) => uploadFileToBlob(file, opts)));
  return results;
}
