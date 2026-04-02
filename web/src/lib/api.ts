import type {
  Store, StoreLayout, Zone, Aisle, Bay,
  Session, Counter,
  ConsolidatedLine, AuditLine, VarianceFlag,
  CounterPerformance, SessionSummary,
} from '@/types'

const BASE = ''  // Nginx proxies /api/ — no base URL needed

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('st_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  // Coerce null to empty array for array endpoints
  if (data === null) return [] as unknown as T
  return data
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login: (username: string, password: string) =>
    request<{ token: string }>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
}

// ── Stores ────────────────────────────────────────────────────────────────────
export const stores = {
  list: () => request<Store[]>('/stores'),
  get: (id: string) => request<Store>(`/stores/${id}`),
  create: (data: Partial<Store>) =>
    request<Store>('/stores', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Store>) =>
    request<Store>(`/stores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getLayout: (id: string) => request<StoreLayout>(`/stores/${id}/layout`),
  createZone: (storeId: string, data: Partial<Zone>) =>
    request<Zone>(`/stores/${storeId}/zones`, { method: 'POST', body: JSON.stringify(data) }),
  createAisle: (storeId: string, data: Partial<Aisle>) =>
    request<Aisle>(`/stores/${storeId}/aisles`, { method: 'POST', body: JSON.stringify(data) }),
  createBay: (storeId: string, data: Partial<Bay>) =>
    request<Bay>(`/stores/${storeId}/bays`, { method: 'POST', body: JSON.stringify(data) }),
  labelsUrl: (storeId: string) => `${BASE}/api/v1/stores/${storeId}/labels`,
  bayLabelUrl: (storeId: string, bayId: string) =>
    `${BASE}/api/v1/stores/${storeId}/bays/${bayId}/label`,
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessions = {
  list: (storeId?: string) =>
    request<Session[]>(`/sessions${storeId ? `?store_id=${storeId}` : ''}`),
  get: (id: string) => request<Session>(`/sessions/${id}`),
  create: (data: Partial<Session>) =>
    request<Session>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) =>
    request(`/sessions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  listCounters: (id: string) => request<Counter[]>(`/sessions/${id}/counters`),
  addCounter: (id: string, name: string, mobile: string) =>
    request<Counter>(`/sessions/${id}/counters`, {
      method: 'POST',
      body: JSON.stringify({ name, mobile }),
    }),
  removeCounter: (id: string, counterId: string) =>
    request(`/sessions/${id}/counters/${counterId}`, { method: 'DELETE' }),
  pullTheoretical: (id: string) =>
    request(`/sessions/${id}/pull-theoretical`, { method: 'POST' }),
  submit: (id: string) =>
    request(`/sessions/${id}/submit`, { method: 'POST' }),
}

// ── Variance & Audit ──────────────────────────────────────────────────────────
export const variance = {
  getConsolidated: (sessionId: string) =>
    request<ConsolidatedLine[]>(`/sessions/${sessionId}/consolidated`),
  getAudit: (sessionId: string) =>
    request<AuditLine[]>(`/sessions/${sessionId}/audit`),
  getReport: (sessionId: string) =>
    request<ConsolidatedLine[]>(`/sessions/${sessionId}/variance-report`),
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
    request<SessionSummary>(`/sessions/${sessionId}/performance`),
  getCounterPerformance: (sessionId: string) =>
    request<CounterPerformance[]>(`/sessions/${sessionId}/counter-performance`),
  getCounterDetail: (sessionId: string, counterId: string) =>
    request<CounterPerformance>(`/sessions/${sessionId}/counter-performance/${counterId}`),
}
