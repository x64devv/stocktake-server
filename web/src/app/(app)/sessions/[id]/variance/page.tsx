'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { variance as varianceApi } from '@/lib/api'
import type { ConsolidatedLine } from '@/types'
import { Button, Card, CardBody, Badge, Spinner, Empty } from '@/components/ui'
import { clsx } from 'clsx'

export default function VariancePage() {
  const { id } = useParams<{ id: string }>()
  const [lines, setLines] = useState<ConsolidatedLine[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    varianceApi.getReport(id).then(setLines).finally(() => setLoading(false))
  }, [id])

  function toggleSelect(itemNo: string) {
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
      setLines(prev => (prev?? []).map(l => selected.has(l.item_no) ? { ...l, flagged: true } : l))
      setSelected(new Set())
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Variance Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">{lines.length} item{lines.length !== 1 ? 's' : ''} outside tolerance</p>
        </div>
        {selected.size > 0 && (
          <Button variant="danger" onClick={flagSelected} loading={submitting}>
            Flag {selected.size} for recount
          </Button>
        )}
      </div>

      <Card>
        <CardBody className="p-0">
          {(lines?? []).length === 0 ? (
            <Empty message="No variance items — all counts within tolerance." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  {['Item no.', 'Description', 'Counted', 'Theoretical', 'Variance', 'Var %', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(lines?? []).map(line => (
                  <tr key={line.item_no} className={clsx('hover:bg-gray-50', selected.has(line.item_no) && 'bg-red-50', line.flagged && 'opacity-60')}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(line.item_no)}
                        disabled={line.flagged}
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
                    <td className="px-4 py-3">
                      {line.flagged && <Badge color="yellow">Pending recount</Badge>}
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
