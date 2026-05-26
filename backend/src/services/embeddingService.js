import { ENV } from '../config/env.js';

function normalizeForEmbedding(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
    return 0;
  }
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    const av = Number(a[i] || 0);
    const bv = Number(b[i] || 0);
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function embedText(text) {
  const input = normalizeForEmbedding(text);
  if (!input) return null;

  const apiKey = String(ENV.GEMINI_API_KEY || '').trim();
  const modelId = String(ENV.GEMINI_EMBED_MODEL_ID || 'text-embedding-004').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing on the server.');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:embedContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${modelId}`,
      content: {
        parts: [{ text: input }],
      },
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Gemini embedding failed (${res.status}): ${msg.slice(0, 180)}`);
  }
  const data = await res.json().catch(() => ({}));
  const emb = data?.embedding?.values;
  if (!Array.isArray(emb) || emb.length === 0) {
    throw new Error('Gemini embedding API returned empty vector.');
  }
  return emb.map((x) => Number(x || 0));
}

export async function rewriteQueryForSearch(query) {
  const q = String(query || '').trim();
  if (!q) return '';

  let rewritten = q
    .replace(/\bpls\b/gi, 'please')
    .replace(/\bu\b/gi, 'you')
    .replace(/\bwt\b/gi, 'what')
    .replace(/\bhow to\b/gi, 'how does')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/[?.!]$/.test(rewritten)) rewritten = `${rewritten}?`;
  if (rewritten.length < 12) return q;
  return rewritten;
}
