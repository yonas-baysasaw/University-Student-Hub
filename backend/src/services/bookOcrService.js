import { ENV } from '../config/env.js';
import { resolveGeminiCredentialsForUser } from './geminiService.js';
import { analyzePDF, extractImagesFromPDF } from './pdfService.js';

const MAX_OCR_PAGES = 80;
const OCR_PROMPT =
  'Extract all readable text from this book page. Return plain text only—no commentary, no markdown. Preserve paragraph breaks.';

/**
 * @param {string} apiKey
 * @param {string} modelId
 * @param {string} base64
 * @param {string} mimeType
 */
async function ocrPageImage(apiKey, modelId, base64, mimeType = 'image/png') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: OCR_PROMPT },
          ],
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error?.message || `OCR request failed with ${res.status}`,
    );
  }
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim() || '';
  return text;
}

/**
 * OCR a scanned PDF buffer into per-page text records.
 * @param {Buffer} buffer
 * @param {{ geminiApiKey?: string; geminiModelId?: string } | null} userLike
 * @returns {Promise<{ pages: Array<{ pageNumber: number, text: string }> } | null>}
 */
export async function ocrPdfToPages(buffer, userLike = null) {
  const { isImageBased } = await analyzePDF(buffer);
  if (!isImageBased) return null;

  let images;
  try {
    images = await extractImagesFromPDF(buffer);
  } catch (e) {
    throw new Error(
      `OCR unavailable: ${e?.message || 'could not render PDF pages'}`,
    );
  }

  const { apiKey, modelId } = resolveGeminiCredentialsForUser(userLike);
  if (!apiKey) {
    throw new Error(
      'OCR requires a Gemini API key. Add your key in Settings or set GEMINI_API_KEY on the server.',
    );
  }

  const visionModel =
    String(userLike?.geminiModelId || ENV.GEMINI_MODEL_ID || '').trim() ||
    'gemini-2.0-flash';

  const slice = images.slice(0, MAX_OCR_PAGES);
  const pages = [];

  for (let i = 0; i < slice.length; i += 1) {
    const img = slice[i];
    const text = await ocrPageImage(
      apiKey,
      visionModel,
      img.base64,
      img.mimeType || 'image/png',
    );
    if (text.trim()) {
      pages.push({ pageNumber: i + 1, text: text.trim() });
    }
  }

  if (pages.length === 0) {
    throw new Error(
      'OCR could not extract text from this scanned PDF. Try a text-based PDF.',
    );
  }

  return { pages };
}
