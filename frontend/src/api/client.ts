const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${msg}`)
  }
  return res.json()
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  upload: <T>(url: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${BASE}${url}`, { method: 'POST', body: form }).then((r) => {
      if (!r.ok) throw new Error(`Upload failed: ${r.status}`)
      return r.json() as Promise<T>
    })
  },
}
