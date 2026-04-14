'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sessions, stores } from '@/lib/api'
import type { Store } from '@/types'
import { Button, Card, CardBody, CardHeader, Spinner } from '@/components/ui'

const SESSION_TYPES = [
  { value: 'FLOOR',      label: 'Floor',        partial: false },
  { value: 'BAKERY',     label: 'Bakery',        partial: false },
  { value: 'BUTCHERY',   label: 'Butchery',      partial: false },
  { value: 'FRUIT_VEG',  label: 'Fruit & Veg',   partial: false },
  { value: 'DELI_COLD',  label: 'Deli Cold',     partial: false },
  { value: 'DELI_HOT',   label: 'Deli Hot',      partial: false },
  { value: 'QSR',        label: 'QSR',           partial: false },
  { value: 'RESTAURANT', label: 'Restaurant',    partial: false },
  { value: 'PARTIAL',    label: 'Partial (select items)', partial: true },
] as const

type SessionTypeValue = typeof SESSION_TYPES[number]['value']

export default function NewSessionPage() {
  const router = useRouter()
  const [storeList, setStoreList] = useState<Store[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    store_id: '',
    session_date: new Date().toISOString().slice(0, 10),
    type: 'FLOOR' as SessionTypeValue,
    variance_tolerance_pct: 2.0,
    worksheet_no: '',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    stores.list().then(setStoreList)
  }, [])

  const isPartial = form.type === 'PARTIAL'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.store_id) { setError('Please select a store'); return }
    setLoading(true)
    setError('')
    try {
      const payload = {
        ...form,
        worksheet_no: form.worksheet_no.trim() || undefined,
      }
      const sess = await sessions.create(payload)
      router.push(`/sessions/${sess.id}/monitor`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New stock take</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a session to begin counting</p>
      </div>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-gray-700">Session details</h2></CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Store */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Store</label>
              <select
                value={form.store_id}
                onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Select a store…</option>
                {storeList.filter(s => s.active).map(s => (
                  <option key={s.id} value={s.id}>{s.store_name}</option>
                ))}
              </select>
            </div>

            {/* Count date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Count date</label>
              <input
                type="date"
                value={form.session_date}
                onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            {/* Count type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Count type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as SessionTypeValue }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                {SESSION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {isPartial && (
                <p className="mt-1.5 text-xs text-gray-400">Item selection will be available after creation.</p>
              )}
            </div>

            {/* LS Worksheet number (not shown for Partial) */}
            {!isPartial && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  LS Worksheet no. <span className="text-gray-400 font-normal">(optional — can be set later)</span>
                </label>
                <input
                  type="text"
                  value={form.worksheet_no}
                  onChange={e => setForm(f => ({ ...f, worksheet_no: e.target.value }))}
                  placeholder="e.g. ST-FLOOR-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  The LS Retail worksheet this session will pull theoreticals from.
                </p>
              </div>
            )}

            {/* Variance tolerance */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Variance tolerance (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.variance_tolerance_pct}
                onChange={e => setForm(f => ({ ...f, variance_tolerance_pct: parseFloat(e.target.value) || 2.0 }))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Items beyond this % will appear in the variance report. Default is 2%.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading}>Create session</Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}