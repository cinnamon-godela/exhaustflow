#!/usr/bin/env node
/**
 * Chiller API ground-truth test.
 * For each (spacing, rowName) in ground truth:
 *   - Derives Windspeed, CFM, Orientation, Spacing and calls POST /predict.
 *   - Compares the 20 predicted temps to ground truth and outputs deltas.
 *
 * Usage: node scripts/test-chiller-api-ground-truth.js [baseUrl]
 * Default baseUrl: http://3.16.135.140:8080
 */

import { GROUND_TRUTH, getParamsFromRowName } from './ground-truth-chiller.js';

const DEFAULT_BASE_URL = 'http://3.16.135.140:8080';
const baseUrl = (process.argv[2] || DEFAULT_BASE_URL).replace(/\/$/, '');

const OUTPUT_KEYS = Array.from({ length: 20 }, (_, i) => `Chiller ${String(i + 1).padStart(2, '0')}`);

async function callPredict(body) {
  const res = await fetch(`${baseUrl}/predict`, {
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

function extractTemps(data) {
  const temps = [];
  for (const key of OUTPUT_KEYS) {
    const v = data[key];
    if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`Missing or invalid ${key}`);
    temps.push(v);
  }
  return temps;
}

function computeDeltas(predicted, truth) {
  const deltas = predicted.map((p, i) => p - truth[i]);
  const absDeltas = deltas.map((d) => Math.abs(d));
  const maxAbs = Math.max(...absDeltas);
  const meanAbs = absDeltas.reduce((a, b) => a + b, 0) / absDeltas.length;
  const rmse = Math.sqrt(deltas.reduce((s, d) => s + d * d, 0) / deltas.length);
  return { deltas, maxAbs, meanAbs, rmse };
}

function runOne(spacing, rowName, truthTemps) {
  const { windSpeed, cfm, orientation } = getParamsFromRowName(rowName);
  const body = { Windspeed: windSpeed, CFM: cfm, Orientation: orientation, Spacing: spacing };
  return { body, spacing, rowName, truthTemps };
}

async function main() {
  const results = [];
  const configs = [];
  for (const [spacingStr, rows] of Object.entries(GROUND_TRUTH)) {
    const spacing = Number(spacingStr);
    for (const [rowName, truthTemps] of Object.entries(rows)) {
      configs.push(runOne(spacing, rowName, truthTemps));
    }
  }

  console.log(`Chiller API ground-truth test\nBase URL: ${baseUrl}\nConfigs: ${configs.length}\n`);

  for (const { body, spacing, rowName, truthTemps } of configs) {
    try {
      const data = await callPredict(body);
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

  // --- Output: details per config ---
  console.log('--- Per-config deltas (prediction - ground truth) ---\n');
  let okCount = 0;
  let failCount = 0;
  const allMaxAbs = [];
  const allRmse = [];

  for (const r of results) {
    const label = `Spacing ${r.spacing} ft | ${r.rowName}`;
    if (r.error) {
      failCount++;
      console.log(`${label}\n  ERROR: ${r.error}\n`);
      continue;
    }
    okCount++;
    allMaxAbs.push(r.maxAbs);
    allRmse.push(r.rmse);
    console.log(`${label}`);
    console.log(`  Params: Windspeed=${r.params.Windspeed} m/s, CFM=${r.params.CFM}, Orientation=${r.params.Orientation}°, Spacing=${r.params.Spacing} ft`);
    console.log(`  Summary: max|delta| = ${r.maxAbs.toFixed(4)} K, mean|delta| = ${r.meanAbs.toFixed(4)} K, RMSE = ${r.rmse.toFixed(4)} K`);
    console.log('  Deltas (Chiller 1..20):');
    const line = r.deltas.map((d, i) => `Ch${i + 1}:${d >= 0 ? '+' : ''}${d.toFixed(3)}`).join('  ');
    console.log(`    ${line}`);
    console.log('');
  }

  // --- Summary ---
  console.log('--- Summary ---');
  console.log(`Total configs: ${results.length}, OK: ${okCount}, Failed: ${failCount}`);
  if (allMaxAbs.length) {
    console.log(`Overall max |delta|: ${Math.max(...allMaxAbs).toFixed(4)} K`);
    console.log(`Overall max RMSE (per config): ${Math.max(...allRmse).toFixed(4)} K`);
    console.log(`Mean RMSE across configs: ${(allRmse.reduce((a, b) => a + b, 0) / allRmse.length).toFixed(4)} K`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
