'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { sessions as sessionsApi, stores } from '@/lib/api'
import type { Session, Counter, Store } from '@/types'
import { Button, Card, CardBody, CardHeader, Spinner, Empty, StatCard } from '@/components/ui'

const STATUS_ACTIONS: Record<string, { label: string; next: string; variant: 'primary' | 'danger' | 'secondary' }[]> = {
  DRAFT:             [{ label: 'Activate session',       next: 'ACTIVE',            variant: 'primary'   }],
  ACTIVE:            [{ label: 'Mark counting complete', next: 'COUNTING_COMPLETE', variant: 'secondary' }],
  COUNTING_COMPLETE: [{ label: 'Pull theoretical stock', next: 'pull_theoretical',  variant: 'primary'   }],
  PENDING_REVIEW:    [{ label: 'Submit to LS / BC',      next: 'submit',            variant: 'primary'   }],
  SUBMITTED: [],
  CLOSED:    [],
}

export default function SessionOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession]     = useState<Session | null>(null)
  const [store, setStore]         = useState<Store | null>(null)
  const [counters, setCounters]   = useState<Counter[]>([])
  const [loading, setLoading]     = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [addLoading, setAddLoading]       = useState(false)
  const [resendingId, setResendingId]     = useState<string | null>(null)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [newCounter, setNewCounter] = useState({ name: '', mobile: '' })

  async function load() {
    const sess = await sessionsApi.get(id)
    setSession(sess)
    const [st, ctrs] = await Promise.all([
      stores.get(sess.store_id),
      sessionsApi.listCounters(id),
    ])
    setStore(st)
    setCounters(ctrs ?? [])
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [id])

  async function handleAction(action: string) {
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      if (action === 'pull_theoretical') {
        await sessionsApi.pullTheoretical(id)
        await sessionsApi.updateStatus(id, 'PENDING_REVIEW')
        setSuccess('Theoretical stock pulled. Session is now in Pending Review.')
      } else if (action === 'submit') {
        await sessionsApi.submit(id)
        setSuccess('Session submitted to LS / BC successfully.')
      } else {
        await sessionsApi.updateStatus(id, action)
        setSuccess('Session status updated.')
      }
      setSession(await sessionsApi.get(id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAddCounter(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setError('')
    setSuccess('')
    try {
      const counter = await sessionsApi.addCounter(id, newCounter.name, newCounter.mobile)
      setCounters(prev => [...prev, counter])
      setNewCounter({ name: '', mobile: '' })
      setSuccess(`${newCounter.name} added.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add counter')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleRemoveCounter(counterId: string) {
    setError('')
    try {
      await sessionsApi.removeCounter(id, counterId)
      setCounters(prev => prev.filter(c => c.id !== counterId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove counter')
    }
  }

  async function handleResendOtp(counter: Counter) {
    setResendingId(counter.id)
    setError('')
    setSuccess('')
    try {
      await sessionsApi.resendOtp(id, counter.id)
      setSuccess(`OTP resent to ${counter.name} (${counter.mobile_number}).`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP')
    } finally {
      setResendingId(null)
    }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>
  if (!session) return <div className="p-6 text-gray-500">Session not found.</div>

  const actions = STATUS_ACTIONS[session.status] ?? []
  const canModifyCounters = session.status === 'DRAFT' || session.status === 'ACTIVE'

  return (
    <div className="p-6 space-y-6">
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
      {success && <div className="bg-teal-50 border border-teal-200 text-teal-700 text-sm px-4 py-3 rounded-lg">{success}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Store"              value={store?.store_name ?? '...'} />
        <StatCard label="Date"               value={session.session_date} />
        <StatCard label="Type"               value={session.type} />
        <StatCard label="Variance tolerance" value={`±${session.variance_tolerance_pct}%`} />
      </div>

      {actions.length > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Next action</p>
                <p className="text-xs text-gray-400 mt-0.5">Move this session to the next stage</p>
              </div>
              <div className="flex gap-2">
                {actions.map(action => (
                  <Button
                    key={action.next}
                    variant={action.variant}
                    loading={actionLoading}
                    onClick={() => handleAction(action.next)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700">
            Counters <span className="text-gray-400 font-normal ml-1">({counters.length})</span>
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          {canModifyCounters && (
            <form onSubmit={handleAddCounter} className="flex gap-2 pb-4 border-b border-gray-100">
              <input
                value={newCounter.name}
                onChange={e => setNewCounter(n => ({ ...n, name: e.target.value }))}
                placeholder="Full name"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <input
                value={newCounter.mobile}
                onChange={e => setNewCounter(n => ({ ...n, mobile: e.target.value }))}
                placeholder="Mobile number"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <Button type="submit" size="sm" loading={addLoading}>Add counter</Button>
            </form>
          )}

          {counters.length === 0 ? (
            <Empty message="No counters added yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Mobile', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {counters.map(counter => (
                  <tr key={counter.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{counter.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{counter.mobile_number}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => handleResendOtp(counter)}
                          disabled={resendingId === counter.id}
                          className="text-xs text-teal-600 hover:text-teal-700 font-medium disabled:opacity-50"
                        >
                          {resendingId === counter.id ? 'Sending…' : 'Resend OTP'}
                        </button>
                        {canModifyCounters && (
                          <button
                            onClick={() => handleRemoveCounter(counter.id)}
                            className="text-xs text-red-500 hover:text-red-600 font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}