/**
 * Parameter ranges covered in the database. Values outside these bounds are
 * clamped (bounced) to the min/max so lookup stays within the data.
 */
export const DATABASE_PARAMETER_BOUNDS = {
  windSpeed: { min: 0, max: 10.0 },
  cfm: { min: 30_000, max: 150_000 },
  orientation: { min: 0, max: 90 },
  rowSpacing: { min: 10.0, max: 20.0 },
} as const;

export interface InputRanges {
  windSpeed: { min: number; max: number };
  flowRateKcfm: { min: number; max: number }; // CFM → kCFM for internal state
  orientation: { min: number; max: number };
  rowSpacing: { min: number; max: number };
}

/** Returns the database parameter bounds as InputRanges (always defined; used for clamping and sliders). */
export function getInputRanges(_dataset?: number[][]): InputRanges {
  const b = DATABASE_PARAMETER_BOUNDS;
  return {
    windSpeed: { min: b.windSpeed.min, max: b.windSpeed.max },
    flowRateKcfm: { min: b.cfm.min / 1000, max: b.cfm.max / 1000 },
    orientation: { min: b.orientation.min, max: b.orientation.max },
    rowSpacing: { min: b.rowSpacing.min, max: b.rowSpacing.max },
  };
}

/** Clamp a value to a range */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
