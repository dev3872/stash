import { config } from '../lib/config.js';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Calls the Stash API. JSON bodies are serialized; FormData is sent as multipart. */
export async function apiFetch(path, { method = 'GET', body, token, signal } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${config.apiUrl}/api${path}`, { method, headers, body: payload, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'Can’t reach the Stash server. Check your connection and try again.');
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const fallback = res.status >= 500 ? 'Something went wrong on our side. Please try again.' : `Request failed (${res.status}).`;
    throw new ApiError(res.status, data?.error || fallback);
  }
  return data;
}
