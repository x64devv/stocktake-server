'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { variance as varianceApi } from '@/lib/api'
import type { ConsolidatedLine, VarianceFlag } from '@/types'
import { Button, Card, CardBody, Badge, Spinner, Empty } from '@/components/ui'
import { clsx } from 'clsx'

type SortKey = 'item_no' | 'variance' | 'variance_pct'
type SortDir = 'asc' | 'desc'
type DecisionModal = { flagId: string; itemNo: string; decision: 'ACCEPTED' | 'REJECTED' } | null

export default function VariancePage() {
  const { id } = useParams<{ id: string }>()
  const [lines, setLines] = useState<ConsolidatedLine[]>([])
  const [flags, setFlags] = useState<VarianceFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'variance_pct', dir: 'desc' })
  const [modal, setModal] = useState<DecisionModal>(null)
  const [notes, setNotes] = useState('')
  const [deciding, setDeciding] = useState(false)

  const load = useCallback(async () => {
    const [l, f] = await Promise.all([varianceApi.getReport(id), varianceApi.getFlags(id)])
    setLines(l ?? [])
    setFlags(f ?? [])
  }, [id])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const pendingFlagByItem = Object.fromEntries(
    flags.filter(f => f.status === 'PENDING').map(f => [f.item_no, f])
  )
  const resolvedFlagByItem = Object.fromEntries(
    flags.filter(f => f.status !== 'PENDING').map(f => [f.item_no, f])
  )

  function toggleSelect(itemNo: string) {
    if (pendingFlagByItem[itemNo] || resolvedFlagByItem[itemNo]) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(itemNo) ? next.delete(itemNo) : next.add(itemNo)
      return next
    })
  }

  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 text-gray-300">
      {sort.key === col ? (sort.dir === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  )

  const filtered = lines
    .filter(l => !filter || l.item_no.toLowerCase().includes(filter.toLowerCase()) || l.description.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sort.key] as number | string
      const bVal = b[sort.key] as number | string
      const dir = sort.dir === 'asc' ? 1 : -1
      return aVal < bVal ? -dir : aVal > bVal ? dir : 0
    })

  async function flagSelected() {
    if (!selected.size) return
    setSubmitting(true)
    try {
      await varianceApi.flagItems(id, Array.from(selected))
      setSelected(new Set())
      await load()
    } finally { setSubmitting(false) }
  }

  async function submitDecision() {
    if (!modal) return
    setDeciding(true)
    try {
      await varianceApi.updateFlag(id, modal.flagId, modal.decision, notes)
      setModal(null)
      setNotes('')
      await load()
    } finally { setDeciding(false) }
  }

  function flagCell(itemNo: string) {
    const pending = pendingFlagByItem[itemNo]
    if (pending) {
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge color="yellow">Pending recount</Badge>
          <button onClick={() => setModal({ flagId: pending.id, itemNo, decision: 'ACCEPTED' })}
            className="text-xs text-green-600 hover:text-green-700 font-medium px-1.5 py-0.5 rounded hover:bg-green-50">Accept</button>
          <button onClick={() => setModal({ flagId: pending.id, itemNo, decision: 'REJECTED' })}
            className="text-xs text-red-600 hover:text-red-700 font-medium px-1.5 py-0.5 rounded hover:bg-red-50">Reject</button>
        </div>
      )
    }
    const resolved = resolvedFlagByItem[itemNo]
    if (resolved) return <Badge color={resolved.status === 'ACCEPTED' ? 'green' : 'gray'}>Recount {resolved.status.toLowerCase()}</Badge>
    return null
  }

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>

  const pendingCount = flags.filter(f => f.status === 'PENDING').length

  return (
    <div className="p-6 space-y-6">
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              {modal.decision === 'ACCEPTED' ? 'Accept recount result' : 'Reject recount'}
            </h2>
            <p className="text-sm text-gray-500">
              Item <span className="font-mono text-gray-700">{modal.itemNo}</span> —{' '}
              {modal.decision === 'ACCEPTED'
                ? 'Accept this recount as the final count.'
                : 'Reject the recount and return to counter for another round.'}
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Add any notes about this decision…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => { setModal(null); setNotes('') }}>Cancel</Button>
              <Button variant={modal.decision === 'ACCEPTED' ? 'primary' : 'danger'} onClick={submitDecision} loading={deciding}>
                {modal.decision === 'ACCEPTED' ? 'Accept' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Variance Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} item{filtered.length !== 1 ? 's' : ''} outside tolerance
            {pendingCount > 0 && <span className="ml-2 text-yellow-600 font-medium">· {pendingCount} pending review</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="search" placeholder="Search item…" value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          {selected.size > 0 && (
            <Button variant="danger" onClick={flagSelected} loading={submitting}>
              Flag {selected.size} for recount
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <Empty message={filter ? 'No matching items.' : 'No variance items — all counts within tolerance.'} />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none"
                    onClick={() => toggleSort('item_no')}>Item no.<SortIcon col="item_no" /></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Counted</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Theoretical</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none"
                    onClick={() => toggleSort('variance')}>Variance<SortIcon col="variance" /></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none"
                    onClick={() => toggleSort('variance_pct')}>Var %<SortIcon col="variance_pct" /></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(line => {
                  const isPending = !!pendingFlagByItem[line.item_no]
                  const isResolved = !!resolvedFlagByItem[line.item_no]
                  const isSelected = selected.has(line.item_no)
                  return (
                    <tr key={line.item_no} className={clsx('hover:bg-gray-50', isSelected && 'bg-red-50', isResolved && 'opacity-50')}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={isSelected} disabled={isPending || isResolved}
                          onChange={() => toggleSelect(line.item_no)}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
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
                      <td className="px-4 py-3 min-w-[220px]">{flagCell(line.item_no)}</td>
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
