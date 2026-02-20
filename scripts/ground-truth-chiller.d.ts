export type GroundTruthMap = Record<string, number[]>;
export const GROUND_TRUTH: Record<number, GroundTruthMap>;
export function getParamsFromRowName(rowName: string): { windSpeed: number; cfm: number; orientation: number };
