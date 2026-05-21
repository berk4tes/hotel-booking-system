const API_BASE = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:3000";

export async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.body ? { "content-type": "application/json" } : {}),
    ...(options.session?.access_token ? { Authorization: `Bearer ${options.session.access_token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(body?.error || "Request failed");
  }

  return body;
}
