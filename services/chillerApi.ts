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

/** Chiller prediction API on AWS EC2. */
const DEFAULT_CHILLER_API_URL = 'http://3.16.135.140:8080';

/** In dev we use the Vite proxy so the browser never hits EC2 directly (avoids timeout/CORS). */
const PROXY_PATH = '/chiller-api';

/**
 * Returns the chiller prediction API base URL (no trailing slash).
 * In development we use the proxy path by default so requests go via the dev server to EC2 (no direct browser→EC2).
 * Set VITE_CHILLER_API_URL= (empty) to use Supabase for temperatures instead.
 */
export function getChillerApiUrl(): string | null {
  const isDev = import.meta.env.DEV;
  const forceDirect = import.meta.env.VITE_CHILLER_DIRECT === 'true';
  if (isDev && !forceDirect) return PROXY_PATH;

  const raw = import.meta.env.VITE_CHILLER_API_URL ?? import.meta.env.VITE_CHILLER_PREDICTION_API_URL;
  const url = raw === undefined ? DEFAULT_CHILLER_API_URL : (typeof raw === 'string' ? raw.trim() : '');
  const base = typeof url === 'string' ? url : '';
  return base.length > 0 ? base.replace(/\/$/, '') : null;
}

/**
 * Call the chiller prediction API. Returns a row in the same format as the dataset:
 * [windSpeed, cfm, orientation, spacing, T0, T1, ..., T19] with temps in Kelvin.
 */
export async function fetchChillerPrediction(
  baseUrl: string,
  params: ChillerPredictParams
): Promise<ChillerPredictResult> {
  const url = `${baseUrl}/predict`;
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
