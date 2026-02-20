import { createClient } from '@supabase/supabase-js';

// NOTE: In a real Vite environment, use import.meta.env.VITE_SUPABASE_URL
// For this environment, we assume process.env or direct string replacement.

// User provided credentials
const FALLBACK_URL = 'https://vccuhgecucsbuiyqbqlz.supabase.co';
const FALLBACK_KEY = 'sb_publishable_0fy32YyKPt73BYXPzP6BlA_NOnuMG5Y';

// Prioritize environment variables, but fall back to the provided keys
const supabaseUrl = process.env.VITE_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

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

/**
 * Fetches the baseline dataset from Supabase to replace the hardcoded CHILLER_DATASET.
 * Expected Table: 'chiller_baseline'
 * Expected Columns: wind_speed, flow_rate, orientation, spacing, temperatures (float[])
 * Returns: number[][] (Array of rows, where each row matches [Wind, Flow, Ori, Spacing, T1...T20])
 */
export const fetchBaselineDataset = async (): Promise<number[][] | null> => {
    if (!supabase) return null;

    try {
        const { data, error } = await supabase
            .from('chiller_baseline')
            .select('wind_speed, flow_rate, orientation, spacing, temperatures');

        if (error) {
            console.warn("Supabase fetch error:", error.message);
            return null;
        }

        if (!data || data.length === 0) return null;

        // Map the structured database rows to the flat array format required by the surrogate model
        const formattedData: number[][] = data.map((row: any) => {
            const temps = Array.isArray(row.temperatures) ? row.temperatures : [];
            // Ensure we have numbers
            return [
                Number(row.wind_speed),
                Number(row.flow_rate),
                Number(row.orientation),
                Number(row.spacing),
                ...temps.map((t: any) => Number(t))
            ];
        });

        // Basic validation to ensure we have valid rows (must have at least the 4 params + 1 temp)
        const validRows = formattedData.filter(row => row.length >= 5 && !row.some(isNaN));
        
        return validRows.length > 0 ? validRows : null;

    } catch (err) {
        console.error("Unexpected error fetching baseline:", err);
        return null;
    }
};