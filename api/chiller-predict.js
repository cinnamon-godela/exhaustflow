/**
 * Vercel serverless proxy: POST /api/chiller-predict -> EC2 chiller API.
 * Fixes Mixed Content: HTTPS page cannot call http://... from the browser.
 */

const EC2_URL = 'http://3.16.135.140:8080/predict';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Chiller proxy; POST with { Windspeed, CFM, Orientation, Spacing }' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (body == null) body = {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    if (typeof body !== 'object') body = {};

    const response = await fetch(EC2_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || 'Invalid JSON from API' };
    }
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[chiller-predict proxy]', err);
    return res.status(502).json({ error: err.message || 'Proxy error' });
  }
}
