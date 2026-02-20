/**
 * Test Supabase connection: fetch chiller_baseline and print row 2 (index 1).
 * Run: node scripts/test-supabase-connection.mjs
 * Or with env: VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=... node scripts/test-supabase-connection.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://vccuhgecucsbuiyqbqlz.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_0fy32YyKPt73BYXPzP6BlA_NOnuMG5Y';

const supabase = createClient(url, key);

console.log('Fetching from table: chiller_baseline ...\n');

const TABLE = 'Exhaust flow Data';

const { data, error } = await supabase
  .from(TABLE)
  .select('*')
  .range(0, 9); // first 10 rows so we have a "row 2"

if (error) {
  console.error('Supabase error:', error.message);
  console.error('\nConnection to Supabase succeeded, but the table might not exist or might be in a different schema.');
  console.error('Check in Supabase Dashboard: Table Editor → ensure a table named "Exhaust flow Data" exists in the public schema.');
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log('Table is empty or no rows returned.');
  process.exit(0);
}

// Row 2 = second row = index 1 (1-based "row 2")
const row2 = data[1];
if (!row2) {
  console.log('Table has only 1 row; no "row 2". First row:', JSON.stringify(data[0], null, 2));
  process.exit(0);
}

console.log('Row 2 of "Exhaust flow Data":');
console.log(JSON.stringify(row2, null, 2));
console.log('\nTotal rows returned:', data.length);
