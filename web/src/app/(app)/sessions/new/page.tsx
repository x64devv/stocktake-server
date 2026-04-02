'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sessions, stores } from '@/lib/api'
import type { Store } from '@/types'
import { Button, Card, CardBody, CardHeader, Spinner } from '@/components/ui'

export default function NewSessionPage() {
  const router = useRouter()
  const [storeList, setStoreList] = useState<Store[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    store_id: '',
    session_date: new Date().toISOString().slice(0, 10),
    type: 'FULL' as 'FULL' | 'PARTIAL',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    stores.list().then(setStoreList)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.store_id) { setError('Please select a store'); return }
    setLoading(true)
    setError('')
    try {
      const sess = await sessions.create(form)
      router.push(`/sessions/${sess.id}/monitor`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">New Stock Take</h1>
        <p className="text-sm text-gray-500 mt-0.5">Set up a new stock take session</p>
      </div>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-gray-700">Session details</h2></CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
              <select
                value={form.store_id}
                onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Select a store…</option>
                {storeList.map(s => (
                  <option key={s.id} value={s.id}>{s.store_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Count date</label>
              <input
                type="date"
                value={form.session_date}
                onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Count type</label>
              <div className="flex gap-4">
                {(['FULL', 'PARTIAL'] as const).map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={type}
                      checked={form.type === type}
                      onChange={() => setForm(f => ({ ...f, type }))}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">
                      {type === 'FULL' ? 'Full store count' : 'Partial (select items)'}
                    </span>
                  </label>
                ))}
              </div>
              {form.type === 'PARTIAL' && (
                <p className="mt-2 text-xs text-gray-400">Item selection will be available after creation.</p>
              )}
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
