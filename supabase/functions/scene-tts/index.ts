// Scene TTS Edge Function — owner-tier-gated text-to-speech for the
// script-breakdown reader. Generates an MP3 for one scene's text via
// OpenAI's TTS API, caches it in Storage keyed by projectId/sceneId/
// textHash, and returns a short-lived signed URL the client streams.
//
// Required secrets (set with `supabase secrets set …`):
//   OPENAI_API_KEY         — OpenAI key with TTS access
//   SUPABASE_URL           — auto-populated in Edge Function runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-populated in Edge Function runtime
//
// POST body:
//   { projectId, sceneId, text, voice? }
//
// 200 response:
//   { audioUrl: "<signed-url>", cached: boolean }
//
// 401 if not authenticated.
// 403 if not owner tier or not a project member.
// 400 if body invalid or text empty.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!;
const BUCKET = 'scene-audio';
const SIGNED_URL_TTL = 60 * 60; // 1 hour
const DEFAULT_VOICE = 'nova'; // natural, clear — closest to Speechify
const MAX_CHARS = 4096; // OpenAI TTS hard cap per request

const ALLOWED_VOICES = new Set([
  'alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer',
]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16); // first 16 hex chars is plenty for cache keying
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // ── Auth: identify the caller via their JWT ──
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'missing_token' });

  // Anon-key client just to resolve the user from their JWT.
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user) return json(401, { error: 'invalid_token' });
  const userId = userData.user.id;

  // ── Body validation ──
  let body: { projectId?: string; sceneId?: string; text?: string; voice?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const { projectId, sceneId, text } = body;
  const voice = body.voice && ALLOWED_VOICES.has(body.voice) ? body.voice : DEFAULT_VOICE;
  if (!projectId || !sceneId || !text || typeof text !== 'string') {
    return json(400, { error: 'missing_fields' });
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) return json(400, { error: 'empty_text' });
  if (trimmed.length > MAX_CHARS) {
    return json(400, { error: 'text_too_long', max: MAX_CHARS });
  }

  // ── Service-role client for DB + Storage with bypassed RLS ──
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Tier gate — must be owner.
  const { data: userRow, error: tierErr } = await admin
    .from('users')
    .select('tier')
    .eq('id', userId)
    .single();
  if (tierErr) return json(403, { error: 'tier_lookup_failed' });
  if (userRow?.tier !== 'owner') return json(403, { error: 'owner_tier_only' });

  // Membership gate — must be a member of the project.
  const { data: membership } = await admin
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) return json(403, { error: 'not_a_project_member' });

  // ── Cache check ──
  const textHash = await sha256Hex(`${voice}::${trimmed}`);
  const path = `${projectId}/${sceneId}-${textHash}.mp3`;

  const existing = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (existing.data?.signedUrl && !existing.error) {
    // Verify the object actually exists by listing — createSignedUrl
    // happily mints URLs for non-existent paths.
    const { data: head } = await admin.storage
      .from(BUCKET)
      .list(projectId, { search: `${sceneId}-${textHash}.mp3` });
    if (head && head.length > 0) {
      return json(200, { audioUrl: existing.data.signedUrl, cached: true });
    }
  }

  // ── Generate via OpenAI TTS ──
  const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice,
      input: trimmed,
      response_format: 'mp3',
    }),
  });
  if (!ttsRes.ok) {
    const errText = await ttsRes.text();
    console.error('[scene-tts] OpenAI failure:', ttsRes.status, errText);
    return json(502, { error: 'tts_upstream_failed', status: ttsRes.status });
  }
  const audio = new Uint8Array(await ttsRes.arrayBuffer());

  // ── Upload to Storage ──
  const upload = await admin.storage.from(BUCKET).upload(path, audio, {
    contentType: 'audio/mpeg',
    upsert: true,
  });
  if (upload.error) {
    console.error('[scene-tts] upload failed:', upload.error);
    return json(500, { error: 'storage_write_failed' });
  }

  // Mint a fresh signed URL for the just-uploaded file.
  const signed = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (signed.error || !signed.data) {
    return json(500, { error: 'sign_url_failed' });
  }

  return json(200, { audioUrl: signed.data.signedUrl, cached: false });
});
