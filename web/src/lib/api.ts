const API_BASE = '/api/v1'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('st_token') : null
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

// ── Stores ────────────────────────────────────────────────────────────────────
export const stores = {
  list: () => request<import('@/types').Store[]>('/stores'),
  get: (id: string) => request<import('@/types').Store>(`/stores/${id}`),
  create: (data: Partial<import('@/types').Store>) =>
    request<import('@/types').Store>('/stores', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<import('@/types').Store>) =>
    request<import('@/types').Store>(`/stores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getLayout: (id: string) => request<import('@/types').StoreLayout>(`/stores/${id}/layout`),
  createZone: (storeId: string, data: Partial<import('@/types').Zone>) =>
    request<import('@/types').Zone>(`/stores/${storeId}/zones`, { method: 'POST', body: JSON.stringify(data) }),
  createAisle: (storeId: string, data: Partial<import('@/types').Aisle>) =>
    request<import('@/types').Aisle>(`/stores/${storeId}/aisles`, { method: 'POST', body: JSON.stringify(data) }),
  createBay: (storeId: string, data: Partial<import('@/types').Bay>) =>
    request<import('@/types').Bay>(`/stores/${storeId}/bays`, { method: 'POST', body: JSON.stringify(data) }),
  allLabelsUrl: (id: string) => `${API_BASE}/stores/${id}/labels`,
  bayLabelUrl: (id: string, bayId: string) => `${API_BASE}/stores/${id}/bays/${bayId}/label`,
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessions = {
  list: (storeId?: string) =>
    request<import('@/types').Session[]>(`/sessions${storeId ? `?store_id=${storeId}` : ''}`),
  get: (id: string) => request<import('@/types').Session>(`/sessions/${id}`),
  create: (data: Partial<import('@/types').Session>) =>
    request<import('@/types').Session>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) =>
    request(`/sessions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  listCounters: (id: string) => request<import('@/types').Counter[]>(`/sessions/${id}/counters`),
  addCounter: (id: string, name: string, mobile: string) =>
    request<import('@/types').Counter>(`/sessions/${id}/counters`, {
      method: 'POST',
      body: JSON.stringify({ name, mobile }),
    }),
  removeCounter: (id: string, counterId: string) =>
    request(`/sessions/${id}/counters/${counterId}`, { method: 'DELETE' }),
  resendOtp: (id: string, counterId: string) =>
    request(`/sessions/${id}/counters/${counterId}/resend-otp`, { method: 'POST' }),
  pullTheoretical: (id: string) =>
    request(`/sessions/${id}/pull-theoretical`, { method: 'POST' }),
  submit: (id: string) =>
    request(`/sessions/${id}/submit`, { method: 'POST' }),
}

// ── Variance & Audit ──────────────────────────────────────────────────────────
export const variance = {
  getConsolidated: (sessionId: string) =>
    request<import('@/types').ConsolidatedLine[]>(`/sessions/${sessionId}/consolidated`),
  getAudit: (sessionId: string) =>
    request<import('@/types').AuditLine[]>(`/sessions/${sessionId}/audit`),
  getReport: (sessionId: string) =>
    request<import('@/types').ConsolidatedLine[]>(`/sessions/${sessionId}/variance-report`),
  getFlags: (sessionId: string) =>
    request<import('@/types').VarianceFlag[]>(`/sessions/${sessionId}/variance-flags`),
  flagItems: (sessionId: string, itemNos: string[]) =>
    request(`/sessions/${sessionId}/variance-flags`, {
      method: 'POST',
      body: JSON.stringify({ item_nos: itemNos }),
    }),
  updateFlag: (sessionId: string, flagId: string, decision: string, notes?: string) =>
    request(`/sessions/${sessionId}/variance-flags/${flagId}`, {
      method: 'PUT',
      body: JSON.stringify({ decision, notes }),
    }),
}

// ── Reporting ─────────────────────────────────────────────────────────────────
export const reporting = {
  getSummary: (sessionId: string) =>
    request<import('@/types').SessionSummary>(`/sessions/${sessionId}/performance`),
  getCounterPerformance: (sessionId: string) =>
    request<import('@/types').CounterPerformance[]>(`/sessions/${sessionId}/counter-performance`),
  getCounterDetail: (sessionId: string, counterId: string) =>
    request<import('@/types').CounterPerformance>(`/sessions/${sessionId}/counter-performance/${counterId}`),
}

// ── Admin users ───────────────────────────────────────────────────────────────
export const adminUsers = {
  list: () => request<import('@/types').AdminUser[]>('/admin/users'),
  create: (data: { username: string; password: string; full_name: string }) =>
    request<import('@/types').AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  deactivate: (id: string) =>
    request(`/admin/users/${id}/deactivate`, { method: 'PUT' }),
  resetPassword: (id: string, password: string) =>
    request(`/admin/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
}
