#!/usr/bin/env node
/*
 * Migrate local proposals.json into Supabase.
 * Usage: node scripts/migrate-proposals-to-supabase.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'proposals';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY');
  process.exit(1);
}

const filePath = path.join(__dirname, '..', 'backend', 'data', 'proposals.json');
if (!fs.existsSync(filePath)) {
  console.error(`No proposals.json found at ${filePath}`);
  process.exit(1);
}

const raw = fs.readFileSync(filePath, 'utf-8');
let proposals = [];
try {
  proposals = JSON.parse(raw);
} catch (e) {
  console.error('Failed to parse proposals.json:', e.message);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const toSupabase = (p) => ({
  id: String(p.id),
  timestamp: Number(p.timestamp),
  type: p.type,
  token: p.token,
  amount: String(p.amount),
  strategy: p.strategy,
  reason: p.reason || null,
  status: p.status,
  tx_hash: p.txHash || null,
  execution_time: p.executionTime || null,
});

(async () => {
  if (!Array.isArray(proposals) || proposals.length === 0) {
    console.log('No proposals to migrate.');
    return;
  }

  const rows = proposals.map(toSupabase);
  const chunkSize = 250;
  let migrated = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(SUPABASE_TABLE)
      .upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error('Supabase upsert failed:', error.message);
      process.exit(1);
    }
    migrated += chunk.length;
  }

  console.log(`Migrated ${migrated} proposals into ${SUPABASE_TABLE}.`);
})();
