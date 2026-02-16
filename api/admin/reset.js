import { now, requireAdminAuth, restoreDefaultConfig, sendJson, setCorsHeaders } from '../_lib/cmsRuntime.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const authPayload = requireAdminAuth(req, res);
    if (!authPayload) {
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    const restored = await restoreDefaultConfig(req);
    sendJson(res, 200, {
      ok: true,
      cms: restored,
      restoredAt: now(),
      authenticatedAs: authPayload.sub,
    });
  } catch (error) {
    sendJson(res, 400, {
      error: 'Request failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
