// Store & Layout
export interface Store {
  id: string
  store_code: string
  store_name: string
  ls_store_code: string
  active: boolean
  created_at: string
}

export interface Zone {
  id: string
  store_id: string
  zone_code: string
  zone_name: string
}

export interface Aisle {
  id: string
  zone_id: string
  aisle_code: string
  aisle_name: string
}

export interface Bay {
  id: string
  aisle_id: string
  bay_code: string
  bay_name: string
  barcode: string
  active: boolean
}

export interface StoreLayout {
  zones: Zone[]
  aisles: Aisle[]
  bays: Bay[]
}

// Sessions
export type SessionType = 'FULL' | 'PARTIAL'
export type SessionStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'COUNTING_COMPLETE'
  | 'PENDING_REVIEW'
  | 'SUBMITTED'
  | 'CLOSED'

export interface Session {
  id: string
  store_id: string
  session_date: string
  type: SessionType
  status: SessionStatus
  created_by: string
  created_at: string
}

export interface Counter {
  id: string
  name: string
  mobile_number: string
  created_at: string
}

export interface TheoreticalStock {
  session_id: string
  item_no: string
  theoretical_qty: number
  pulled_at: string
}

// Counting
export interface CountLine {
  id: string
  session_id: string
  bay_id: string
  item_no: string
  counter_id: string
  quantity: number
  counted_at: string
  synced_at: string
  round_no: number
  client_uuid: string
}

export interface BinSubmission {
  id: string
  session_id: string
  bay_id: string
  counter_id: string
  submitted_at: string
}

// Variance & Audit
export type FlagStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export interface ConsolidatedLine {
  item_no: string
  description: string
  counted_qty: number
  theoretical_qty: number
  variance: number
  variance_pct: number
  flagged: boolean
}

export interface AuditLine {
  item_no: string
  description: string
  bay_code: string
  counter_name: string
  quantity: number
  round_no: number
  counted_at: string
}

export interface VarianceFlag {
  id: string
  session_id: string
  item_no: string
  flagged_by: string
  flagged_at: string
  status: FlagStatus
}

// Reporting
export interface CounterPerformance {
  counter_id: string
  counter_name: string
  mobile: string
  items_counted: number
  bays_completed: number
  recount_rate_pct: number
  recount_accepted: number
  recount_rejected: number
  // avg_time_per_bay_seconds: number  // coming in a future release
  last_activity: string
}

export interface SessionSummary {
  session_id: string
  total_items: number
  total_bays: number
  bays_completed: number
  total_counts: number
  counters: CounterPerformance[]
}

// WebSocket events
export type WSEventType =
  | 'count.submitted'
  | 'bin.completed'
  | 'counter.connected'
  | 'counter.disconnected'
  | 'session.status_changed'

export interface WSEvent {
  type: WSEventType
  session_id: string
  payload: Record<string, unknown>
}
