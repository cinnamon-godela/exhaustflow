import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase configuration – baseline chiller data
// ---------------------------------------------------------------------------
// Table: "Exhaust flow Data"
// CSV columns: ID, Windspeed, CFM, Wind Direction, Row Spacing,
//              Chiller 01, Chiller 02, ... Chiller 20 (temperatures in Kelvin)
// We map to internal format: [windspeed, cfm, wind_direction, row_spacing, T0..T19]
// Display: Kelvin → Fahrenheit in the app.
// ---------------------------------------------------------------------------

/** Table name used for baseline chiller lookup (Supabase table: "Exhaust flow Data"). */
export const SUPABASE_BASELINE_TABLE = 'Exhaust flow Data' as const;

// Env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY (from .env)
const FALLBACK_URL = 'https://vccuhgecucsbuiyqbqlz.supabase.co';
const FALLBACK_KEY = 'sb_publishable_0fy32YyKPt73BYXPzP6BlA_NOnuMG5Y';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || FALLBACK_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey) 
    ? createClient(supabaseUrl, supabaseAnonKey) 
    : null;

export interface SavedSimulation {
    id: string;
    created_at: string;
    name: string;
    inputs: any;
    results: any;
}

/** Result of fetching baseline data: either data rows (with optional IDs) or an error message. */
export type FetchBaselineResult =
    | { ok: true; data: number[][]; rowCount: number; rowIds: (string | number)[] }
    | { ok: false; error: string };

/** Normalize column name for comparison: lowercase, spaces → underscores. */
function norm(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '_').trim();
}

/** Pick first defined value from row using possible column names (case-insensitive, spaces = underscores). */
function pickColumn(row: Record<string, unknown>, ...names: string[]): unknown {
    const keys = Object.keys(row);
    for (const name of names) {
        const n = norm(name);
        const key = keys.find((k) => norm(k) === n);
        if (key != null && row[key] !== undefined && row[key] !== null) return row[key];
    }
    return undefined;
}

/**
 * Fetches the baseline dataset from Supabase (table: "Exhaust flow Data").
 * Tolerates different column names: wind_speed/Wind Speed, flow_rate/Flow Rate/CFM, etc.
 * Returns structured result so the app can show row count or error.
 */
export const fetchBaselineDataset = async (): Promise<FetchBaselineResult> => {
    if (!supabase) {
        const msg = 'Supabase client not configured (missing URL or key).';
        console.warn('[Supabase]', msg);
        return { ok: false, error: msg };
    }

    try {
        const { data, error } = await supabase
            .from(SUPABASE_BASELINE_TABLE)
            .select('*');

        if (error) {
            console.warn('[Supabase] fetch error:', error.message, error.details);
            return { ok: false, error: error.message };
        }

        if (!data || data.length === 0) {
            console.warn('[Supabase] table is empty or no rows returned.');
            return { ok: false, error: 'Table is empty or no rows returned.' };
        }

        // Map DB columns: Windspeed, CFM, Wind Direction, Row Spacing, Chiller 01..Chiller 20
        const first = data[0] as Record<string, unknown>;
        const windSpeed = pickColumn(first, 'Windspeed', 'windspeed', 'wind_speed', 'Wind Speed');
        const cfm = pickColumn(first, 'CFM', 'cfm', 'flow_rate', 'Flow Rate');
        const windDir = pickColumn(first, 'Wind Direction', 'wind_direction', 'orientation', 'Orientation');
        const rowSpacing = pickColumn(first, 'Row Spacing', 'row_spacing', 'spacing', 'Spacing');

        const missing: string[] = [];
        if (windSpeed === undefined) missing.push('Windspeed');
        if (cfm === undefined) missing.push('CFM');
        if (windDir === undefined) missing.push('Wind Direction');
        if (rowSpacing === undefined) missing.push('Row Spacing');

        // Chiller 01 .. Chiller 20 (20 separate columns; temps in Kelvin)
        const chillerKeys: string[] = [];
        for (let i = 1; i <= 20; i++) {
            const label = `Chiller ${String(i).padStart(2, '0')}`;
            const key = Object.keys(first).find((k) => norm(k) === norm(label));
            if (key != null) chillerKeys.push(key);
            else missing.push(label);
        }

        if (missing.length > 0) {
            const msg = `Table missing columns: ${missing.join(', ')}. Available: ${Object.keys(first).join(', ')}`;
            console.warn('[Supabase]', msg);
            return { ok: false, error: msg };
        }

        const pairs = data.map((row: Record<string, unknown>, index: number) => {
            const ws = Number(pickColumn(row, 'Windspeed', 'windspeed', 'wind_speed', 'Wind Speed') ?? 0);
            const fr = Number(pickColumn(row, 'CFM', 'cfm', 'flow_rate', 'Flow Rate') ?? 0);
            const or = Number(pickColumn(row, 'Wind Direction', 'wind_direction', 'orientation', 'Orientation') ?? 0);
            const sp = Number(pickColumn(row, 'Row Spacing', 'row_spacing', 'spacing', 'Spacing') ?? 0);
            const temps = chillerKeys.map((key) => Number(row[key] ?? 0));
            const id = pickColumn(row, 'ID', 'id');
            return {
                row: [ws, fr, or, sp, ...temps] as number[],
                id: id !== undefined && id !== null ? String(id) : index + 1
            };
        });

        const validPairs = pairs.filter((p) => p.row.length >= 5 && !p.row.some(isNaN));
        if (validPairs.length === 0) {
            const msg = 'No valid rows (need wind_speed, flow_rate, orientation, spacing, temperatures with 20 temps).';
            console.warn('[Supabase]', msg);
            return { ok: false, error: msg };
        }

        const validRows = validPairs.map((p) => p.row);
        const rowIds = validPairs.map((p) => p.id);
        console.info('[Supabase] Loaded', validRows.length, 'rows from "Exhaust flow Data".');
        return { ok: true, data: validRows, rowCount: validRows.length, rowIds };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Supabase] Unexpected error:', err);
        return { ok: false, error: message };
    }
};

