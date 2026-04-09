'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { stores } from '@/lib/api'
import type { Store } from '@/types'
import { Button, Card, CardBody, Badge, Spinner, Empty } from '@/components/ui'

export default function StoresPage() {
  const [list, setList] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    stores.list().then(setList).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Stores</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage stores and store layouts</p>
        </div>
        <Link href="/stores/new">
          <Button>Add store</Button>
        </Link>
      </div>

      <Card>
        <CardBody className="p-0">
          {list.length === 0 ? (
            <Empty message="No stores yet. Add your first store to get started." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Store name', 'Store code', 'LS code', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.map(store => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{store.store_name}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{store.store_code}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{store.ls_store_code}</td>
                    <td className="px-4 py-3">
                      <Badge color={store.active ? 'green' : 'gray'}>{store.active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 justify-end">
                        <Link href={`/stores/${store.id}`} className="text-teal-600 hover:text-teal-700 font-medium text-xs">
                          Layout
                        </Link>
                        <Link href={`/stores/${store.id}/edit`} className="text-gray-500 hover:text-gray-700 font-medium text-xs">
                          Edit
                        </Link>
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
