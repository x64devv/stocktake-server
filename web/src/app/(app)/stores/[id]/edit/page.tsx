'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { stores } from '@/lib/api'
import type { Store } from '@/types'
import { Button, Card, CardBody, CardHeader, Spinner } from '@/components/ui'

export default function StoreEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    store_name: '',
    store_code: '',
    ls_store_code: '',
    active: true,
  })

  useEffect(() => {
    stores.get(id).then((s: Store) => {
      setForm({
        store_name: s.store_name,
        store_code: s.store_code,
        ls_store_code: s.ls_store_code,
        active: s.active,
      })
    }).catch(() => setError('Failed to load store'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await stores.update(id, form)
      router.push(`/stores/${id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="p-6 max-w-lg space-y-6">
      <div>
        <p className="text-xs text-gray-400 mb-1">
          <Link href="/stores" className="hover:text-teal-600">Stores</Link>
          {' / '}
          <Link href={`/stores/${id}`} className="hover:text-teal-600">{form.store_name || id}</Link>
          {' / Edit'}
        </p>
        <h1 className="text-xl font-semibold text-gray-900">Edit store</h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700">Store details</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Store name</label>
              <input
                value={form.store_name}
                onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Store code</label>
              <input
                value={form.store_code}
                onChange={e => setForm(f => ({ ...f, store_code: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Internal short code used in reports</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">LS store code</label>
              <input
                value={form.ls_store_code}
                onChange={e => setForm(f => ({ ...f, ls_store_code: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Must match the store code in LS Commerce Service</p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="active" className="text-sm text-gray-700">Store is active</label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={saving}>Save changes</Button>
              <Button type="button" variant="secondary" onClick={() => router.push(`/stores/${id}`)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
