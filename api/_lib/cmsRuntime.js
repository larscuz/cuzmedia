import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const STORAGE_ROOT = path.join('/tmp', 'cuzmedia-cms');
const ACTIVE_CMS_FILE = path.join(STORAGE_ROOT, 'cms.json');
const REVISIONS_DIR = path.join(STORAGE_ROOT, 'revisions');

const CMS_ADMIN_USER = process.env.CMS_ADMIN_USER ?? 'admin';
const CMS_ADMIN_PASS = process.env.CMS_ADMIN_PASS ?? '@3quallyshitty';
const CMS_TOKEN_SECRET = process.env.CMS_TOKEN_SECRET ?? 'replace-this-secret-in-production';
const CMS_TOKEN_TTL_SECONDS = Number(process.env.CMS_TOKEN_TTL_SECONDS ?? 60 * 60 * 12);

// Optional: when these are present, CMS state is persisted to R2 (recommended in production).
const CMS_R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID ?? '').trim();
const CMS_R2_ACCESS_KEY_ID = (process.env.R2_ACCESS_KEY_ID ?? '').trim();
const CMS_R2_SECRET_ACCESS_KEY = (process.env.R2_SECRET_ACCESS_KEY ?? '').trim();
const CMS_R2_BUCKET = (process.env.R2_BUCKET ?? '').trim();
const CMS_R2_KEY = (process.env.CMS_R2_KEY ?? 'CuzMedia/cms.json').trim().replace(/^\/+|\/+$/g, '');
const CMS_R2_REVISIONS_PREFIX = (process.env.CMS_R2_REVISIONS_PREFIX ?? 'CuzMedia/cms-revisions')
  .trim()
  .replace(/^\/+|\/+$/g, '');

