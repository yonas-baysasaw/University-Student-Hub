import ChatSession from '../models/ChatSession.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

async function supportChatController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const { messages, sessionId } = req.body;
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

    const responseText =
      'Support AI is currently disabled on this server.';

    let session = sessionId
      ? await ChatSession.findOne({
          _id: sessionId,
          userId,
          kind: 'support',
        })
      : null;

    if (!session) {
      const firstUserMsg = messages.find((m) => m.role === 'user');
      session = await ChatSession.create({
        userId,
        kind: 'support',
        title: firstUserMsg
          ? `Support: ${firstUserMsg.content.slice(0, 50)}`
          : 'Support chat',
        messages: [],
      });
    }

    const userMsg = messages.at(-1);
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
    return next(error);
  }
}

export { supportChatController };
