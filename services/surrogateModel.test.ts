import { describe, it, expect } from 'vitest';
import { calculateSimulation } from './surrogateModel';
import { CHILLER_DATASET } from './chillerData';
import { SUPABASE_BASELINE_TABLE } from './supabase';
import type { SimulationInputs, ChillerSpecs } from '../types';

const DEFAULT_SPECS: ChillerSpecs = {
  ratedCapacity: 500,
  ratedEnteringTemp: 95,
  deratingSlope: 1.5,
  lockoutTemp: 127,
  designLoad: 9500,
};

/** Kelvin to °F (must match surrogateModel conversion) */
function kelvinToF(K: number): number {
  return (K - 273.15) * (9 / 5) + 32;
}

/** Build inputs that exactly match a dataset row so the closest match is that row. */
function inputsFromRow(row: number[]): SimulationInputs {
  const windSpeed = row[0];
  const flowRate = row[1] / 1000; // CFM → kCFM
  const orientation = row[2];
  const rowSpacing = row[3];
  return {
    rows: 4,
    columns: 5,
    rowSpacing,
    colSpacing: 8,
    windSpeed,
    windDirection: orientation,
    flowRate,
    ambientTemp: 104,
    layout: Array(20).fill(true),
    eftBase: false,
    fanExtension: false,
  };
}

const DATA_START_INDEX = 4;
/** Display rounds to 1 decimal (toFixed(1)); allow up to 0.05 °F difference */
const TOLERANCE = 0.05;

describe('Surrogate model: output temps vs database', () => {
  it('uses table Exhaust flow Data (documentation)', () => {
    expect(SUPABASE_BASELINE_TABLE).toBe('Exhaust flow Data');
  });

  it('when inputs exactly match a row, displayed temps match DB temps (row 0)', () => {
    const row = CHILLER_DATASET[0];
    const inputs = inputsFromRow(row);
    const result = calculateSimulation(inputs, CHILLER_DATASET, DEFAULT_SPECS);

    expect(result.grid.length).toBe(20);
    for (let i = 0; i < 20; i++) {
      const expectedTempF = kelvinToF(row[DATA_START_INDEX + i] ?? 313.15);
      const displayedTemp = result.grid[i].totalTemp;
      expect(
        Math.abs(displayedTemp - expectedTempF) < TOLERANCE,
        `cell ${i}: displayed ${displayedTemp} vs DB ${expectedTempF.toFixed(2)} °F`
      ).toBe(true);
    }
  });

  it('when inputs exactly match a row, displayed temps match DB temps (row 5)', () => {
    const row = CHILLER_DATASET[5];
    const inputs = inputsFromRow(row);
    const result = calculateSimulation(inputs, CHILLER_DATASET, DEFAULT_SPECS);

    expect(result.grid.length).toBe(20);
    for (let i = 0; i < 20; i++) {
      const expectedTempF = kelvinToF(row[DATA_START_INDEX + i] ?? 313.15);
      const displayedTemp = result.grid[i].totalTemp;
      expect(Math.abs(displayedTemp - expectedTempF)).toBeLessThan(TOLERANCE);
    }
  });

  it('when inputs exactly match a row, displayed temps match DB temps (last row)', () => {
    const row = CHILLER_DATASET[CHILLER_DATASET.length - 1];
    const inputs = inputsFromRow(row);
    const result = calculateSimulation(inputs, CHILLER_DATASET, DEFAULT_SPECS);

    expect(result.grid.length).toBe(20);
    for (let i = 0; i < 20; i++) {
      const expectedTempF = kelvinToF(row[DATA_START_INDEX + i] ?? 313.15);
      const displayedTemp = result.grid[i].totalTemp;
      expect(Math.abs(displayedTemp - expectedTempF)).toBeLessThan(TOLERANCE);
    }
  });

  it('picks nearest row: near-match inputs show that row’s temps', () => {
    // Use a row and nudge inputs slightly so the same row is still closest
    const row = CHILLER_DATASET[3];
    const inputs = inputsFromRow(row);
    inputs.windSpeed += 0.01;
    inputs.flowRate += 0.5;
    const result = calculateSimulation(inputs, CHILLER_DATASET, DEFAULT_SPECS);

    // Should still match row 3’s temps (nearest neighbor)
    for (let i = 0; i < 20; i++) {
      const expectedTempF = kelvinToF(row[DATA_START_INDEX + i] ?? 313.15);
      const displayedTemp = result.grid[i].totalTemp;
      expect(Math.abs(displayedTemp - expectedTempF)).toBeLessThan(TOLERANCE);
    }
  });
});
