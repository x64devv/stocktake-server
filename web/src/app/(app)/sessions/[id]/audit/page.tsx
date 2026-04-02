'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { variance as varianceApi } from '@/lib/api'
import type { AuditLine } from '@/types'
import { Card, CardBody, Spinner, Empty } from '@/components/ui'

export default function AuditPage() {
  const { id } = useParams<{ id: string }>()
  const [lines, setLines] = useState<AuditLine[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    varianceApi.getAudit(id).then(setLines).finally(() => setLoading(false))
  }, [id])

  const filtered = filter
    ? lines.filter(l =>
        l.item_no.toLowerCase().includes(filter.toLowerCase()) ||
        l.description.toLowerCase().includes(filter.toLowerCase()),
      )
    : lines

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit View</h1>
          <p className="text-sm text-gray-500 mt-0.5">All individual count lines with counter identity and timestamp</p>
        </div>
        <input
          type="search"
          placeholder="Search item…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <Card>
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <Empty message={filter ? 'No matching items.' : 'No count lines yet.'} />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Item no.', 'Description', 'Bin', 'Counter', 'Qty', 'Round', 'Counted at'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((line, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{line.item_no}</td>
                    <td className="px-4 py-2.5 text-gray-900">{line.description}</td>
                    <td className="px-4 py-2.5 text-gray-600">{line.bay_code}</td>
                    <td className="px-4 py-2.5 text-gray-600">{line.counter_name}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">{line.quantity}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{line.round_no === 0 ? 'Original' : `Recount ${line.round_no}`}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(line.counted_at).toLocaleString()}</td>
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
