import { ENV } from '../config/env.js';
import { resolveGeminiCredentialsForUser } from './geminiService.js';

function normalizeForEmbedding(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function resolveEmbedCredentials(credentials) {
  if (credentials?.apiKey) {
    return {
      apiKey: String(credentials.apiKey).trim(),
      modelId:
        String(credentials.embedModelId || ENV.GEMINI_EMBED_MODEL_ID || 'text-embedding-004').trim(),
    };
  }
  const resolved = resolveGeminiCredentialsForUser(credentials || null);
  return {
    apiKey: resolved.apiKey,
    modelId: String(ENV.GEMINI_EMBED_MODEL_ID || 'text-embedding-004').trim(),
  };
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

/**
 * @param {string} text
 * @param {{ apiKey?: string; embedModelId?: string; geminiApiKey?: string; geminiModelId?: string } | null} [credentials]
 */
export async function embedText(text, credentials = null) {
  const input = normalizeForEmbedding(text);
  if (!input) return null;

  const { apiKey, modelId } = resolveEmbedCredentials(credentials);
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is missing. Add your key in Settings or set it on the server.',
    );
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

/**
 * Embed many texts with bounded concurrency.
 * @param {string[]} texts
 * @param {object | null} [credentials]
 * @param {number} [concurrency=5]
 */
export async function embedTexts(texts, credentials = null, concurrency = 5) {
  const list = Array.isArray(texts) ? texts : [];
  const out = new Array(list.length);
  let i = 0;

  async function worker() {
    while (i < list.length) {
      const idx = i;
      i += 1;
      try {
        out[idx] = (await embedText(list[idx], credentials)) || [];
      } catch {
        out[idx] = [];
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, list.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}

/**
 * @param {string} query
 * @param {Array<{ role: string, content: string }>} [messages]
 */
export async function rewriteQueryForSearch(query, messages = []) {
  const q = String(query || '').trim();
  if (!q) return '';

  let rewritten = q
    .replace(/\bpls\b/gi, 'please')
    .replace(/\bu\b/gi, 'you')
    .replace(/\bwt\b/gi, 'what')
    .replace(/\bhow to\b/gi, 'how does')
    .replace(/\s+/g, ' ')
    .trim();

  const recent = (Array.isArray(messages) ? messages : [])
    .filter((m) => m.role === 'user' && typeof m.content === 'string')
    .slice(-3, -1)
    .map((m) => m.content.trim())
    .filter(Boolean);

  if (recent.length && rewritten.length < 40) {
    rewritten = `${recent.join(' ')} ${rewritten}`.replace(/\s+/g, ' ').trim();
  }

  if (!/[?.!]$/.test(rewritten)) rewritten = `${rewritten}?`;
  if (rewritten.length < 12) return q;
  return rewritten;
}

export function expandQueryFromMessages(messages) {
  const users = (Array.isArray(messages) ? messages : [])
    .filter((m) => m.role === 'user' && typeof m.content === 'string')
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (!users.length) return '';
  return users.slice(-3).join('\n');
}
