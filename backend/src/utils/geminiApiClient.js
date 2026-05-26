export async function testGeminiApiKey(apiKey) {
  const key = String(apiKey || '').trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error?.message || `Gemini API key test failed (${res.status}).`,
    );
  }
  return { ok: true };
}

export async function listGeminiModels(apiKey) {
  const key = String(apiKey || '').trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error?.message || `Failed to list Gemini models (${res.status}).`,
    );
  }

  const models = (Array.isArray(data?.models) ? data.models : [])
    .filter((model) => {
      const methods = model?.supportedGenerationMethods;
      return (
        Array.isArray(methods) &&
        methods.includes('generateContent') &&
        typeof model?.name === 'string'
      );
    })
    .map((model) => {
      const name = model.name.replace(/^models\//, '');
      return {
        name,
        displayName: model.displayName || name,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return models;
}
