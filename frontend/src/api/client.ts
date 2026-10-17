export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      detail = Array.isArray(body.detail) ? body.detail.join('; ') : (body.detail ?? detail);
    } catch {}
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export interface Session {
  authenticated: boolean;
  user: string | null;
  account?: string;
  is_admin?: boolean;
  auth_required: boolean;
}

export const auth = {
  session: () => request<Session>('/api/auth/session'),
  login: (username: string, password: string) =>
    request<{ user: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
};
