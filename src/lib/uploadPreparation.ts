import { FileData } from '@/src/types';

type UploadNotice = {
  level: 'success' | 'warning';
  message: string;
};

type PreparedUpload = {
  fileData: FileData;
  compressed: boolean;
  notices: UploadNotice[];
};

const IMAGE_AUTO_COMPRESS_THRESHOLD_BYTES = 1_500_000;
const IMAGE_TARGET_MAX_BYTES = 1_200_000;
const PDF_GZIP_THRESHOLD_BYTES = 1_500_000;
const PDF_SOFT_WARNING_BYTES = 2_000_000;
const IMAGE_MAX_DIMENSIONS = [2200, 1800, 1400];
const JPEG_QUALITIES = [0.82, 0.72, 0.62, 0.52];

export function inferMimeFromFileName(fileName: string, browserMime: string): string {
  const type = browserMime.trim();
  if (type) return type;

  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (/\.jpe?g$/i.test(lower)) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function readBlobAsDataUrl(blob: Blob, label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${label}`));
    reader.readAsDataURL(blob);
  });
}

function estimateDataUrlBytes(data: string): number {
  const base64 = data.replace(/^data:[^;]+;base64,/, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function renameWithExtension(fileName: string, extension: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '');
  return `${baseName}${extension}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode image ${file.name}`));
    };
    image.src = objectUrl;
  });
}

function drawCompressedImage(image: HTMLImageElement, maxDimension: number, quality: number): string {
  const longestSide = Math.max(image.width, image.height);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not available for image compression.');
  }

  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function compressImageFile(file: File): Promise<{ data: string; bytes: number; mimeType: string; name: string } | undefined> {
  const image = await loadImage(file);
  let bestData: string | undefined;
  let bestBytes = Number.POSITIVE_INFINITY;

  for (const maxDimension of IMAGE_MAX_DIMENSIONS) {
    for (const quality of JPEG_QUALITIES) {
      const nextData = drawCompressedImage(image, maxDimension, quality);
      const nextBytes = estimateDataUrlBytes(nextData);
      if (nextBytes < bestBytes) {
        bestData = nextData;
        bestBytes = nextBytes;
      }
      if (nextBytes <= IMAGE_TARGET_MAX_BYTES) {
        return {
          data: nextData,
          bytes: nextBytes,
          mimeType: 'image/jpeg',
          name: renameWithExtension(file.name, '.jpg'),
        };
      }
    }
  }

  if (!bestData) return undefined;

  return {
    data: bestData,
    bytes: bestBytes,
    mimeType: 'image/jpeg',
    name: renameWithExtension(file.name, '.jpg'),
  };
}

async function gzipBlob(blob: Blob): Promise<Blob | undefined> {
  if (typeof CompressionStream === 'undefined') {
    return undefined;
  }

  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

export async function prepareFileForUpload(file: File): Promise<PreparedUpload> {
  const mimeType = inferMimeFromFileName(file.name, file.type);
  const notices: UploadNotice[] = [];

  if (mimeType.startsWith('image/') && file.size > IMAGE_AUTO_COMPRESS_THRESHOLD_BYTES) {
    try {
      const compressed = await compressImageFile(file);
      if (compressed && compressed.bytes < file.size * 0.92) {
        notices.push({
          level: 'success',
          message: `${file.name} was compressed from ${formatBytes(file.size)} to ${formatBytes(compressed.bytes)} before upload.`,
        });
        if (compressed.bytes > IMAGE_TARGET_MAX_BYTES) {
          notices.push({
            level: 'warning',
            message: `${compressed.name} is still fairly large and may fall back to metadata-only mode.`,
          });
        }
        return {
          fileData: {
            name: compressed.name,
            mimeType: compressed.mimeType,
            data: compressed.data,
          },
          compressed: true,
          notices,
        };
      }
    } catch {
      notices.push({
        level: 'warning',
        message: `${file.name} could not be compressed automatically, so the original image will be uploaded.`,
      });
    }
  }

  if (mimeType === 'application/pdf' && file.size > PDF_GZIP_THRESHOLD_BYTES) {
    try {
      const compressedBlob = await gzipBlob(file);
      if (compressedBlob && compressedBlob.size < file.size * 0.92) {
        const compressedData = await readBlobAsDataUrl(compressedBlob, file.name);
        notices.push({
          level: 'success',
          message: `${file.name} was compressed for upload from ${formatBytes(file.size)} to ${formatBytes(compressedBlob.size)}.`,
        });
        if (compressedBlob.size > PDF_SOFT_WARNING_BYTES) {
          notices.push({
            level: 'warning',
            message: `${file.name} is still a large PDF after compression and may fall back to metadata-only mode.`,
          });
        }
        return {
          fileData: {
            name: file.name,
            mimeType,
            data: compressedData,
            contentEncoding: 'gzip',
          },
          compressed: true,
          notices,
        };
      }

      notices.push({
        level: 'warning',
        message: `${file.name} did not compress enough in-browser. If it is still too large, split or re-export the PDF.`,
      });
    } catch {
      notices.push({
        level: 'warning',
        message: `${file.name} could not be PDF-compressed in this browser, so the original PDF will be uploaded.`,
      });
    }
  }

  const originalData = await readBlobAsDataUrl(file, file.name);
  if (mimeType === 'application/pdf' && file.size > PDF_SOFT_WARNING_BYTES) {
    notices.push({
      level: 'warning',
      message: `${file.name} is a large PDF and may fall back to metadata-only mode. Splitting pages usually works better.`,
    });
  }

  return {
    fileData: {
      name: file.name,
      mimeType,
      data: originalData,
    },
    compressed: false,
    notices,
  };
}
