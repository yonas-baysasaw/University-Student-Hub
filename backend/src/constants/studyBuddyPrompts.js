/** Current index pipeline version — bump when chunking/retrieval logic changes. */
export const RAG_PREP_VERSION = 2;

export const MODE_RULES = {
  chat: 'Provide a direct helpful answer in 3-6 sentences.',
  study_notes:
    'Create structured study notes with headings: Topic, Explanation, Key Points, Example, Important Notes.',
  summary: 'Give a short summary in 4-6 bullet points.',
  exam_prep:
    'Provide exam-prep notes: key concepts and 3 short practice questions with answers.',
  beginner:
    'Explain in simple language with short sentences and one easy example.',
};

export const TUTOR_RULES = `You are Liqu AI, a friendly study tutor helping a university student.

Rules:
- Use plain language. Never mention RAG, embeddings, indexing, vectors, or technical system terms.
- Lead with a direct answer, then briefly explain why it matters.
- When the provided context includes chapter or page numbers, mention them naturally (e.g. "In Chapter 4, around page 87…").
- Define jargon once in simple terms.
- Understand grammar mistakes and typos in the question.
- Do not include copyright or publisher boilerplate.
- If the answer is not in the provided context, say clearly that you could not find it in this book and suggest what chapter or topic to try next.
- End with one short optional follow-up (e.g. "Want study notes or a quick quiz on this?") — only when helpful, not every time.`;

export const CONTEXT_ONLY_PREFIX = `${TUTOR_RULES}

Answer using ONLY the provided book context below. Do not invent page numbers or quotes not supported by the context.

`;

export const INDEX_REQUIRED_HINT =
  "Note: this book is not fully prepared yet, so your answer may not match the book text. Tell the student you're still learning this book and suggest they wait a moment or ask again soon.";

export const LOW_CONFIDENCE_HINT =
  'Note: no strong match was found in the book for this question. Say you could not find it in the book and suggest trying a chapter name or pasting a sentence from the page.';

/** Map internal index errors to student-friendly messages. */
export function mapRagErrorToUserMessage(raw) {
  const msg = String(raw || '').toLowerCase();
  if (msg.includes('scanned') || msg.includes('not enough extractable text')) {
    return 'This looks like a scanned PDF—we could not read the text. Try uploading a text-based PDF or .txt file.';
  }
  if (msg.includes('timed out') || msg.includes('download')) {
    return 'We could not open this file. Check your connection or try again.';
  }
  if (msg.includes('ocr') || msg.includes('canvas')) {
    return 'We could not read this scanned book on the server. Try a text-based PDF.';
  }
  if (msg.includes('no text chunks')) {
    return 'This file did not contain readable study content.';
  }
  return raw || 'Something went wrong while reading this book. You can try again.';
}

/** True when the student wants a book outline / chapter list, not passage search. */
export function isChapterOutlineQuery(query) {
  const q = String(query || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!q) return false;
  const patterns = [
    /\b(list|show|give|tell|name|what are|what're|what is)\b.*\b(chapters?|sections?|parts?)\b/,
    /\b(all|every|complete|full|entire)\b.*\b(chapters?|sections?|parts?)\b/,
    /\btable of contents\b/,
    /\bcontents of (the )?book\b/,
    /\bchapter list\b/,
    /\bhow many chapters\b/,
    /\boutline of (the )?book\b/,
    /\bchapters in (this|the) book\b/,
  ];
  return patterns.some((re) => re.test(q));
}

/**
 * @param {Array<{ title?: string, pageStart?: number | null, pageEnd?: number | null }>} chapterMap
 */
export function sortChapterMap(chapterMap) {
  if (!Array.isArray(chapterMap)) return [];
  return [...chapterMap].sort(
    (a, b) => (Number(a.pageStart) || 0) - (Number(b.pageStart) || 0),
  );
}

/**
 * @param {string} bookTitle
 * @param {Array<{ title?: string, pageStart?: number | null, pageEnd?: number | null }>} chapterMap
 */
export function formatChapterOutlineReply(bookTitle, chapterMap) {
  const chapters = sortChapterMap(chapterMap).filter((ch) =>
    String(ch?.title || '').trim(),
  );
  if (!chapters.length) return '';

  const lines = chapters.map((ch, i) => {
    const title = String(ch.title).trim();
    const ps = ch.pageStart;
    const pe = ch.pageEnd;
    let pageSuffix = '';
    if (ps != null && Number.isFinite(Number(ps))) {
      if (pe != null && Number.isFinite(Number(pe)) && pe !== ps) {
        pageSuffix = ` (pages ${ps}–${pe})`;
      } else {
        pageSuffix = ` (page ${ps})`;
      }
    }
    return `${i + 1}. ${title}${pageSuffix}`;
  });

  const heading = bookTitle?.trim()
    ? `Here are the chapters in **${bookTitle.trim()}**:`
    : 'Here are the chapters in this book:';

  return `${heading}\n\n${lines.join('\n')}\n\nWant a summary or study notes for any chapter?`;
}

export function buildContextPrefix({
  bookTitle,
  mode,
  modeRule,
  context,
  indexRequired,
  lowConfidence,
}) {
  const modeKey = String(mode || 'chat').toLowerCase();
  const rule = modeRule || MODE_RULES[modeKey] || MODE_RULES.chat;
  let prefix = CONTEXT_ONLY_PREFIX;
  if (bookTitle) {
    prefix += `The student is studying **${bookTitle}**.\n`;
  }
  prefix += `- Response style: ${modeKey}\n- Style guide: ${rule}\n`;
  if (indexRequired) prefix += `- ${INDEX_REQUIRED_HINT}\n`;
  if (lowConfidence) prefix += `- ${LOW_CONFIDENCE_HINT}\n`;
  if (modeKey === 'chapter_outline') {
    prefix += `- List every chapter from the outline below exactly as given. Do not say you could not find chapters.\n`;
  }
  prefix += `\nProvided context:\n\n${context}\n\n---\n\nStudent question:\n`;
  return prefix;
}
