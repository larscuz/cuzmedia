import { now, parseBody, readActiveCmsConfig, requireAdminAuth, sendJson, setCorsHeaders, writeActiveCmsConfig } from '../_lib/cmsRuntime.js';

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

    if (req.method === 'GET') {
      const cms = await readActiveCmsConfig(req);
      sendJson(res, 200, {
        cms,
        authenticatedAs: authPayload.sub,
      });
      return;
    }

    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const saved = await writeActiveCmsConfig(req, body);
      sendJson(res, 200, {
        ok: true,
        cms: saved,
        updatedAt: now(),
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    sendJson(res, 400, {
      error: 'Request failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
