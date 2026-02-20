/**
 * Chiller Prediction API client.
 * Replaces database lookup when VITE_CHILLER_API_URL is set.
 * API: POST /predict with { Windspeed, CFM, Orientation, Spacing } -> { "Chiller 01": T, ... "Chiller 20": T }.
 * Temperatures are assumed to be in Kelvin (same as dataset); the app converts to °F for display.
 */

const OUTPUT_KEYS = Array.from({ length: 20 }, (_, i) => `Chiller ${String(i + 1).padStart(2, '0')}`);

export type ChillerPredictParams = {
  windSpeed: number;   // m/s
  cfm: number;        // CFM (not kCFM)
  orientation: number; // degrees
  spacing: number;     // ft (row spacing)
};

export type ChillerPredictResult =
  | { ok: true; row: number[] }
  | { ok: false; error: string };

/** Chiller API on AWS EC2 (HTTP). Not used from HTTPS pages (mixed content blocked). */
const DEFAULT_CHILLER_API_URL = 'http://3.16.135.140:8080';

/** In dev we use the Vite proxy so the browser never hits EC2 directly. */
const PROXY_PATH = '/chiller-api';

/** In production (Vercel) we use same-origin proxy so HTTPS works (no mixed content). */
const PRODUCTION_PROXY_PATH = '/api/chiller-predict';

/**
 * Returns the chiller API base URL or proxy path.
 * - Dev: Vite proxy /chiller-api (forwards to EC2).
 * - Production: same-origin /api/chiller-predict (Vercel serverless forwards to EC2).
 */
export function getChillerApiUrl(): string | null {
  const isDev = import.meta.env.DEV;
  const forceDirect = import.meta.env.VITE_CHILLER_DIRECT === 'true';
  if (isDev && !forceDirect) return PROXY_PATH;

  const raw = import.meta.env.VITE_CHILLER_API_URL ?? import.meta.env.VITE_CHILLER_PREDICTION_API_URL;
  if (raw !== undefined && typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().replace(/\/$/, '');
  }
  return PRODUCTION_PROXY_PATH;
}

/**
 * Call the chiller prediction API. Returns a row in the same format as the dataset:
 * [windSpeed, cfm, orientation, spacing, T0, T1, ..., T19] with temps in Kelvin.
 */
export async function fetchChillerPrediction(
  baseUrl: string,
  params: ChillerPredictParams
): Promise<ChillerPredictResult> {
  const url = baseUrl === '/api/chiller-predict' ? baseUrl : `${baseUrl.replace(/\/$/, '')}/predict`;
  const body = {
    Windspeed: params.windSpeed,
    CFM: params.cfm,
    Orientation: params.orientation,
    Spacing: params.spacing,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      let detail = text;
      try {
        const j = JSON.parse(text);
        if (j.detail) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      } catch {
        // use text as-is
      }
      const errMsg = `API ${res.status}: ${detail}`;
      console.error('[Chiller API]', errMsg);
      return { ok: false, error: errMsg };
    }

    const data = (await res.json()) as Record<string, number>;
    const temps: number[] = [];
    for (const key of OUTPUT_KEYS) {
      const v = data[key];
      if (typeof v !== 'number' || Number.isNaN(v)) {
        return { ok: false, error: `Missing or invalid ${key} in response` };
      }
      temps.push(v);
    }

    const row: number[] = [
      params.windSpeed,
      params.cfm,
      params.orientation,
      params.spacing,
      ...temps,
    ];
    return { ok: true, row };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const fullError =
      message === 'Failed to fetch'
        ? `Failed to fetch from ${url}. Is the API running? If so, check CORS (browser may block cross-origin requests) and that the URL is correct.`
        : message;
    console.error('[Chiller API] request failed:', fullError, e);
    return { ok: false, error: fullError };
  }
}

/**
 * Health check for the API.
 */
export async function checkChillerApiHealth(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
