import { geminiService } from '../services/geminiService.js';

async function chatController(req, res, next) {
  try {
    const { messages } = req.body;

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

    const responseText = await geminiService.chat(messages);
    return res.json({ response: responseText });
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

export { chatController };
