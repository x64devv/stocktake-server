'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { variance as varianceApi } from '@/lib/api'
import { exportToExcel } from '@/lib/exportExcel'
import type { ConsolidatedLine, VarianceFlag } from '@/types'
import { Button, Card, CardBody, Badge, Spinner, Empty } from '@/components/ui'
import { clsx } from 'clsx'

type SortKey = 'item_no' | 'variance' | 'variance_pct' | 'variance_cost'
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
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'variance_cost', dir: 'desc' })
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
    .filter(l => !filter ||
      l.item_no.toLowerCase().includes(filter.toLowerCase()) ||
      l.description.toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sort.key] as number | string
      const bVal = b[sort.key] as number | string
      const dir = sort.dir === 'asc' ? 1 : -1
      return aVal < bVal ? -dir : aVal > bVal ? dir : 0
    })

  async function flagSelected() {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      await varianceApi.flagItems(id, Array.from(selected))
      setSelected(new Set())
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function decide(flagId: string, itemNo: string, decision: 'ACCEPTED' | 'REJECTED') {
    setModal({ flagId, itemNo, decision })
    setNotes('')
  }

  async function confirmDecision() {
    if (!modal) return
    setDeciding(true)
    try {
      await varianceApi.updateFlag(id, modal.flagId, modal.decision, notes)
      setModal(null)
      await load()
    } finally {
      setDeciding(false)
    }
  }

  function handleExport() {
    const rows = filtered.map(l => ({
      'Item No.': l.item_no,
      'Description': l.description,
      'Counted Qty': l.counted_qty,
      'Theoretical Qty': l.theoretical_qty,
      'Variance Qty': l.variance,
      'Variance %': l.variance_pct,
      'Unit Cost': l.unit_cost,
      'Variance Cost': l.variance_cost,
      'Flagged': l.flagged ? 'Yes' : 'No',
    }))
    exportToExcel(rows, 'Variance Report', `variance-report-session-${id}`)
  }

  // Total variance cost summary
  const totalVarianceCost = filtered.reduce((sum, l) => sum + l.variance_cost, 0)

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Variance Report</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button size="sm" loading={submitting} onClick={flagSelected}>
              Flag {selected.size} item{selected.size > 1 ? 's' : ''} for recount
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={handleExport}>Export</Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-gray-500">Items over tolerance</p>
            <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-gray-500">Pending recount</p>
            <p className="text-2xl font-bold text-amber-600">
              {flags.filter(f => f.status === 'PENDING').length}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <p className="text-xs text-gray-500">Total variance cost</p>
            <p className={clsx('text-2xl font-bold', totalVarianceCost < 0 ? 'text-red-600' : 'text-green-600')}>
              {totalVarianceCost.toLocaleString('en-ZW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <div className="mb-3">
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by item no. or description…"
              className="w-full max-w-sm px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {filtered.length === 0 ? (
            <Empty message="No items outside variance tolerance." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-2 pr-3 w-8"></th>
                    <th className="pb-2 pr-4">Item No.</th>
                    <th className="pb-2 pr-4">Description</th>
                    <th className="pb-2 pr-4 text-right">Counted</th>
                    <th className="pb-2 pr-4 text-right">Theoretical</th>
                    <th
                      className="pb-2 pr-4 text-right cursor-pointer select-none"
                      onClick={() => toggleSort('variance')}
                    >
                      Variance Qty <SortIcon col="variance" />
                    </th>
                    <th
                      className="pb-2 pr-4 text-right cursor-pointer select-none"
                      onClick={() => toggleSort('variance_pct')}
                    >
                      Variance % <SortIcon col="variance_pct" />
                    </th>
                    <th className="pb-2 pr-4 text-right">Unit Cost</th>
                    <th
                      className="pb-2 pr-4 text-right cursor-pointer select-none"
                      onClick={() => toggleSort('variance_cost')}
                    >
                      Variance Cost <SortIcon col="variance_cost" />
                    </th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const pendingFlag = pendingFlagByItem[l.item_no]
                    const resolvedFlag = resolvedFlagByItem[l.item_no]
                    const isSelected = selected.has(l.item_no)

                    return (
                      <tr
                        key={l.item_no}
                        onClick={() => toggleSelect(l.item_no)}
                        className={clsx(
                          'border-b border-gray-50 transition-colors',
                          !pendingFlag && !resolvedFlag && 'cursor-pointer hover:bg-gray-50',
                          isSelected && 'bg-teal-50',
                        )}
                      >
                        <td className="py-2 pr-3">
                          {!pendingFlag && !resolvedFlag && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(l.item_no)}
                              className="accent-teal-600"
                            />
                          )}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">{l.item_no}</td>
                        <td className="py-2 pr-4 text-gray-700">{l.description}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{l.counted_qty.toFixed(2)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{l.theoretical_qty.toFixed(2)}</td>
                        <td className={clsx('py-2 pr-4 text-right tabular-nums font-medium',
                          l.variance < 0 ? 'text-red-600' : 'text-green-600')}>
                          {l.variance.toFixed(2)}
                        </td>
                        <td className={clsx('py-2 pr-4 text-right tabular-nums font-medium',
                          l.variance_pct < 0 ? 'text-red-600' : 'text-green-600')}>
                          {l.variance_pct.toFixed(2)}%
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-500">
                          {l.unit_cost.toFixed(2)}
                        </td>
                        <td className={clsx('py-2 pr-4 text-right tabular-nums font-semibold',
                          l.variance_cost < 0 ? 'text-red-600' : 'text-green-600')}>
                          {l.variance_cost.toLocaleString('en-ZW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2">
                          {pendingFlag ? (
                            <div className="flex gap-1">
                              <button
                                onClick={e => { e.stopPropagation(); decide(pendingFlag.id, l.item_no, 'ACCEPTED') }}
                                className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200"
                              >
                                Accept
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); decide(pendingFlag.id, l.item_no, 'REJECTED') }}
                                className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                              >
                                Reject
                              </button>
                            </div>
                          ) : resolvedFlag ? (
                            <Badge color={resolvedFlag.status === 'ACCEPTED' ? 'green' : 'red'}>
                              {resolvedFlag.status}
                            </Badge>
                          ) : (
                            <Badge color="gray">Unflagged</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Decision modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {modal.decision === 'ACCEPTED' ? 'Accept' : 'Reject'} recount — {modal.itemNo}
            </h2>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                size="sm"
                variant={modal.decision === 'ACCEPTED' ? 'primary' : 'danger'}
                loading={deciding}
                onClick={confirmDecision}
              >
                Confirm {modal.decision === 'ACCEPTED' ? 'Accept' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}