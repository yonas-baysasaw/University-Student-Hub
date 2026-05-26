import ChatSession from '../models/ChatSession.js';
import {
  buildContextPrefix,
  MODE_RULES,
} from '../constants/studyBuddyPrompts.js';
import {
  augmentMessagesWithBookRag,
  buildGeneralRagContextForQuery,
} from '../services/bookRagService.js';
import { resolveGeminiCredentialsForUser } from '../services/geminiService.js';
import { listGeminiModels } from '../utils/geminiApiClient.js';
import {
  loadUserGeminiCredentials,
  userLikeFromCredentials,
} from '../utils/geminiUserCredentials.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

function toGeminiRole(role) {
  return role === 'assistant' ? 'model' : 'user';
}

async function askGemini(messages, credentials) {
  const { apiKey, modelId } = credentials;
  if (!apiKey) {
    throw new Error(
      'No Gemini API key. Add your key in Settings (Liqu AI access) or set GEMINI_API_KEY on the server.',
    );
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

function validateChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages must be a non-empty array');
  }

  for (const msg of messages) {
    if (!msg.role || !msg.content || typeof msg.content !== 'string') {
      throw new Error('Each message must have a role and content string');
    }
    if (!['user', 'assistant'].includes(msg.role)) {
      throw new Error('Message role must be "user" or "assistant"');
    }
  }
}

async function generateLiquAiReply({
  messages,
  sessionId,
  bookId,
  mode,
  contextScope,
  userId,
  pageNumber,
  selectedText,
  chapterFilter,
}) {
  validateChatMessages(messages);

  let messagesForLlm = messages;
  let ragReferences = [];
  let ragUsed = false;
  let ragNote = null;
  let grounding = 'none';
  let directResponse = null;

  const lastUserMsg = messages.at(-1);
  const classroomContextHint =
    lastUserMsg?.role === 'user' &&
    typeof lastUserMsg.content === 'string' &&
    /use the classroom data below as the primary source of truth/i.test(
      lastUserMsg.content,
    );
  const isClassroomScope =
    String(contextScope || '').toLowerCase() === 'classroom' ||
    classroomContextHint;

  const ragOpts = {
    pageNumber,
    selectedText,
    chapterFilter,
  };

  if (bookId && String(bookId).trim()) {
    const aug = await augmentMessagesWithBookRag(
      messages,
      String(bookId).trim(),
      userId,
      mode,
      ragOpts,
    );
    messagesForLlm = aug.messages;
    ragReferences = Array.isArray(aug.references) ? aug.references : [];
    ragUsed = Boolean(aug.ragUsed);
    ragNote = aug.ragNote ?? null;
    grounding = aug.grounding || (ragUsed ? 'book' : 'none');
    directResponse = aug.directResponse || null;
  }

  if ((!bookId || !String(bookId).trim()) && !isClassroomScope) {
    if (lastUserMsg?.role === 'user' && typeof lastUserMsg.content === 'string') {
      const modeKey = String(mode || 'chat').toLowerCase();
      const modeRule = MODE_RULES[modeKey] || MODE_RULES.chat;
      const rag = await buildGeneralRagContextForQuery(
        userId,
        lastUserMsg.content,
        { messages },
      );
      if (rag.context) {
        const prefix = buildContextPrefix({
          bookTitle: '',
          mode: modeKey,
          modeRule,
          context: rag.context,
          indexRequired: false,
          lowConfidence: rag.reason === 'low_confidence',
        });
        const out = messages.slice(0, -1).map((m) => ({ ...m }));
        out.push({ role: 'user', content: `${prefix}${lastUserMsg.content}` });
        messagesForLlm = out;
        ragUsed = true;
        ragNote = rag.reason === 'low_confidence' ? 'low_confidence' : 'ok';
        grounding = 'library';
      }
      ragReferences = Array.isArray(rag.references) ? rag.references : [];
    }
  }

  const credentials = resolveGeminiCredentialsForUser(
    userLikeFromCredentials(await loadUserGeminiCredentials(userId)),
  );
  let responseText = directResponse || (await askGemini(messagesForLlm, credentials));
  if (isClassroomScope) {
    responseText = responseText
      .replace(/The information was not found in the available books\./gi, '')
      .replace(/\n{0,2}Sources:\s*[\s\S]*$/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

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
  session.messages.push({ role: userMsg.role, content: userMsg.content });
  session.messages.push({
    role: 'assistant',
    content: responseText,
    references: ragReferences,
    grounding,
  });
  await session.save();

  return {
    response: responseText,
    sessionId: session._id.toString(),
    references: ragReferences,
    ragUsed,
    ragNote,
    grounding,
  };
}

async function chatController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const {
      messages,
      sessionId,
      bookId,
      mode,
      pageNumber,
      selectedText,
      chapterFilter,
    } = req.body;
    const userId = req.user._id;
    const result = await generateLiquAiReply({
      messages,
      sessionId,
      bookId,
      mode,
      contextScope: req.body?.contextScope,
      userId,
      pageNumber,
      selectedText,
      chapterFilter,
    });
    return res.json(result);
  } catch (error) {
    if (error.message?.includes('messages must be')) {
      return res.status(400).json({ message: error.message });
    }
    if (
      error.message?.includes('Each message must') ||
      error.message?.includes('Message role must')
    ) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

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
    const credentials = await loadUserGeminiCredentials(req.user._id);
    const { apiKey } = resolveGeminiCredentialsForUser(
      userLikeFromCredentials(credentials),
    );
    if (!apiKey) {
      return res.status(400).json({
        message:
          'No Gemini API key available. Add your key in Settings or set GEMINI_API_KEY on the server.',
      });
    }
    const models = await listGeminiModels(apiKey);
    return res.json({ models });
  } catch (error) {
    return next(error);
  }
}

export {
  chatController,
  deleteSessionController,
  generateLiquAiReply,
  getSessionController,
  listModelsController,
  listSessionsController,
};
