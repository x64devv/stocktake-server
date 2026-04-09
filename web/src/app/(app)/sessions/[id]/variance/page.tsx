'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { variance as varianceApi } from '@/lib/api'
import type { ConsolidatedLine, VarianceFlag } from '@/types'
import { Button, Card, CardBody, Badge, Spinner, Empty } from '@/components/ui'
import { clsx } from 'clsx'

type DecisionModal = { flagId: string; itemNo: string; decision: 'ACCEPTED' | 'REJECTED' } | null

export default function VariancePage() {
  const { id } = useParams<{ id: string }>()
  const [lines, setLines] = useState<ConsolidatedLine[]>([])
  const [flags, setFlags] = useState<VarianceFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [modal, setModal] = useState<DecisionModal>(null)
  const [notes, setNotes] = useState('')
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [l, f] = await Promise.all([
      varianceApi.getReport(id),
      varianceApi.getFlags(id),
    ])
    setLines(l ?? [])
    setFlags(f ?? [])
  }, [id])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  // Build a quick lookup: item_no -> flag (PENDING only)
  const pendingFlagByItem = Object.fromEntries(
    flags.filter(f => f.status === 'PENDING').map(f => [f.item_no, f])
  )
  const resolvedFlagByItem = Object.fromEntries(
    flags.filter(f => f.status !== 'PENDING').map(f => [f.item_no, f])
  )

  function toggleSelect(itemNo: string) {
    // Only allow selecting items that aren't already flagged
    if (pendingFlagByItem[itemNo] || resolvedFlagByItem[itemNo]) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(itemNo) ? next.delete(itemNo) : next.add(itemNo)
      return next
    })
  }

  async function flagSelected() {
    if (!selected.size) return
    setSubmitting(true)
    try {
      await varianceApi.flagItems(id, Array.from(selected))
      setSelected(new Set())
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function submitDecision() {
    if (!modal) return
    setDecidingId(modal.flagId)
    try {
      await varianceApi.updateFlag(id, modal.flagId, modal.decision, notes)
      setModal(null)
      setNotes('')
      await load()
    } finally {
      setDecidingId(null)
    }
  }

  function flagBadge(itemNo: string) {
    const pending = pendingFlagByItem[itemNo]
    if (pending) {
      return (
        <div className="flex items-center gap-1.5">
          <Badge color="yellow">Pending recount</Badge>
          <button
            onClick={() => setModal({ flagId: pending.id, itemNo, decision: 'ACCEPTED' })}
            className="text-xs text-green-600 hover:text-green-700 font-medium px-1.5 py-0.5 rounded hover:bg-green-50"
          >
            Accept
          </button>
          <button
            onClick={() => setModal({ flagId: pending.id, itemNo, decision: 'REJECTED' })}
            className="text-xs text-red-600 hover:text-red-700 font-medium px-1.5 py-0.5 rounded hover:bg-red-50"
          >
            Reject
          </button>
        </div>
      )
    }
    const resolved = resolvedFlagByItem[itemNo]
    if (resolved) {
      return (
        <Badge color={resolved.status === 'ACCEPTED' ? 'green' : 'gray'}>
          Recount {resolved.status.toLowerCase()}
        </Badge>
      )
    }
    return null
  }

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>

  const pendingCount = flags.filter(f => f.status === 'PENDING').length

  return (
    <div className="p-6 space-y-6">
      {/* Decision modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              {modal.decision === 'ACCEPTED' ? 'Accept recount result' : 'Reject recount'}
            </h2>
            <p className="text-sm text-gray-500">
              Item <span className="font-mono text-gray-700">{modal.itemNo}</span> —{' '}
              {modal.decision === 'ACCEPTED'
                ? 'Accept the recount as the final count for this item.'
                : 'Reject the recount and keep the original count.'}
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes about this decision…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => { setModal(null); setNotes('') }}>
                Cancel
              </Button>
              <Button
                variant={modal.decision === 'ACCEPTED' ? 'primary' : 'danger'}
                onClick={submitDecision}
                loading={!!decidingId}
              >
                {modal.decision === 'ACCEPTED' ? 'Accept' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Variance Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lines.length} item{lines.length !== 1 ? 's' : ''} outside tolerance
            {pendingCount > 0 && (
              <span className="ml-2 text-yellow-600 font-medium">· {pendingCount} pending recount review</span>
            )}
          </p>
        </div>
        {selected.size > 0 && (
          <Button variant="danger" onClick={flagSelected} loading={submitting}>
            Flag {selected.size} for recount
          </Button>
        )}
      </div>

      <Card>
        <CardBody className="p-0">
          {lines.length === 0 ? (
            <Empty message="No variance items — all counts within tolerance." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  {['Item no.', 'Description', 'Counted', 'Theoretical', 'Variance', 'Var %', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lines.map(line => {
                  const isPending = !!pendingFlagByItem[line.item_no]
                  const isResolved = !!resolvedFlagByItem[line.item_no]
                  const isSelected = selected.has(line.item_no)
                  return (
                    <tr
                      key={line.item_no}
                      className={clsx(
                        'hover:bg-gray-50',
                        isSelected && 'bg-red-50',
                        isResolved && 'opacity-50',
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isPending || isResolved}
                          onChange={() => toggleSelect(line.item_no)}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{line.item_no}</td>
                      <td className="px-4 py-3 text-gray-900">{line.description}</td>
                      <td className="px-4 py-3">{line.counted_qty}</td>
                      <td className="px-4 py-3">{line.theoretical_qty}</td>
                      <td className="px-4 py-3 font-medium text-red-600">
                        {line.variance > 0 ? '+' : ''}{line.variance}
                      </td>
                      <td className="px-4 py-3 font-medium text-red-600 text-xs">
                        {line.variance_pct > 0 ? '+' : ''}{line.variance_pct}%
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        {flagBadge(line.item_no)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}