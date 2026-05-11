import ChatSession from '../models/ChatSession.js';
import { ENV } from '../config/env.js';
import {
  augmentMessagesWithBookRag,
  buildGeneralRagContextForQuery,
} from '../services/bookRagService.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

const CONTEXT_ONLY_RULES = `Answer the user's question using ONLY the provided context.

Rules:
- Give concise answers
- Understand grammar mistakes and typos in the question
- Mention chapter names if available
- Do not include copyright or publisher text
- Recommend related books if relevant
- If answer is not found, say exactly:
"The information was not found in the available books."`;

const NOT_FOUND_TEXT = 'The information was not found in the available books.';
const MODE_RULES = {
  chat: 'Provide a direct helpful answer in 3-6 sentences.',
  study_notes:
    'Create structured study notes with headings: Topic, Explanation, Key Points, Example, Important Notes.',
  summary: 'Give a short summary in 4-6 bullet points.',
  exam_prep:
    'Provide exam-prep notes: key concepts and 3 short practice questions with answers.',
  beginner:
    'Explain in simple language with short sentences and one easy example.',
};

function toGeminiRole(role) {
  return role === 'assistant' ? 'model' : 'user';
}

function formatReferencesForDisplay(references) {
  if (!Array.isArray(references) || references.length === 0) return '';
  const seen = new Set();
  const lines = [];
  for (const ref of references) {
    const title = String(ref?.bookTitle || 'Untitled');
    const excerptNumber = Number(ref?.excerptNumber || 0);
    const key = `${title}::${excerptNumber}`;
    if (seen.has(key) || excerptNumber <= 0) continue;
    seen.add(key);
    const chapter = String(ref?.chapter || '').trim();
    const pages =
      ref?.pageStart && ref?.pageEnd
        ? ref.pageStart === ref.pageEnd
          ? `Page ${ref.pageStart}`
          : `Pages ${ref.pageStart}-${ref.pageEnd}`
        : '';
    const meta = [chapter ? `Chapter: ${chapter}` : '', pages]
      .filter(Boolean)
      .join(' | ');
    lines.push(
      meta
        ? `- ${title} (Excerpt #${excerptNumber}) | ${meta}`
        : `- ${title} (Excerpt #${excerptNumber})`,
    );
  }
  if (lines.length === 0) return '';
  return `\n\nSources:\n${lines.join('\n')}`;
}

async function askGemini(messages) {
  const apiKey = String(ENV.GEMINI_API_KEY || '').trim();
  const modelId = String(ENV.GEMINI_MODEL_ID || 'gemini-2.0-flash').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing on the server.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = messages.map((m) => ({
    role: toGeminiRole(m.role),
    parts: [{ text: String(m.content || '') }],
  }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error?.message || `Gemini request failed with ${res.status}`,
    );
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim() || '';
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return text;
}

// ── Chat (REST, non-streaming) ─────────────────────────────────────────────────

async function chatController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const { messages, sessionId, bookId, mode } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ message: 'messages must be a non-empty array' });
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        return res.status(400).json({
          message: 'Each message must have a role and content string',
        });
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        return res
          .status(400)
          .json({ message: 'Message role must be "user" or "assistant"' });
      }
    }

    let messagesForLlm = messages;
    let ragReferences = [];
    let hasRagContext = false;
    if (bookId && String(bookId).trim()) {
      const aug = await augmentMessagesWithBookRag(
        messages,
        String(bookId).trim(),
        userId,
        mode,
      );
      messagesForLlm = aug.messages;
      ragReferences = Array.isArray(aug.references) ? aug.references : [];
      hasRagContext = Boolean(aug.ragUsed);
    }

    if (!bookId || !String(bookId).trim()) {
      const lastUserMsg = messages.at(-1);
      if (lastUserMsg?.role === 'user' && typeof lastUserMsg.content === 'string') {
        const modeRule = MODE_RULES[String(mode || 'chat').toLowerCase()] || MODE_RULES.chat;
        const rag = await buildGeneralRagContextForQuery(
          userId,
          lastUserMsg.content,
        );
        if (rag.context) {
          const prefix =
            `${CONTEXT_ONLY_RULES}\n- Output mode: ${String(mode || 'chat')}\n- Mode behavior: ${modeRule}\n\nProvided context:\n\n` +
            rag.context +
            '\n\n---\n\nStudent question:\n';
          const out = messages.slice(0, -1).map((m) => ({ ...m }));
          out.push({ role: 'user', content: `${prefix}${lastUserMsg.content}` });
          messagesForLlm = out;
          hasRagContext = true;
        }
        ragReferences = Array.isArray(rag.references) ? rag.references : [];
      }
    }

    let responseText = NOT_FOUND_TEXT;
    if (hasRagContext) {
      responseText = await askGemini(messagesForLlm);
    }
    const sourcesText = formatReferencesForDisplay(ragReferences);
    if (sourcesText) {
      responseText = `${responseText}${sourcesText}`;
    }

    // Persist to session (Liqu AI only, not support widget sessions)
    let session = sessionId
      ? await ChatSession.findOne({
          _id: sessionId,
          userId,
          $or: [{ kind: { $exists: false } }, { kind: 'liqu' }],
        })
      : null;

    if (!session) {
      const firstUserMsg = messages.find((m) => m.role === 'user');
      session = await ChatSession.create({
        userId,
        title: firstUserMsg ? firstUserMsg.content.slice(0, 60) : 'New chat',
        messages: [],
      });
    }

    const userMsg = messages[messages.length - 1];
    session.messages.push(
      { role: userMsg.role, content: userMsg.content },
      { role: 'assistant', content: responseText },
    );
    await session.save();

    return res.json({
      response: responseText,
      sessionId: session._id.toString(),
      references: ragReferences,
    });
  } catch (error) {
    return next(error);
  }
}

// ── Chat sessions CRUD ────────────────────────────────────────────────────────

async function listSessionsController(req, res, next) {
  try {
    const sessions = await ChatSession.find({
      userId: req.user._id,
      $or: [{ kind: { $exists: false } }, { kind: 'liqu' }],
    })
      .sort({ updatedAt: -1 })
      .select('_id title updatedAt createdAt')
      .limit(50);

    return res.json({ sessions });
  } catch (error) {
    return next(error);
  }
}

async function getSessionController(req, res, next) {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.sessionId,
      userId: req.user._id,
      $or: [{ kind: { $exists: false } }, { kind: 'liqu' }],
    });

    if (!session)
      return res.status(404).json({ message: 'Session not found.' });
    return res.json(session);
  } catch (error) {
    return next(error);
  }
}

async function deleteSessionController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const result = await ChatSession.findOneAndDelete({
      _id: req.params.sessionId,
      userId: req.user._id,
      $or: [{ kind: { $exists: false } }, { kind: 'liqu' }],
    });

    if (!result) return res.status(404).json({ message: 'Session not found.' });
    return res.json({ message: 'Session deleted.' });
  } catch (error) {
    return next(error);
  }
}

async function listModelsController(req, res, next) {
  try {
    const modelId = String(ENV.GEMINI_MODEL_ID || 'gemini-2.0-flash').trim();
    return res.json({ models: [{ name: modelId, displayName: modelId }] });
  } catch (error) {
    return next(error);
  }
}

export {
  chatController,
  deleteSessionController,
  getSessionController,
  listModelsController,
  listSessionsController,
};
