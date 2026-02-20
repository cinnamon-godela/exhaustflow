/**
 * Run chiller API ground-truth test in the app.
 * Calls POST /predict for each config, compares to ground truth, returns deltas.
 */

import { GROUND_TRUTH, getParamsFromRowName } from '../scripts/ground-truth-chiller.js';

const OUTPUT_KEYS = Array.from({ length: 20 }, (_, i) => `Chiller ${String(i + 1).padStart(2, '0')}`);

export type ConfigResult = {
  spacing: number;
  rowName: string;
  params: { Windspeed: number; CFM: number; Orientation: number; Spacing: number };
  predicted: number[] | null;
  truth: number[];
  deltas: number[] | null;
  maxAbs: number | null;
  meanAbs: number | null;
  rmse: number | null;
  error: string | null;
};

export type GroundTruthTestSummary = {
  total: number;
  ok: number;
  failed: number;
  overallMaxAbs: number;
  maxRmse: number;
  meanRmse: number;
};

export type GroundTruthTestOutput = {
  results: ConfigResult[];
  summary: GroundTruthTestSummary;
};

async function callPredict(baseUrl: string, body: Record<string, number>): Promise<Record<string, number>> {
  const url = baseUrl === '/api/chiller-predict' ? baseUrl : `${baseUrl.replace(/\/$/, '')}/predict`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

function extractTemps(data: Record<string, number>): number[] {
  const temps: number[] = [];
  for (const key of OUTPUT_KEYS) {
    const v = data[key];
    if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`Missing or invalid ${key}`);
    temps.push(v);
  }
  return temps;
}

function computeDeltas(predicted: number[], truth: number[]) {
  const deltas = predicted.map((p, i) => p - truth[i]);
  const absDeltas = deltas.map((d) => Math.abs(d));
  const maxAbs = Math.max(...absDeltas);
  const meanAbs = absDeltas.reduce((a, b) => a + b, 0) / absDeltas.length;
  const rmse = Math.sqrt(deltas.reduce((s, d) => s + d * d, 0) / deltas.length);
  return { deltas, maxAbs, meanAbs, rmse };
}

/**
 * Run the ground-truth test against the chiller API at baseUrl.
 * Returns per-config results and summary (deltas in Kelvin).
 */
export async function runGroundTruthTest(baseUrl: string): Promise<GroundTruthTestOutput> {
  const results: ConfigResult[] = [];
  const configs: { spacing: number; rowName: string; truthTemps: number[] }[] = [];

  for (const [spacingStr, rows] of Object.entries(GROUND_TRUTH)) {
    const spacing = Number(spacingStr);
    for (const [rowName, truthTemps] of Object.entries(rows)) {
      configs.push({ spacing, rowName, truthTemps });
    }
  }

  for (const { spacing, rowName, truthTemps } of configs) {
    const { windSpeed, cfm, orientation } = getParamsFromRowName(rowName);
    const body = { Windspeed: windSpeed, CFM: cfm, Orientation: orientation, Spacing: spacing };

    try {
      const data = await callPredict(baseUrl, body);
      const predicted = extractTemps(data);
      const { deltas, maxAbs, meanAbs, rmse } = computeDeltas(predicted, truthTemps);
      results.push({
        spacing,
        rowName,
        params: body,
        predicted,
        truth: truthTemps,
        deltas,
        maxAbs,
        meanAbs,
        rmse,
        error: null,
      });
    } catch (err) {
      results.push({
        spacing,
        rowName,
        params: body,
        predicted: null,
        truth: truthTemps,
        deltas: null,
        maxAbs: null,
        meanAbs: null,
        rmse: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const okResults = results.filter((r) => r.error == null);
  const allMaxAbs = okResults.map((r) => r.maxAbs!);
  const allRmse = okResults.map((r) => r.rmse!);

  const summary: GroundTruthTestSummary = {
    total: results.length,
    ok: okResults.length,
    failed: results.length - okResults.length,
    overallMaxAbs: allMaxAbs.length ? Math.max(...allMaxAbs) : 0,
    maxRmse: allRmse.length ? Math.max(...allRmse) : 0,
    meanRmse: allRmse.length ? allRmse.reduce((a, b) => a + b, 0) / allRmse.length : 0,
  };

  return { results, summary };
}
