'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { stores } from '@/lib/api'
import { Button, Card, CardBody, CardHeader } from '@/components/ui'

export default function NewStorePage() {
  const router = useRouter()
  const [form, setForm] = useState({ store_name: '', store_code: '', ls_store_code: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const store = await stores.create(form)
      router.push(`/stores/${store.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create store')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Add store</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a new store record</p>
      </div>
      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-gray-700">Store details</h2></CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { field: 'store_name', label: 'Store name', placeholder: 'e.g. Spar Borrowdale' },
              { field: 'store_code', label: 'Store code', placeholder: 'e.g. BORROW01' },
              { field: 'ls_store_code', label: 'LS store code', placeholder: 'Matching code in LS Retail' },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type="text"
                  value={(form as Record<string, string>)[field]}
                  onChange={e => set(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading}>Save store</Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
