/**
 * One-shot orphan storage cleanup.
 *
 * Deletes objects in `project-documents` and `continuity-photos` whose
 * top-level folder UUID no longer matches a row in the `projects` table.
 *
 * Run from the prep/ directory so it picks up @supabase/supabase-js:
 *   cd prep
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... \
 *   node cleanup-orphan-storage.mjs
 *
 * Service role key is required — anon key can't see other users' files,
 * and the storage protect_delete trigger blocks raw SQL deletes.
 *
 * Get the key from Supabase dashboard → Project Settings → API →
 * `service_role` (the secret one, NOT the anon key). Do NOT commit it.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKETS = ['project-documents', 'continuity-photos'];
const UUID_RE = /^[0-9a-f-]{36}$/i;

if (!URL || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

async function listAllProjectIds() {
  const ids = new Set();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) ids.add(r.id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

async function listAllPaths(bucket, prefix = '') {
  const paths = [];
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error) {
    console.warn(`  ! list ${bucket}/${prefix} failed:`, error.message);
    return paths;
  }
  if (!data) return paths;
  for (const entry of data) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      const nested = await listAllPaths(bucket, fullPath);
      paths.push(...nested);
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

async function main() {
  console.log('Fetching project IDs…');
  const projectIds = await listAllProjectIds();
  console.log(`  ${projectIds.size} projects in DB.`);

  for (const bucket of BUCKETS) {
    console.log(`\n[${bucket}]`);
    const all = await listAllPaths(bucket);
    console.log(`  ${all.length} total objects.`);

    const orphans = all.filter((p) => {
      const top = p.split('/')[0];
      return !UUID_RE.test(top) || !projectIds.has(top);
    });
    console.log(`  ${orphans.length} orphan objects to delete.`);

    if (orphans.length === 0) continue;

    const CHUNK = 500;
    let removed = 0;
    for (let i = 0; i < orphans.length; i += CHUNK) {
      const batch = orphans.slice(i, i + CHUNK);
      const { error } = await supabase.storage.from(bucket).remove(batch);
      if (error) {
        console.warn(`  ! remove batch ${i}-${i + batch.length} failed:`, error.message);
      } else {
        removed += batch.length;
        process.stdout.write(`\r  removed ${removed} / ${orphans.length}…`);
      }
    }
    console.log(`\n  done — removed ${removed} objects.`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
