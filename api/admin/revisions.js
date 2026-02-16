import { listRevisions, requireAdminAuth, sendJson, setCorsHeaders } from '../_lib/cmsRuntime.js';

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

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    const revisions = await listRevisions();
    sendJson(res, 200, {
      revisions,
      authenticatedAs: authPayload.sub,
    });
  } catch (error) {
    sendJson(res, 400, {
      error: 'Request failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
