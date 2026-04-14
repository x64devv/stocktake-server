'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { sessions as sessionsApi, stores, ls } from '@/lib/api'
import type { Session, Counter, Store } from '@/types'
import { Button, Card, CardBody, CardHeader, Spinner, Empty, StatCard } from '@/components/ui'

type Worksheet = { journal_template_name: string; journal_batch_name: string }

const STATUS_ACTIONS: Record<string, { label: string; next: string; variant: 'primary' | 'danger' | 'secondary' }[]> = {
  DRAFT:             [{ label: 'Activate session',       next: 'ACTIVE',            variant: 'primary'   }],
  ACTIVE:            [{ label: 'Mark counting complete', next: 'COUNTING_COMPLETE', variant: 'secondary' }],
  COUNTING_COMPLETE: [{ label: 'Pull theoretical stock', next: 'pull_theoretical',  variant: 'primary'   }],
  PENDING_REVIEW:    [{ label: 'Submit to LS / BC',      next: 'submit',            variant: 'primary'   }],
  SUBMITTED: [],
  CLOSED:    [],
}

const EDITABLE_STATUSES = ['DRAFT', 'ACTIVE', 'COUNTING_COMPLETE']

export default function SessionOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession]   = useState<Session | null>(null)
  const [store, setStore]       = useState<Store | null>(null)
  const [counters, setCounters] = useState<Counter[]>([])
  const [worksheets, setWorksheets] = useState<Worksheet[]>([])
  const [loading, setLoading]   = useState(true)

  const [actionLoading, setActionLoading]   = useState(false)
  const [addLoading, setAddLoading]         = useState(false)
  const [resendingId, setResendingId]       = useState<string | null>(null)
  const [wsLoading, setWsLoading]           = useState(false)
  const [resyncLoading, setResyncLoading]   = useState(false)
  const [selectedWorksheet, setSelectedWorksheet] = useState('')

  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [newCounter, setNewCounter] = useState({ name: '', mobile: '' })

  async function load() {
    const sess = await sessionsApi.get(id)
    setSession(sess)
    setSelectedWorksheet(sess.worksheet_no ?? '')
    const [st, ctrs] = await Promise.all([
      stores.get(sess.store_id),
      sessionsApi.listCounters(id),
    ])
    setStore(st)
    setCounters(ctrs ?? [])
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
    ls.worksheets()
      .then(setWorksheets)
      .catch(() => setWorksheets([]))
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

  async function handleWorksheetSave() {
    setWsLoading(true)
    setError('')
    setSuccess('')
    try {
      const updated = await sessionsApi.updateWorksheet(id, selectedWorksheet)
      setSession(updated)
      setSuccess(
        selectedWorksheet
          ? `Worksheet linked${updated.worksheet_no ? ' and theoreticals synced' : ''}.`
          : 'Worksheet unlinked.'
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update worksheet')
    } finally {
      setWsLoading(false)
    }
  }

  async function handleResync() {
    setResyncLoading(true)
    setError('')
    setSuccess('')
    try {
      await sessionsApi.pullTheoretical(id)
      setSuccess('Theoretical stock re-synced from LS.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Re-sync failed')
    } finally {
      setResyncLoading(false)
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
  const canEditWorksheet  = EDITABLE_STATUSES.includes(session.status)
  const worksheetDirty    = selectedWorksheet !== (session.worksheet_no ?? '')

  return (
    <div className="p-6 space-y-6">
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
      {success && <div className="bg-teal-50 border border-teal-200 text-teal-700 text-sm px-4 py-3 rounded-lg">{success}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Store"    value={store?.store_name ?? '—'} />
        <StatCard label="Date"     value={session.session_date} />
        <StatCard label="Type"     value={session.type} />
        <StatCard label="Counters" value={String(counters.length)} />
      </div>

      {/* LS Worksheet */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">LS Worksheet</h2>
            {session.worksheet_no && canEditWorksheet && (
              <Button
                size="sm"
                variant="secondary"
                loading={resyncLoading}
                onClick={handleResync}
              >
                Re-sync theoreticals
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {canEditWorksheet ? (
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Linked worksheet (journal batch)
                </label>
                {worksheets.length > 0 ? (
                  <select
                    value={selectedWorksheet}
                    onChange={e => setSelectedWorksheet(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">None — no theoreticals</option>
                    {worksheets.map(w => (
                      <option key={w.journal_batch_name} value={w.journal_batch_name}>
                        {w.journal_batch_name}
                        {w.journal_template_name ? ` (${w.journal_template_name})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedWorksheet}
                    onChange={e => setSelectedWorksheet(e.target.value)}
                    placeholder="Enter journal batch name manually"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                )}
              </div>
              <Button
                size="sm"
                loading={wsLoading}
                disabled={!worksheetDirty}
                onClick={handleWorksheetSave}
              >
                Save
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Linked worksheet:</span>
              {session.worksheet_no
                ? <span className="font-mono font-medium text-gray-900">{session.worksheet_no}</span>
                : <span className="text-gray-400 italic">None</span>
              }
            </div>
          )}
          {!session.worksheet_no && !canEditWorksheet && (
            <p className="text-xs text-amber-600 mt-2">
              No worksheet was linked before counting completed. Theoretical stock will be empty.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Session actions */}
      {actions.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-gray-700">Actions</h2></CardHeader>
          <CardBody>
            <div className="flex gap-3 flex-wrap">
              {actions.map(a => (
                <Button
                  key={a.next}
                  variant={a.variant}
                  loading={actionLoading}
                  onClick={() => handleAction(a.next)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Counters */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700">
            Counters ({counters.length})
          </h2>
        </CardHeader>
        <CardBody className="p-0">
          {counters.length === 0 ? (
            <div className="px-4 py-6">
              <Empty message="No counters assigned yet." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Mobile', ...(canModifyCounters ? ['', ''] : [])].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {counters.map(c => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.mobile_number}</td>
                    {canModifyCounters && (
                      <>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={resendingId === c.id}
                            onClick={() => handleResendOtp(c)}
                          >
                            Resend OTP
                          </Button>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleRemoveCounter(c.id)}
                          >
                            Remove
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {canModifyCounters && (
            <form onSubmit={handleAddCounter} className="flex gap-2 p-4 border-t border-gray-100">
              <input
                value={newCounter.name}
                onChange={e => setNewCounter(n => ({ ...n, name: e.target.value }))}
                placeholder="Counter name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <input
                value={newCounter.mobile}
                onChange={e => setNewCounter(n => ({ ...n, mobile: e.target.value }))}
                placeholder="Mobile number"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <Button type="submit" size="sm" loading={addLoading}>Add</Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  )
}