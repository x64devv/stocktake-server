'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { sessions, stores } from '@/lib/api'
import type { Session, Store } from '@/types'
import { Card, CardBody, CardHeader, StatCard, StatusBadge, Spinner, Empty } from '@/components/ui'

export default function DashboardPage() {
  const [activeSessions, setActiveSessions] = useState<Session[]>([])
  const [allStores, setAllStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([sessions.list(), stores.list()])
      .then(([sess, st]) => {
        setActiveSessions(sess.filter(s => s.status === 'ACTIVE' || s.status === 'PENDING_REVIEW'))
        setAllStores(st)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of active stock takes</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active stock takes" value={activeSessions.length} />
        <StatCard label="Total stores" value={allStores.length} />
        <StatCard label="Pending review" value={activeSessions.filter(s => s.status === 'PENDING_REVIEW').length} />
        <StatCard label="Stores active" value={activeSessions.length} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700">Active stock takes</h2>
        </CardHeader>
        <CardBody className="p-0">
          {activeSessions.length === 0 ? (
            <Empty message="No active stock takes" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Store', 'Date', 'Type', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeSessions.map(sess => (
                  <tr key={sess.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {allStores.find(s => s.id === sess.store_id)?.store_name ?? sess.store_id}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{sess.session_date}</td>
                    <td className="px-4 py-3 text-gray-600">{sess.type}</td>
                    <td className="px-4 py-3"><StatusBadge status={sess.status} /></td>
                    <td className="px-4 py-3">
                      <Link href={`/sessions/${sess.id}`} className="text-teal-600 hover:text-teal-700 font-medium text-xs">
                        View →
                      </Link>
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
