import ChatSession from '../models/ChatSession.js';
import {
  geminiService,
  runSupportWithTools,
} from '../services/geminiService.js';
import {
  executeSupportTool,
  getSupportFunctionDeclarations,
} from '../services/supportToolService.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

const SUPPORT_SYSTEM = `You are the University Student Hub support assistant. Answer using ONLY facts returned by the tools. If a tool returns an error or empty list, say so and suggest what the user can do (e.g. check the classroom name or open a specific page). Do not invent announcements, resource links, file names, messages, or exam details. Be concise, friendly, and use bullet points when listing items.

Formatting (required):
- Use the **when** field for dates—never paste raw ISO timestamps.
- If **linkText** and **url** are present, use Markdown: [linkText](url) so the link is clickable with a short, readable label. Never put bare URLs, "URL:", or S3 links as plain text.
- Never show database ids, **chatId**, **id**, or hex object ids in your answer. Reference classes by **classroom** or **name** from tools only. The field **chatId** from list_my_classrooms is only for your next tool call arguments—do not show it to the user.

When the user asks about classrooms, resources, or announcements without naming one, call list_my_classrooms first, then use list_recent_resources or list_recent_announcements as needed. For one named class, use list_resources_for_chat or list_announcements_for_chat with the matching **chatId** from list_my_classrooms. For date filters on resources, use createdAfter/createdBefore (ISO) in the tool; still answer the user with **when**-style phrasing, not raw ISO.`;

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

    const functionDeclarations = getSupportFunctionDeclarations();
    const ctx = { userId };
    const executeTool = (name, args) => executeSupportTool(name, ctx, args);

    const responseText = await runSupportWithTools(req.user, messages, {
      functionDeclarations,
      systemInstruction: SUPPORT_SYSTEM,
      executeTool,
    });

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
    if (geminiService.constructor.isFatalError?.(error)) {
      return res.status(429).json({
        message:
          'AI service quota or rate limit reached. Please try again later.',
      });
    }
    return next(error);
  }
}

export { supportChatController };
