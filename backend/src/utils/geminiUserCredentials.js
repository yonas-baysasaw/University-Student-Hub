import User from '../models/User.js';
import { decryptGeminiApiKey } from './geminiKeyCrypto.js';

export async function loadUserGeminiCredentials(userId) {
  if (!userId) {
    return { geminiApiKey: '', geminiModelId: '', geminiKeySet: false };
  }
  const user = await User.findById(userId)
    .select('+geminiApiKey geminiModelId geminiKeySet')
    .lean();
  if (!user) {
    return { geminiApiKey: '', geminiModelId: '', geminiKeySet: false };
  }
  const geminiApiKey = user.geminiKeySet
    ? decryptGeminiApiKey(user.geminiApiKey)
    : '';
  return {
    geminiApiKey,
    geminiModelId: user.geminiModelId || '',
    geminiKeySet: !!user.geminiKeySet,
  };
}

export function userLikeFromCredentials(credentials) {
  return {
    geminiApiKey: credentials?.geminiApiKey || '',
    geminiModelId: credentials?.geminiModelId || '',
  };
}
