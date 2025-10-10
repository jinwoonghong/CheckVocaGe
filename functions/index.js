// Firebase Functions: Korean dictionary proxy (Naver enko)
const functions = require('firebase-functions');
const admin = require('firebase-admin');
try { admin.app(); } catch { admin.initializeApp(); }

// Allowed origins (override with env ALLOW_ORIGINS)
const DEFAULT_ORIGINS = [
  'https://checkvocage.web.app',
  'https://checkvocage.firebaseapp.com',
  'http://localhost:5173',
];
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS || DEFAULT_ORIGINS.join(',')).split(',').map(s => s.trim()).filter(Boolean);

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function allowOrigin(res, origin) {
  if (ALLOW_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    return true;
  }
  return false;
}

async function verifyAppCheck(req) {
  const token = req.header('X-Firebase-AppCheck');
  if (!token) return false;
  try {
    const { getAppCheck } = require('firebase-admin/app-check');
    await getAppCheck().verifyToken(token);
    return true;
  } catch { return false; }
}

function sanitizeDefinition(input) {
  const raw = String(input ?? '');
  let text = raw.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
  text = text.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => entities[m] ?? m);
  text = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return text;
}

exports.koDict = functions.https.onRequest(async (req, res) => {
  const origin = req.get('origin') || '';
  if (!allowOrigin(res, origin)) { res.status(403).json({ status: 'error', message: 'Origin not allowed' }); return; }
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  // Optional App Check verification only when header present
  if (req.header('X-Firebase-AppCheck')) {
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

