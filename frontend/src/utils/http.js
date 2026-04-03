function looksLikeHtml(text) {
  const sample = (text ?? '').trim().slice(0, 40).toLowerCase();
  return sample.startsWith('<!doctype') || sample.startsWith('<html');
}

export async function readJsonOrThrow(response, fallbackMessage = 'Request failed') {
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();

  if (!contentType.includes('application/json')) {
    if (looksLikeHtml(raw)) {
      throw new Error('API returned HTML instead of JSON. Start backend and ensure Vite /api proxy is enabled.');
    }
    throw new Error(`${fallbackMessage} (${response.status})`);
  }

  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error('Received invalid JSON from API.');
  }

  if (!response.ok) {
    throw new Error(payload?.message || `${fallbackMessage} (${response.status})`);
  }

  return payload;
}
