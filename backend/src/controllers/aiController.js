import ChatSession from '../models/ChatSession.js';
import { augmentMessagesWithBookRag } from '../services/bookRagService.js';
import {
  geminiService,
  getGeminiServiceForUser,
} from '../services/geminiService.js';

// ── Chat (REST, non-streaming) ─────────────────────────────────────────────────

async function chatController(req, res, next) {
  try {
    const { messages, sessionId, bookId } = req.body;
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

    const service = await getGeminiServiceForUser(req.user);
    let messagesForLlm = messages;
    if (bookId && String(bookId).trim()) {
      const aug = await augmentMessagesWithBookRag(
        messages,
        String(bookId).trim(),
        userId,
        req.user,
      );
      messagesForLlm = aug.messages;
    }
    const responseText = await service.chat(messagesForLlm);

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
    });
  } catch (error) {
    if (geminiService.constructor.isFatalError?.(error)) {
      return res.status(429).json({
        message:
          'AI service quota or rate limit reached. Please try again later.',
      });
    }
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

// ── List available Gemini models ───────────────────────────────────────────────

async function listModelsController(req, res, next) {
  try {
    const apiKey = req.query.apiKey || req.user?.geminiApiKey;
    if (!apiKey) {
      return res
        .status(400)
        .json({ message: 'apiKey query parameter required.' });
    }

    // Use the Gemini REST API to list models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: data.error?.message || 'Failed to list models',
      });
    }

    // Filter to models that support generateContent
    const models = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => ({ name: m.name, displayName: m.displayName || m.name }));

    return res.json({ models });
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
