// Firebase Functions: Korean dictionary proxy (Naver enko)
const functions = require('firebase-functions');
// --- Security hardening: CORS whitelist, optional App Check, simple rate-limit, cache headers ---
const admin = require('firebase-admin');
try { admin.app(); } catch { admin.initializeApp(); }

const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS || 'https://your-project.web.app,https://your-project.firebaseapp.com').split(',').map(s => s.trim()).filter(Boolean);
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 120 }; // 10분에 120회
const bucket = new Map(); // key: origin|ip -> { count, resetAt }

function allowOrigin(res, origin) {
  if (ALLOW_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    return true;
  }
  return false;
}

function isRateLimited(key) {
  const now = Date.now();
  const ent = bucket.get(key) || { count: 0, resetAt: now + RATE_LIMIT.windowMs };
  if (now > ent.resetAt) { ent.count = 0; ent.resetAt = now + RATE_LIMIT.windowMs; }
  ent.count += 1; bucket.set(key, ent);
  return ent.count > RATE_LIMIT.max;
}

async function verifyAppCheck(req) {
  const token = req.header('X-Firebase-AppCheck');
  if (!token) return false; // optional: only enforce when provided
  try {
    const { getAppCheck } = require('firebase-admin/app-check');
    await getAppCheck().verifyToken(token);
    return true;
  } catch { return false; }
}
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function sanitizeDefinition(input) {
  const raw = String(input ?? '');
  let text = raw.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
  text = text.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => entities[m] ?? m);
  text = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
  return text;
}

exports.koDict = functions.https.onRequest(async (req, res) => {
  const origin = req.get('origin') || '';
  if (!allowOrigin(res, origin)) { res.status(403).json({ status: 'error', message: 'Origin not allowed' }); return; }
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  const key = `${origin}|${(req.ip || '')}`;
  if (isRateLimited(key)) { res.status(429).json({ status: 'error', message: 'Too Many Requests' }); return; }

  const tokenPresent = !!req.header('X-Firebase-AppCheck');
  if (tokenPresent) {
    const ok = await verifyAppCheck(req).catch(() => false);
    if (!ok) { res.status(401).json({ status: 'error', message: 'Invalid App Check token' }); return; }
  }

  const word = String(req.query.word || '').trim();
  if (!word) { res.status(400).json({ status: 'error', message: 'Missing word' }); return; }
  const url = `https://en.dict.naver.com/api3/enko/search?query=${encodeURIComponent(word)}&m=pc&range=word`;
  try {
    const r = await fetch(url, { headers: { referer: 'https://en.dict.naver.com' } });
    if (!r.ok) { res.set('Cache-Control','public, max-age=300'); res.status(200).json({ definitions: [] }); return; }
    const data = await r.json();
    const list = data?.searchResultMap?.searchResultListMap?.WORD?.items ?? [];
    if (!Array.isArray(list) || list.length === 0) { res.set('Cache-Control','public, max-age=300'); res.status(200).json({ definitions: [] }); return; }
    const item = list.find((it) => (it?.stems ?? []).some((s) => (s?.match ?? '').toLowerCase() === word.toLowerCase())) || list[0];
    const defs = [];
    for (const mc of (item?.meansCollector ?? [])) {
      for (const m of (mc?.means ?? [])) { if (m?.value) defs.push(sanitizeDefinition(m.value)); }
    }
    const phonetic = item?.phoneticSymbol || item?.pronSymbol;
    res.set('Cache-Control','public, max-age=600');
    res.status(200).json({ definitions: defs, phonetic });
  } catch (e) {
    res.set('Cache-Control','public, max-age=120');
    res.status(200).json({ definitions: [] });
  }
});
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  const word = String(req.query.word || '').trim();
  if (!word) {
    res.status(400).json({ status: 'error', message: 'Missing word' });
    return;
  }
  const url = `https://en.dict.naver.com/api3/enko/search?query=${encodeURIComponent(word)}&m=pc&range=word`;
  try {
    const r = await fetch(url, { headers: { referer: 'https://en.dict.naver.com' } });
    if (!r.ok) {
      res.status(200).json({ definitions: [] });
      return;
    }
    const data = await r.json();
    const list = data?.searchResultMap?.searchResultListMap?.WORD?.items ?? [];
    if (!Array.isArray(list) || list.length === 0) {
      res.status(200).json({ definitions: [] });
      return;
    }
    const item = list.find((it) => (it?.stems ?? []).some((s) => (s?.match ?? '').toLowerCase() === word.toLowerCase())) || list[0];
    const defs = [];
    for (const mc of (item?.meansCollector ?? [])) {
      for (const m of (mc?.means ?? [])) {
        if (m?.value) defs.push(sanitizeDefinition(m.value));
      }
    }
    const phonetic = item?.phoneticSymbol || item?.pronSymbol;
    res.status(200).json({ definitions: defs, phonetic });
  } catch (e) {
    res.status(200).json({ definitions: [] });
  }
});





