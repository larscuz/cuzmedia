import { authenticate, createToken, getTokenTtlSeconds, parseBody, sendJson, setCorsHeaders } from '../_lib/cmsRuntime.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseBody(req);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!authenticate(username, password)) {
      sendJson(res, 401, { error: 'Invalid username or password' });
      return;
    }

    const token = createToken(username);
    sendJson(res, 200, {
      token,
      expiresInSeconds: getTokenTtlSeconds(),
    });
  } catch (error) {
    sendJson(res, 400, {
      error: 'Request failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
