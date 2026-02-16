import { parseBody, requireAdminAuth, sendJson, setCorsHeaders } from '../_lib/cmsRuntime.js';
import { createSignedUpload } from '../_lib/r2Upload.js';

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

    const body = await parseBody(req);
    const filename = typeof body.filename === 'string' ? body.filename : '';
    const contentType = typeof body.contentType === 'string' ? body.contentType : '';
    const panelId = typeof body.panelId === 'string' ? body.panelId : '';
    const kind = body.kind === 'video' ? 'video' : body.kind === 'image' ? 'image' : '';
    const fileSize = Number(body.fileSize ?? 0);

    if (!filename.trim()) {
      sendJson(res, 400, { error: 'filename is required' });
      return;
    }

    if (!kind) {
      sendJson(res, 400, { error: "kind must be either 'video' or 'image'" });
      return;
    }

    const signed = await createSignedUpload({
      filename,
      contentType,
      fileSize,
      kind,
      panelId,
    });

    sendJson(res, 200, {
      ok: true,
      authenticatedAs: authPayload.sub,
      ...signed,
    });
  } catch (error) {
    sendJson(res, 400, {
      error: 'Request failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