const FALLBACK_CMS = {
  settings: {
    siteTitle: 'Cuz Media | AI-Native Creative Production',
    siteDescription: 'Cuz Media is an AI-native creative production studio building campaigns, showreels, and digital brand worlds.',
    brandName: 'CUZ MEDIA',
    brandSubline: 'Production',
    headerCtaLabel: 'Start a Project',
    headerCtaHref: 'mailto:lars@larscuzner.com',
    spinHint: 'Scroll, swipe, or use arrow keys to spin the large wheel',
    accentColor: '#bdf460',
  },
  panels: [
    {
      id: 'showreel',
      client: 'Cuz Media',
      title: 'AI-First Creative by Apprentices',
      description:
        'Cuz Media combines AI-first creative production with apprenticeship at its core, delivering supervised production at reduced cost.',
      videoPath: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/BHKIwide.mp4',
      posterPath: '',
      fallbackPosterSrc:
        'https://image.mux.com/B5zafx01GNBGBrB5M2AsFURPyMqkuRgHGCSA36asEIdQ/thumbnail.webp?time=0&width=1280&height=720&fit_mode=crop',
      primaryCta: { label: 'Watch Showreel', href: '#showreel' },
      fallbackVideoSrc: 'https://stream.mux.com/B5zafx01GNBGBrB5M2AsFURPyMqkuRgHGCSA36asEIdQ/medium.mp4',
      secondaryCta: { label: 'See Services', href: '#contact' },
      hero: true,
    },
  ],
  navItems: [{ id: 'showreel', label: 'Showreel', panelIds: ['showreel'] }],
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string';
const asNonEmptyString = (value, field) => {
  if (!isString(value) || !value.trim()) {
    throw new Error(`Invalid ${field}: expected non-empty string`);
  }
  return value.trim();
};

const nowIso = () => new Date().toISOString();

const base64UrlEncode = (input) => Buffer.from(input).toString('base64url');
const base64UrlDecode = (input) => Buffer.from(input, 'base64url').toString('utf8');
const signTokenInput = (input) => crypto.createHmac('sha256', CMS_TOKEN_SECRET).update(input).digest('base64url');

const hasR2CmsStorage = () =>
  Boolean(CMS_R2_ACCOUNT_ID && CMS_R2_ACCESS_KEY_ID && CMS_R2_SECRET_ACCESS_KEY && CMS_R2_BUCKET && CMS_R2_KEY);

const createR2Client = () =>
  new S3Client({
    region: 'auto',
    endpoint: `https://${CMS_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: CMS_R2_ACCESS_KEY_ID,
      secretAccessKey: CMS_R2_SECRET_ACCESS_KEY,
    },
  });

const streamToString = async (body) => {
  if (!body) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  if (typeof body.transformToString === 'function') {
    return body.transformToString();
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const isMissingObjectError = (error) => {
  const name = error?.name ?? '';
  const statusCode = error?.$metadata?.httpStatusCode ?? 0;
  return name === 'NoSuchKey' || name === 'NotFound' || statusCode === 404;
};

const readR2JsonObject = async (key, throwIfMissing = false) => {
  try {
    const response = await createR2Client().send(
      new GetObjectCommand({
        Bucket: CMS_R2_BUCKET,
        Key: key,
      })
    );
    const raw = await streamToString(response.Body);
    return JSON.parse(raw);
  } catch (error) {
    if (isMissingObjectError(error) && !throwIfMissing) {
      return null;
    }
    throw error;
  }
};

const writeR2JsonObject = async (key, value) => {
  await createR2Client().send(
    new PutObjectCommand({
      Bucket: CMS_R2_BUCKET,
      Key: key,
      Body: `${JSON.stringify(value, null, 2)}\n`,
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'no-store',
    })
  );
};

const listR2RevisionObjectKeys = async () => {
  const prefix = `${CMS_R2_REVISIONS_PREFIX}/`;
  const keys = [];
  let continuationToken = undefined;

  do {
    const response = await createR2Client().send(
      new ListObjectsV2Command({
        Bucket: CMS_R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const object of response.Contents ?? []) {
      if (object.Key?.endsWith('.json')) {
        keys.push(object.Key);
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  keys.sort((a, b) => b.localeCompare(a));
  return keys;
};

const validateCta = (value, fieldName) => {
  if (!isObject(value)) {
    throw new Error(`Invalid ${fieldName}: expected object`);
  }

  return {
    label: asNonEmptyString(value.label, `${fieldName}.label`),
    href: asNonEmptyString(value.href, `${fieldName}.href`),
  };
};

const validatePanel = (panel, index) => {
  if (!isObject(panel)) {
    throw new Error(`Invalid panels[${index}]: expected object`);
  }

  const normalized = {
    id: asNonEmptyString(panel.id, `panels[${index}].id`),
    client: asNonEmptyString(panel.client, `panels[${index}].client`),
    title: asNonEmptyString(panel.title, `panels[${index}].title`),
    description: asNonEmptyString(panel.description, `panels[${index}].description`),
    videoPath: isString(panel.videoPath) ? panel.videoPath.trim() : '',
    posterPath: isString(panel.posterPath) ? panel.posterPath.trim() : '',
    fallbackPosterSrc: asNonEmptyString(panel.fallbackPosterSrc, `panels[${index}].fallbackPosterSrc`),
    primaryCta: validateCta(panel.primaryCta, `panels[${index}].primaryCta`),
  };

  if (panel.fallbackVideoSrc !== undefined && panel.fallbackVideoSrc !== null) {
    if (!isString(panel.fallbackVideoSrc)) {
      throw new Error(`Invalid panels[${index}].fallbackVideoSrc: expected string`);
    }
    normalized.fallbackVideoSrc = panel.fallbackVideoSrc.trim();
  }

  if (panel.secondaryCta !== undefined && panel.secondaryCta !== null) {
    normalized.secondaryCta = validateCta(panel.secondaryCta, `panels[${index}].secondaryCta`);
  }

  if (panel.hero !== undefined) {
    normalized.hero = Boolean(panel.hero);
  }

  return normalized;
};

export const validateCmsConfig = (input) => {
  if (!isObject(input)) {
    throw new Error('Invalid CMS payload: expected object');
  }

  if (!isObject(input.settings)) {
    throw new Error('Invalid settings: expected object');
  }

  const settings = {
    siteTitle: asNonEmptyString(input.settings.siteTitle, 'settings.siteTitle'),
    siteDescription: asNonEmptyString(input.settings.siteDescription, 'settings.siteDescription'),
    brandName: asNonEmptyString(input.settings.brandName, 'settings.brandName'),
    brandSubline: asNonEmptyString(input.settings.brandSubline, 'settings.brandSubline'),
    headerCtaLabel: asNonEmptyString(input.settings.headerCtaLabel, 'settings.headerCtaLabel'),
    headerCtaHref: asNonEmptyString(input.settings.headerCtaHref, 'settings.headerCtaHref'),
    spinHint: asNonEmptyString(input.settings.spinHint, 'settings.spinHint'),
    accentColor: asNonEmptyString(input.settings.accentColor, 'settings.accentColor'),
  };

  if (!Array.isArray(input.panels) || input.panels.length === 0) {
    throw new Error('Invalid panels: expected non-empty array');
  }

  const panels = input.panels.map((panel, index) => validatePanel(panel, index));

  const panelIdSet = new Set();
  for (const panel of panels) {
    if (panelIdSet.has(panel.id)) {
      throw new Error(`Duplicate panel id: ${panel.id}`);
    }
    panelIdSet.add(panel.id);
  }

  if (!Array.isArray(input.navItems) || input.navItems.length === 0) {
    throw new Error('Invalid navItems: expected non-empty array');
  }

  const navItems = input.navItems.map((item, index) => {
    if (!isObject(item)) {
      throw new Error(`Invalid navItems[${index}]: expected object`);
    }

    if (!Array.isArray(item.panelIds)) {
      throw new Error(`Invalid navItems[${index}].panelIds: expected array`);
    }

    const normalizedPanelIds = item.panelIds.map((panelId, panelIdIndex) =>
      asNonEmptyString(panelId, `navItems[${index}].panelIds[${panelIdIndex}]`)
    );

    for (const panelId of normalizedPanelIds) {
      if (!panelIdSet.has(panelId)) {
        throw new Error(`Invalid navItems[${index}].panelIds: panel id '${panelId}' does not exist`);
      }
    }

    return {
      id: asNonEmptyString(item.id, `navItems[${index}].id`),
      label: asNonEmptyString(item.label, `navItems[${index}].label`),
      panelIds: normalizedPanelIds,
    };
  });

  return {
    settings,
    panels,
    navItems,
  };
};

const readJsonFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const writeJsonFile = async (filePath, value) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const getOrigin = (req) => {
  const proto = (req.headers['x-forwarded-proto'] ?? 'https').toString().split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] ?? req.headers.host ?? '').toString().split(',')[0].trim();
  if (!host) {
    return null;
  }
  return `${proto}://${host}`;
};

const loadDefaultFromStatic = async (req) => {
  const candidateFiles = [path.join(process.cwd(), 'public', 'cms.json'), path.join(process.cwd(), 'cms.json')];

  for (const filePath of candidateFiles) {
    try {
      return validateCmsConfig(await readJsonFile(filePath));
    } catch {
      // Keep trying other sources.
    }
  }

  const configured = (process.env.CMS_STATIC_SOURCE_URL ?? '').trim();
  const origin = getOrigin(req);
  const sourceUrl = configured || (origin ? `${origin}/cms.json` : '');

  if (!sourceUrl) {
    return FALLBACK_CMS;
  }

  try {
    const response = await fetch(sourceUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
    }
    return validateCmsConfig(await response.json());
  } catch {
    return FALLBACK_CMS;
  }
};

const ensureStorage = async (req) => {
  if (hasR2CmsStorage()) {
    const existing = await readR2JsonObject(CMS_R2_KEY);
    if (existing) {
      return;
    }

    const seeded = await loadDefaultFromStatic(req);
    await writeR2JsonObject(CMS_R2_KEY, validateCmsConfig(seeded));
    return;
  }

  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  await fs.mkdir(REVISIONS_DIR, { recursive: true });

  try {
    await fs.access(ACTIVE_CMS_FILE);
  } catch {
    const seeded = await loadDefaultFromStatic(req);
    await writeJsonFile(ACTIVE_CMS_FILE, validateCmsConfig(seeded));
  }
};

const createRevision = async (req) => {
  const revisionId = `${Date.now()}-${crypto.randomUUID()}`;

  if (hasR2CmsStorage()) {
    const current = await readR2JsonObject(CMS_R2_KEY);
    if (!current) {
      return null;
    }

    const currentValidated = validateCmsConfig(current);
    const revisionKey = `${CMS_R2_REVISIONS_PREFIX}/${revisionId}.json`;
    await writeR2JsonObject(revisionKey, currentValidated);
    return revisionId;
  }

  try {
    await ensureStorage(req);
    const currentRaw = await fs.readFile(ACTIVE_CMS_FILE, 'utf8');
    const revisionPath = path.join(REVISIONS_DIR, `${revisionId}.json`);
    await fs.writeFile(revisionPath, currentRaw, 'utf8');
    return revisionId;
  } catch {
    return null;
  }
};

export const readActiveCmsConfig = async (req) => {
  await ensureStorage(req);

  if (hasR2CmsStorage()) {
    const value = await readR2JsonObject(CMS_R2_KEY, true);
    return validateCmsConfig(value);
  }

  return validateCmsConfig(await readJsonFile(ACTIVE_CMS_FILE));
};

export const writeActiveCmsConfig = async (req, config) => {
  await ensureStorage(req);
  const validated = validateCmsConfig(config);
  await createRevision(req);

  if (hasR2CmsStorage()) {
    await writeR2JsonObject(CMS_R2_KEY, validated);
    return validated;
  }

  await writeJsonFile(ACTIVE_CMS_FILE, validated);
  return validated;
};

export const listRevisions = async () => {
  if (hasR2CmsStorage()) {
    const keys = await listR2RevisionObjectKeys();
    return keys.map((key) => {
      const fileName = key.split('/').pop() ?? '';
      const id = fileName.replace(/\.json$/, '');
      const timestamp = Number(id.split('-')[0]);
      return {
        id,
        createdAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
      };
    });
  }

  await fs.mkdir(REVISIONS_DIR, { recursive: true });
  const entries = await fs.readdir(REVISIONS_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  return files.map((fileName) => {
    const id = fileName.replace(/\.json$/, '');
    const timestamp = Number(id.split('-')[0]);
    return {
      id,
      createdAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
    };
  });
};

export const restoreRevision = async (req, revisionId) => {
  await ensureStorage(req);
  if (!revisionId || revisionId.includes('/') || revisionId.includes('\\')) {
    throw new Error('Invalid revision id');
  }

  if (hasR2CmsStorage()) {
    const revisionKey = `${CMS_R2_REVISIONS_PREFIX}/${revisionId}.json`;
    const revisionConfig = validateCmsConfig(await readR2JsonObject(revisionKey, true));
    await createRevision(req);
    await writeR2JsonObject(CMS_R2_KEY, revisionConfig);
    return revisionConfig;
  }

  const revisionPath = path.join(REVISIONS_DIR, `${revisionId}.json`);
  const revisionConfig = validateCmsConfig(await readJsonFile(revisionPath));
  await createRevision(req);
  await writeJsonFile(ACTIVE_CMS_FILE, revisionConfig);
  return revisionConfig;
};

export const restoreDefaultConfig = async (req) => {
  const restored = validateCmsConfig(await loadDefaultFromStatic(req));
  await createRevision(req);

  if (hasR2CmsStorage()) {
    await writeR2JsonObject(CMS_R2_KEY, restored);
    return restored;
  }

  await writeJsonFile(ACTIVE_CMS_FILE, restored);
  return restored;
};

export const createToken = (username) => {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + CMS_TOKEN_TTL_SECONDS,
    })
  );
  const signature = signTokenInput(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
};

export const verifyToken = (token) => {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Missing token' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Malformed token' };
  }

  const [header, payload, signature] = parts;
  const expectedSignature = signTokenInput(`${header}.${payload}`);
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return { valid: false, reason: 'Invalid signature' };
  }

  let parsedPayload;
  try {
    parsedPayload = JSON.parse(base64UrlDecode(payload));
  } catch {
    return { valid: false, reason: 'Invalid payload' };
  }

  if (!parsedPayload.exp || Number(parsedPayload.exp) < Math.floor(Date.now() / 1000)) {
    return { valid: false, reason: 'Token expired' };
  }

  return { valid: true, payload: parsedPayload };
};

export const authenticate = (username, password) => username === CMS_ADMIN_USER && password === CMS_ADMIN_PASS;

export const getTokenTtlSeconds = () => CMS_TOKEN_TTL_SECONDS;

export const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

export const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
};

export const parseBody = async (req) => {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {};
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

export const getBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim();
};

export const requireAdminAuth = (req, res) => {
  const token = getBearerToken(req);
  const verification = verifyToken(token);

  if (!verification.valid) {
    sendJson(res, 401, {
      error: 'Unauthorized',
      detail: verification.reason,
    });
    return null;
  }

  return verification.payload;
};

export const getCurrentAdminUser = () => CMS_ADMIN_USER;
export const now = nowIso;
