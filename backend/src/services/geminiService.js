import { FunctionCallingMode, GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../config/env.js';

// Ported and adapted from did-exit/js/ai-integration.js
// Key changes: npm SDK instead of ESM CDN, server-side env key, added multi-turn chat

const RATE_LIMIT_MAX_REQUESTS = 12;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * API key: user's DB value first, then server env. Model: user geminiModelId, then env.
 * @param { { geminiApiKey?: string; geminiModelId?: string } | null | undefined } userLike
 */
function resolveGeminiCredentialsForUser(userLike) {
  const fromUser =
    userLike?.geminiApiKey && String(userLike.geminiApiKey).trim();
  const apiKey =
    fromUser || (ENV.GEMINI_API_KEY && String(ENV.GEMINI_API_KEY).trim()) || '';
  const modelFromUser =
    userLike?.geminiModelId && String(userLike.geminiModelId).trim();
  const modelId = modelFromUser || ENV.GEMINI_MODEL_ID || 'gemini-2.0-flash';
  return { apiKey, modelId };
}

class GeminiService {
  constructor() {
    this.model = null;
    this.chatModel = null;
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.requestWindowStart = Date.now();
    this._initialized = false;
  }

  async initialize() {
    if (this._initialized) return;
    const { apiKey, modelId } = resolveGeminiCredentialsForUser(null);
    if (!apiKey) {
      throw new Error(
        'Gemini is not configured. Set GEMINI_API_KEY on the server or add a key in Profile (Liqu AI Settings).',
      );
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: modelId });
    this.chatModel = genAI.getGenerativeModel({ model: modelId });
    this._initialized = true;
    console.log(`✅ Gemini initialized with model: ${modelId}`);
  }

  async enforceRateLimit() {
    const now = Date.now();
    if (now - this.requestWindowStart > RATE_LIMIT_WINDOW_MS) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }
    if (this.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
      const waitMs =
        RATE_LIMIT_WINDOW_MS - (now - this.requestWindowStart) + 100;
      console.warn(`⏳ Rate limit reached — waiting ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      this.requestCount = 0;
      this.requestWindowStart = Date.now();
    }
    this.requestCount++;
  }

  // ── Question extraction (batch path) ─────────────────────────────────────

  async generateQuestionsFromText(textContent) {
    await this.initialize();
    console.log(
      `🤖 Processing text chunk: ${textContent.length} characters...`,
    );

    const prompt = this.createChunkExtractionPrompt(textContent);
    await this.enforceRateLimit();
    const result = await this.model.generateContent(prompt);
    const text = (await result.response).text();

    console.log(`📝 AI response length: ${text.length} characters`);
    const questions = this.parseChunkResponse(text);

    if (!questions || questions.length === 0) {
      console.warn('⚠️ No valid questions extracted from AI response');
      return [];
    }
    console.log(`✅ Extracted ${questions.length} questions`);
    return questions;
  }

  async generateQuestionsFromImage(base64Data, mimeType = 'image/png') {
    await this.initialize();
    console.log('🤖 Processing image chunk with AI');

    const prompt = this.createImageExtractionPrompt();
    await this.enforceRateLimit();

    const contents = [
      {
        role: 'user',
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt },
        ],
      },
    ];

    const result = await this.model.generateContent({ contents });
    const text = (await result.response).text();
    console.log(`✅ Image analysis response: ${text.length} chars`);
    return this.parseChunkResponse(text);
  }

  // ── Multi-turn chat (new feature — not in did-exit) ─────────────────────

  async chat(messages) {
    await this.initialize();

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error(
        'messages must be a non-empty array of { role, content } objects',
      );
    }

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    await this.enforceRateLimit();
    const chatSession = this.chatModel.startChat({ history });
    const result = await chatSession.sendMessage(lastMessage.content);
    const responseText = (await result.response).text();
    return responseText;
  }

  // ── Streaming chat ────────────────────────────────────────────────────────

  async chatStream(messages, onChunk) {
    await this.initialize();

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error(
        'messages must be a non-empty array of { role, content } objects',
      );
    }

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    await this.enforceRateLimit();
    const chatSession = this.chatModel.startChat({ history });
    const result = await chatSession.sendMessageStream(lastMessage.content);

    let full = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      full += text;
      onChunk(text);
    }
    return full;
  }

  // ── Per-user BYOK instance ────────────────────────────────────────────────

  async forUser(apiKey, modelId) {
    if (!apiKey) return this;
    const genAI = new GoogleGenerativeAI(apiKey);
    const effectiveModel = modelId || ENV.GEMINI_MODEL_ID;
    const instance = new GeminiService();
    instance.model = genAI.getGenerativeModel({ model: effectiveModel });
    instance.chatModel = genAI.getGenerativeModel({ model: effectiveModel });
    instance._initialized = true;
    return instance;
  }

  // ── Prompts (ported verbatim from did-exit) ───────────────────────────────

  createChunkExtractionPrompt(textContent) {
    return `You are an expert quiz generator. Extract and create interactive multiple-choice questions from the following text content.

Format your response as a single, valid JSON object containing a "questions" array. Each question object must have: "id", "question", "options" (array of strings), "correctAnswer" (0-indexed integer), and "explanation".

Guidelines:
- Extract ALL questions. Do not stop prematurely.
- Ensure the JSON is well-formed. Do not include trailing commas.
- Escape any double quotes within the question or explanation text.
- If the text contains numbered questions and options (e.g., "1.", "A.", "B."), preserve them accurately.
- CRITICALLY IMPORTANT: For each question, deeply analyze all options before selecting the correct answer:
  * Compare each option against the exact information in the text
  * Watch for subtle wording differences that change meaning
  * Consider which option most completely answers the question
  * Verify your choice is consistent with the source material
- Provide explanations that clearly justify why the correct answer is right and why others are wrong
- If answers are explicitly marked in the text, use those markings

Content to analyze:
${textContent}`;
  }

  createImageExtractionPrompt() {
    return `You are an expert quiz generator. OCR and analyze the content of the provided PDF page image and extract all multiple-choice questions.

Your response MUST be a valid JSON in this exact format:
{
  "questions": [
    {
      "id": 1,
      "question": "Full question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation of why this answer is correct"
    }
  ]
}

Important details:
- The correctAnswer field must be a number (0 for Option A, 1 for Option B, etc.)
- Make sure to extract all visible multiple-choice questions on the page
- Include all options (usually 4 or 5)
- Maintain the exact format shown above
- CRITICALLY IMPORTANT: For determining the correct answer:
  * If answers are indicated on the page (e.g., "Answer: B"), use that for correctAnswer (where A=0, B=1, C=2, D=3, E=4)
  * Otherwise, carefully analyze each option against the content visible in the image
  * Compare options to find the one that best answers the question based on the visible information
  * Check for subtle differences between similar options
  * Look for contextual clues in the image that may indicate the correct answer
  * Provide a thorough explanation that justifies your choice`;
  }

  // ── JSON parsing (ported verbatim from did-exit parseChunkResponse tree) ──

  parseChunkResponse(text) {
    console.log('🧼 Cleaning and parsing AI response...');
    const jsonText = this.extractJsonFromText(text);

    if (!jsonText) {
      console.warn('⚠️ No JSON block found — trying regex fallback.');
      return this.extractQuestionsWithRegex(text);
    }

    try {
      const parsed = JSON.parse(jsonText);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        console.log(`✅ Parsed ${parsed.questions.length} questions directly.`);
        return this.validateQuestions(parsed.questions);
      }
    } catch (_e) {
      console.warn('⚠️ Direct JSON.parse failed — attempting repair...');
    }

    try {
      const repairedParsed = this.repairAndParseJson(jsonText);
      if (repairedParsed.questions && Array.isArray(repairedParsed.questions)) {
        console.log(
          `✅ Repaired and parsed ${repairedParsed.questions.length} questions.`,
        );
        return this.validateQuestions(repairedParsed.questions);
      }
    } catch (e) {
      console.warn(`⚠️ JSON repair failed: ${e.message} — iterative parsing...`);
    }

    console.log('🔧 Attempting iterative parsing of question objects...');
    const questions = [];
    const questionObjectRegex =
      /{\s*"id":\s*\d+,\s*"question":\s*"[\s\S]*?,\s*"options":\s*\[[\s\S]*?\],\s*"correctAnswer":\s*\d+,\s*"explanation":\s*"[\s\S]*?"\s*}/g;
    const matches = jsonText.match(questionObjectRegex);

    if (matches) {
      for (const match of matches) {
        try {
          questions.push(JSON.parse(match));
        } catch (_e) {
          // skip malformed individual objects
        }
      }
    }

    if (questions.length > 0) {
      console.log(`✅ Iteratively extracted ${questions.length} questions.`);
      return this.validateQuestions(questions);
    }

    console.error('🚨 Failed to parse chunk response after all attempts.');
    return this.extractQuestionsWithRegex(text);
  }

  extractJsonFromText(text) {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match?.[1]) return match[1].trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return text.substring(firstBrace, lastBrace + 1);
    }
    return null;
  }

  repairAndParseJson(jsonString) {
    let repaired = jsonString
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/}"\s*"/g, '}, "')
      .replace(/\\"/g, '"')
      .replace(/([:[,]\s*)"([^"\\]*)"([^"\\]*)"/g, '$1"$2\\"$3"');

    const openBraces = (repaired.match(/{/g) || []).length;
    let closeBraces = (repaired.match(/}/g) || []).length;
    while (openBraces > closeBraces) {
      repaired += '}';
      closeBraces++;
    }

    const openBrackets = (repaired.match(/\[/g) || []).length;
    let closeBrackets = (repaired.match(/]/g) || []).length;
    while (openBrackets > closeBrackets) {
      repaired += ']';
      closeBrackets++;
    }

    return JSON.parse(repaired);
  }

  validateQuestions(questions) {
    const normalized = this.normalizeQuestions(questions);
    return normalized.filter((q, index) => {
      const ok =
        q.question &&
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length > 1 &&
        typeof q.correctAnswer === 'number' &&
        q.explanation &&
        typeof q.explanation === 'string';
      if (!ok) console.warn(`Skipping invalid question at index ${index}:`, q);
      return ok;
    });
  }

  normalizeQuestions(questions) {
    return questions.map((q, index) => {
      const normalized = { ...q };
      if (!normalized.id) normalized.id = index + 1;

      if (
        normalized.answer !== undefined &&
        normalized.correctAnswer === undefined
      ) {
        if (typeof normalized.answer === 'string') {
          const s = normalized.answer.trim().toLowerCase();
          if (/^[a-e]$/.test(s)) {
            normalized.correctAnswer = s.charCodeAt(0) - 'a'.charCodeAt(0);
          } else if (/^(option\s*)?[a-e][.)]/.test(s)) {
            normalized.correctAnswer =
              s.charAt(s.search(/[a-e]/i)).toLowerCase().charCodeAt(0) -
              'a'.charCodeAt(0);
          } else if (Array.isArray(normalized.options)) {
            const idx = normalized.options.findIndex((opt) =>
              opt.toLowerCase().includes(s),
            );
            normalized.correctAnswer = idx >= 0 ? idx : 0;
          } else {
            normalized.correctAnswer = 0;
          }
        } else if (typeof normalized.answer === 'number') {
          normalized.correctAnswer = normalized.answer;
        } else {
          normalized.correctAnswer = 0;
        }
      }

      if (!normalized.explanation) {
        normalized.explanation =
          'This answer is correct based on the information in the document.';
      }

      return normalized;
    });
  }

  extractQuestionsWithRegex(text) {
    console.log('🔧 Regex extraction as final fallback...');
    const questions = [];
    const questionBlockRegex =
      /(\d+[.)]\s*|Question\s*\d+:?\s*)([\s\S]+?)(Answer:|Correct Answer:|Explanation:)/gi;

    let idCounter = 1;
    let match = questionBlockRegex.exec(text);
    while (match !== null) {
      const questionText = match[2].trim();
      const optionsRegex = /([A-Ea-e][.)]\s*)([\s\S]+?)(?=[A-Ea-e][.)]\s*|$)/g;
      const options = [];
      let optMatch = optionsRegex.exec(questionText);
      while (optMatch !== null) {
        options.push(optMatch[2].trim());
        optMatch = optionsRegex.exec(questionText);
      }
      if (questionText.length > 10 && options.length >= 2) {
        questions.push({
          id: idCounter++,
          question: questionText.split(optionsRegex)[0].trim(),
          options,
          correctAnswer: 0,
          explanation: 'N/A — Extracted via regex',
        });
      }
      match = questionBlockRegex.exec(text);
    }

    console.log(`🔧 Regex extraction found ${questions.length} questions`);
    return questions;
  }

  // ── Fatal error detection (ported verbatim) ───────────────────────────────

  static isFatalError(error) {
    const m = (error?.message || String(error)).toLowerCase();
    return (
      /\b429\b/.test(m) ||
      (m.includes('quota') &&
        (m.includes('exceed') || m.includes('exceeded'))) ||
      /\b403\b/.test(m) ||
      /\b401\b/.test(m) ||
      m.includes('invalid api key') ||
      m.includes('api_key_invalid') ||
      m.includes('permission denied') ||
      m.includes('billing')
    );
  }
}

export const geminiService = new GeminiService();

export { resolveGeminiCredentialsForUser };

const MAX_SUPPORT_TOOL_ROUNDS = 5;

/**
 * REST API expects `Content` (parts with text), not a bare string, for
 * `system_instruction` — a raw string can yield 400 on newer models.
 * @param { string | { parts: Array<{ text: string }> } | undefined } value
 * @returns { { parts: Array<{ text: string }> } | undefined }
 */
function normalizeSystemInstruction(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'object' && value.parts && Array.isArray(value.parts)) {
    return value;
  }
  const t = String(value).trim();
  if (!t) return undefined;
  return { parts: [{ text: t }] };
}

/**
 * Gemini startChat requires history to start with role `user`, not `model`.
 * The client may include a leading assistant “welcome” bubble — drop those.
 * @param { Array<{ role: string, content: string }> } messages
 */
function stripLeadingAssistantMessages(messages) {
  let i = 0;
  while (i < messages.length && messages[i].role === 'assistant') {
    i += 1;
  }
  return messages.slice(i);
}

/**
 * Support chat: multi-round Gemini with function calling. `executeTool(name, args)` must return a JSON object.
 * @param { { geminiApiKey?: string; geminiModelId?: string } | null } userLike
 * @param { Array<{ role: string, content: string }> } messages
 * @param { object } options
 * @param { import('@google/generative-ai').FunctionDeclaration[] } options.functionDeclarations
 * @param { string | { parts: Array<{ text: string }> } } [options.systemInstruction]
 * @param { (name: string, args: object) => Promise<Record<string, unknown>> } options.executeTool
 */
export async function runSupportWithTools(userLike, messages, options) {
  const { functionDeclarations, systemInstruction, executeTool } = options;
  if (
    !Array.isArray(functionDeclarations) ||
    functionDeclarations.length === 0
  ) {
    throw new Error('functionDeclarations required');
  }
  if (typeof executeTool !== 'function') {
    throw new Error('executeTool required');
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages must be a non-empty array');
  }
  for (const msg of messages) {
    if (!msg.role || typeof msg.content !== 'string') {
      throw new Error('Each message must have role and string content');
    }
    if (!['user', 'assistant'].includes(msg.role)) {
      throw new Error('Message role must be user or assistant');
    }
  }

  const normalized = stripLeadingAssistantMessages(messages);
  if (normalized.length === 0) {
    throw new Error('No user message to send');
  }

  const { apiKey, modelId } = resolveGeminiCredentialsForUser(userLike);
  if (!apiKey) {
    throw new Error(
      'No Gemini API key. Add your key in Profile (Liqu AI Settings) or set GEMINI_API_KEY on the server.',
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    tools: [{ functionDeclarations }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingMode.AUTO },
    },
  });

  const last = normalized.at(-1);
  if (!last || last.role !== 'user') {
    throw new Error('Last message must be from the user');
  }

  const history = normalized.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  await geminiService.enforceRateLimit();
  const chat = model.startChat({
    systemInstruction: normalizeSystemInstruction(systemInstruction),
    history,
  });

  let result = await chat.sendMessage(last.content);
  let round = 0;

  while (round < MAX_SUPPORT_TOOL_ROUNDS) {
    const response = result.response;
    const calls = response.functionCalls?.() ?? [];
    if (calls.length === 0) {
      try {
        return response.text();
      } catch {
        return 'I could not read a text reply. Please try again.';
      }
    }
    const parts = [];
    for (const call of calls) {
      const args =
        call.args && typeof call.args === 'object' ? { ...call.args } : {};
      const out = await executeTool(call.name, args);
      const safe = out && typeof out === 'object' ? out : { result: out };
      parts.push({
        functionResponse: {
          name: call.name,
          response: safe,
        },
      });
    }
    await geminiService.enforceRateLimit();
    result = await chat.sendMessage(parts);
    round += 1;
  }
  try {
    return (
      result.response.text() ||
      'Could not finish—please ask something simpler or name one classroom.'
    );
  } catch {
    return 'Could not finish after several tool steps—try a simpler question.';
  }
}

/**
 * Gemini client for a uploader: profile key first, then server GEMINI_API_KEY.
 */
export async function getGeminiServiceForUser(userLike) {
  const { apiKey, modelId } = resolveGeminiCredentialsForUser(userLike);
  if (!apiKey) {
    throw new Error(
      'No Gemini API key. Add your key in Profile (Liqu AI Settings) or set GEMINI_API_KEY on the server.',
    );
  }
  return geminiService.forUser(apiKey, modelId);
}
