import http from 'node:http';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DEFAULT_CMS_FILE = path.join(DATA_DIR, 'default-cms.json');
const ACTIVE_CMS_FILE = path.join(DATA_DIR, 'cms.json');
const REVISIONS_DIR = path.join(DATA_DIR, 'revisions');

const CMS_PORT = Number(process.env.CMS_PORT ?? 8787);
const CMS_ALLOWED_ORIGIN = process.env.CMS_ALLOWED_ORIGIN ?? '*';
const CMS_ADMIN_USER = process.env.CMS_ADMIN_USER ?? 'admin';
const CMS_ADMIN_PASS = process.env.CMS_ADMIN_PASS ?? '@3quallyshitty';
const CMS_TOKEN_SECRET = process.env.CMS_TOKEN_SECRET ?? 'replace-this-secret-in-production';
const CMS_TOKEN_TTL_SECONDS = Number(process.env.CMS_TOKEN_TTL_SECONDS ?? 60 * 60 * 12);

const MAX_BODY_SIZE_BYTES = 5 * 1024 * 1024;

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

const createToken = (username) => {
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

const verifyToken = (token) => {
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

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
};

const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin;
  const allowOrigin = CMS_ALLOWED_ORIGIN === '*' ? '*' : CMS_ALLOWED_ORIGIN;

  if (allowOrigin === '*' || origin === allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin === '*' ? '*' : origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
};

const parseBody = async (req) => {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_SIZE_BYTES) {
      throw new Error('Request body too large');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
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

const validateCmsConfig = (input) => {
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

const ensureStorage = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(REVISIONS_DIR, { recursive: true });

  try {
    await fs.access(DEFAULT_CMS_FILE);
  } catch {
    throw new Error(`Missing default CMS file at ${DEFAULT_CMS_FILE}`);
  }

  try {
    await fs.access(ACTIVE_CMS_FILE);
  } catch {
    const defaultRaw = await fs.readFile(DEFAULT_CMS_FILE, 'utf8');
    await fs.writeFile(ACTIVE_CMS_FILE, defaultRaw, 'utf8');
  }
};

const readJsonFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const readActiveCmsConfig = async () => {
  const rawConfig = await readJsonFile(ACTIVE_CMS_FILE);
  return validateCmsConfig(rawConfig);
};

const createRevision = async () => {
  try {
    const currentRaw = await fs.readFile(ACTIVE_CMS_FILE, 'utf8');
    const revisionId = `${Date.now()}-${crypto.randomUUID()}`;
    const revisionPath = path.join(REVISIONS_DIR, `${revisionId}.json`);
    await fs.writeFile(revisionPath, currentRaw, 'utf8');
    return revisionId;
  } catch {
    return null;
  }
};

const writeActiveCmsConfig = async (config) => {
  const validated = validateCmsConfig(config);
  await createRevision();
  await fs.writeFile(ACTIVE_CMS_FILE, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
  return validated;
};

const listRevisions = async () => {
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

const restoreRevision = async (revisionId) => {
  if (!revisionId || revisionId.includes('/') || revisionId.includes('\\')) {
    throw new Error('Invalid revision id');
  }

  const revisionPath = path.join(REVISIONS_DIR, `${revisionId}.json`);
  const revisionConfig = validateCmsConfig(await readJsonFile(revisionPath));
  await createRevision();
  await fs.writeFile(ACTIVE_CMS_FILE, `${JSON.stringify(revisionConfig, null, 2)}\n`, 'utf8');
  return revisionConfig;
};

const restoreDefaultConfig = async () => {
  const defaultConfig = validateCmsConfig(await readJsonFile(DEFAULT_CMS_FILE));
  await createRevision();
  await fs.writeFile(ACTIVE_CMS_FILE, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
  return defaultConfig;
};

const getAuthTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim();
};

const requireAdminAuth = (req, res) => {
  const token = getAuthTokenFromRequest(req);
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

const server = http.createServer(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url) {
    sendJson(res, 400, { error: 'Missing URL' });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'ok',
        now: nowIso(),
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/cms') {
      const cms = await readActiveCmsConfig();
      sendJson(res, 200, cms);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/login') {
      const body = await parseBody(req);
      const username = isString(body.username) ? body.username.trim() : '';
      const password = isString(body.password) ? body.password : '';

      if (username !== CMS_ADMIN_USER || password !== CMS_ADMIN_PASS) {
        sendJson(res, 401, { error: 'Invalid username or password' });
        return;
      }

      const token = createToken(username);
      sendJson(res, 200, {
        token,
        expiresInSeconds: CMS_TOKEN_TTL_SECONDS,
      });
      return;
    }

    if (pathname.startsWith('/api/admin/')) {
      const authPayload = requireAdminAuth(req, res);
      if (!authPayload) {
        return;
      }

      if (req.method === 'GET' && pathname === '/api/admin/cms') {
        const cms = await readActiveCmsConfig();
        sendJson(res, 200, {
          cms,
          authenticatedAs: authPayload.sub,
        });
        return;
      }

      if (req.method === 'PUT' && pathname === '/api/admin/cms') {
        const body = await parseBody(req);
        const saved = await writeActiveCmsConfig(body);
        sendJson(res, 200, {
          ok: true,
          cms: saved,
          updatedAt: nowIso(),
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/admin/revisions') {
        const revisions = await listRevisions();
        sendJson(res, 200, { revisions });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/admin/reset') {
        const restored = await restoreDefaultConfig();
        sendJson(res, 200, {
          ok: true,
          cms: restored,
          restoredAt: nowIso(),
        });
        return;
      }

      if (req.method === 'POST' && pathname.startsWith('/api/admin/revisions/')) {
        const revisionId = pathname.replace('/api/admin/revisions/', '').replace('/restore', '').trim();
        if (!pathname.endsWith('/restore')) {
          sendJson(res, 404, { error: 'Not found' });
          return;
        }

        const restored = await restoreRevision(revisionId);
        sendJson(res, 200, {
          ok: true,
          cms: restored,
          revisionId,
          restoredAt: nowIso(),
        });
        return;
      }
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 400, {
      error: 'Request failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const boot = async () => {
  await ensureStorage();

  server.listen(CMS_PORT, '127.0.0.1', () => {
    console.log(`[cms] running on http://127.0.0.1:${CMS_PORT}`);
    console.log(`[cms] admin user: ${CMS_ADMIN_USER}`);
    if (CMS_ADMIN_PASS === '@3quallyshitty') {
      console.warn('[cms] WARNING: using default CMS_ADMIN_PASS. Set env vars before production use.');
    }
  });
};

boot().catch((error) => {
  console.error('[cms] failed to start:', error);
  process.exit(1);
});
