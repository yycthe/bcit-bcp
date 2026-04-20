import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

export const config = { runtime: 'nodejs', maxDuration: 30 };

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured on the server.' });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const safe = pathname.toLowerCase();
        if (!/\.(pdf|jpg|jpeg|png|webp)$/.test(safe)) {
          throw new Error('Unsupported file type');
        }
        return {
          allowedContentTypes: ALLOWED_MIME,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async () => {
        // no-op for now; could persist to DB here
      },
    });

    res.status(200).json(jsonResponse);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Upload failed' });
  }
}
