import crypto from 'node:crypto';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID ?? '').trim();
const R2_ACCESS_KEY_ID = (process.env.R2_ACCESS_KEY_ID ?? '').trim();
const R2_SECRET_ACCESS_KEY = (process.env.R2_SECRET_ACCESS_KEY ?? '').trim();
const R2_BUCKET = (process.env.R2_BUCKET ?? '').trim();
const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '');
const R2_UPLOAD_PREFIX = (process.env.R2_UPLOAD_PREFIX ?? 'CuzMedia/uploads').trim().replace(/^\/+|\/+$/g, '');
const R2_SIGNED_URL_TTL_SECONDS = Number(process.env.R2_SIGNED_URL_TTL_SECONDS ?? 900);

const MAX_VIDEO_BYTES = Number(process.env.R2_MAX_VIDEO_BYTES ?? 1024 * 1024 * 1024);
const MAX_IMAGE_BYTES = Number(process.env.R2_MAX_IMAGE_BYTES ?? 60 * 1024 * 1024);

const IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/svg+xml',
]);

const guessContentTypeFromExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.avif') return 'image/avif';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.m4v') return 'video/x-m4v';
  return 'application/octet-stream';
};

const ensureUploadConfig = () => {
  const missing = [];
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!R2_BUCKET) missing.push('R2_BUCKET');
  if (!R2_PUBLIC_BASE_URL) missing.push('R2_PUBLIC_BASE_URL');

  if (missing.length > 0) {
    throw new Error(`Missing upload environment variables: ${missing.join(', ')}`);
  }
};

const normalizeFilename = (filename) => {
  const raw = filename.trim();
  const parsed = path.parse(raw || 'upload-file');
  const safeBase = parsed.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 72);
  const safeExt = parsed.ext
    .replace(/[^a-zA-Z0-9.]/g, '')
    .toLowerCase()
    .slice(0, 12);

  return {
    base: safeBase || 'upload-file',
    ext: safeExt || '',
  };
};

const resolveValidatedContentType = (kind, filename, contentType) => {
  const resolved = (contentType ?? '').trim().toLowerCase() || guessContentTypeFromExtension(filename);

  if (kind === 'video') {
    if (!resolved.startsWith('video/')) {
      throw new Error('Video upload requires a video/* content type');
    }
    return resolved;
  }

  if (kind === 'image') {
    if (!resolved.startsWith('image/')) {
      throw new Error('Image upload requires an image/* content type');
    }
    if (!IMAGE_CONTENT_TYPES.has(resolved)) {
      throw new Error(`Unsupported image content type: ${resolved}`);
    }
    return resolved;
  }

  throw new Error(`Unsupported upload kind: ${kind}`);
};

const validateFileSize = (kind, fileSize) => {
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error('Invalid file size');
  }

  if (kind === 'video' && fileSize > MAX_VIDEO_BYTES) {
    throw new Error(`Video exceeds max size (${MAX_VIDEO_BYTES} bytes)`);
  }

  if (kind === 'image' && fileSize > MAX_IMAGE_BYTES) {
    throw new Error(`Image exceeds max size (${MAX_IMAGE_BYTES} bytes)`);
  }
};

const createS3Client = () =>
  new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

export const createSignedUpload = async ({ filename, contentType, fileSize, kind, panelId }) => {
  ensureUploadConfig();
  validateFileSize(kind, Number(fileSize));

  const normalizedKind = kind === 'video' ? 'video' : kind === 'image' ? 'image' : '';
  if (!normalizedKind) {
    throw new Error('Invalid upload kind');
  }

  const safePanelId = (panelId ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 48);

  const { base, ext } = normalizeFilename(filename);
  const finalContentType = resolveValidatedContentType(normalizedKind, `${base}${ext}`, contentType);
  const date = new Date();
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const stamp = `${y}${m}${d}-${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}${String(
    date.getUTCSeconds()
  ).padStart(2, '0')}`;
  const uniquePart = crypto.randomUUID().slice(0, 8);
  const keyParts = [R2_UPLOAD_PREFIX, normalizedKind, y, m];
  if (safePanelId) {
    keyParts.push(safePanelId);
  }
  keyParts.push(`${stamp}-${uniquePart}-${base}${ext}`);
  const objectKey = keyParts.join('/');

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    ContentType: finalContentType,
    CacheControl: normalizedKind === 'image' ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
  });

  const uploadUrl = await getSignedUrl(createS3Client(), command, {
    expiresIn: Math.max(60, Math.min(3600, R2_SIGNED_URL_TTL_SECONDS)),
  });

  const publicUrl = `${R2_PUBLIC_BASE_URL}/${objectKey}`;
  return {
    uploadUrl,
    publicUrl,
    objectKey,
    contentType: finalContentType,
    expiresInSeconds: Math.max(60, Math.min(3600, R2_SIGNED_URL_TTL_SECONDS)),
  };
};