/** Result of fetching a single baseline row by ID. */
export type FetchBaselineRowByIdResult =
    | { ok: true; row: number[]; id: string | number }
    | { ok: false; error: string };

/**
 * Fetches a single row from the baseline table by ID (for debugging / reverse-populate inputs).
 * Returns the same format as dataset rows: [windspeed, cfm, wind_direction, row_spacing, T0..T19].
 */
export async function fetchBaselineRowById(id: string | number): Promise<FetchBaselineRowByIdResult> {
    if (!supabase) {
        return { ok: false, error: 'Supabase client not configured.' };
    }
    const idNum = typeof id === 'string' ? (id.trim() === '' ? NaN : Number(id)) : id;
    if (isNaN(idNum) && typeof id !== 'string') {
        return { ok: false, error: 'Invalid ID.' };
    }
    try {
        const { data, error } = await supabase
            .from(SUPABASE_BASELINE_TABLE)
            .select('*')
            .eq('ID', idNum)
            .maybeSingle();

        if (error) {
            console.warn('[Supabase] fetchBaselineRowById error:', error);
            return { ok: false, error: error.message };
        }
        if (data == null) {
            return { ok: false, error: `ID ${id} not found in database.` };
        }

        const row = data as Record<string, unknown>;
        const ws = Number(pickColumn(row, 'Windspeed', 'windspeed', 'wind_speed', 'Wind Speed') ?? 0);
        const cfm = Number(pickColumn(row, 'CFM', 'cfm', 'flow_rate', 'Flow Rate') ?? 0);
        const or = Number(pickColumn(row, 'Wind Direction', 'wind_direction', 'orientation', 'Orientation') ?? 0);
        const sp = Number(pickColumn(row, 'Row Spacing', 'row_spacing', 'spacing', 'Spacing') ?? 0);
        const chillerKeys: string[] = [];
        for (let i = 1; i <= 20; i++) {
            const label = `Chiller ${String(i).padStart(2, '0')}`;
            const key = Object.keys(row).find((k) => norm(k) === norm(label));
            if (key != null) chillerKeys.push(key);
        }
        if (chillerKeys.length !== 20) {
            return { ok: false, error: 'Row missing Chiller 01–20 columns.' };
        }
        const temps = chillerKeys.map((key) => Number(row[key] ?? 0));
        const rowId = pickColumn(row, 'ID', 'id');
        const outId = rowId !== undefined && rowId !== null ? String(rowId) : id;
        const outRow: number[] = [ws, cfm, or, sp, ...temps];
        if (outRow.some(isNaN)) {
            return { ok: false, error: 'Row contains invalid numbers.' };
        }
        return { ok: true, row: outRow, id: outId };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Supabase] fetchBaselineRowById error:', err);
        return { ok: false, error: message };
    }
}