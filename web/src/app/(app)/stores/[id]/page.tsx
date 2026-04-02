'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { stores } from '@/lib/api'
import type { Store, StoreLayout, Zone, Aisle, Bay } from '@/types'
import { Button, Card, CardBody, CardHeader, Spinner, Empty } from '@/components/ui'

export default function StoreLayoutPage() {
  const { id } = useParams<{ id: string }>()
  const [store, setStore] = useState<Store | null>(null)
  const [layout, setLayout] = useState<StoreLayout>({ zones: [], aisles: [], bays: [] })
  const [loading, setLoading] = useState(true)
  const [newZone, setNewZone] = useState({ zone_code: '', zone_name: '' })
  const [newAisle, setNewAisle] = useState({ zone_id: '', aisle_code: '', aisle_name: '' })
  const [newBin, setNewBin] = useState({ aisle_id: '', bay_code: '', bay_name: '' })
  const [saving, setSaving] = useState<'zone' | 'aisle' | 'bin' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([stores.get(id), stores.getLayout(id)])
      .then(([s, l]) => { setStore(s); setLayout(l) })
      .finally(() => setLoading(false))
  }, [id])

  async function addZone(e: React.FormEvent) {
    e.preventDefault()
    setSaving('zone')
    setError('')
    try {
      const zone = await stores.createZone(id, newZone)
      setLayout(l => ({ ...l, zones: [...(l.zones ?? []), zone] }))
      setNewZone({ zone_code: '', zone_name: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add zone')
    } finally { setSaving(null) }
  }

  async function addAisle(e: React.FormEvent) {
    e.preventDefault()
    setSaving('aisle')
    setError('')
    try {
      const aisle = await stores.createAisle(id, newAisle)
      setLayout(l => ({ ...l, aisles: [...(l.aisles ?? []), aisle] }))
      setNewAisle({ zone_id: '', aisle_code: '', aisle_name: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add aisle')
    } finally { setSaving(null) }
  }

  async function addBin(e: React.FormEvent) {
    e.preventDefault()
    setSaving('bin')
    setError('')
    try {
      const bin = await stores.createBay(id, newBin)
      setLayout(l => ({ ...l, bays: [...(l.bays ?? []), bin] }))
      setNewBin({ aisle_id: '', bay_code: '', bay_name: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add bin')
    } finally { setSaving(null) }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{store?.store_name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{store?.store_code} — LS: {store?.ls_store_code}</p>
        </div>
        <a href={stores.labelsUrl(id)} target="_blank" rel="noreferrer">
          <Button variant="secondary" size="sm">Download all labels</Button>
        </a>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Zones */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-700">Zones ({layout.zones?.length ?? 0})</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {layout.zones?.length === 0
              ? <Empty message="No zones yet." />
              : (
                <ul className="divide-y divide-gray-100">
                  {layout.zones.map((z: Zone) => (
                    <li key={z.id} className="py-2 flex justify-between text-sm">
                      <span className="font-medium text-gray-900">{z.zone_name}</span>
                      <span className="text-gray-400 font-mono text-xs">{z.zone_code}</span>
                    </li>
                  ))}
                </ul>
              )
            }
            <form onSubmit={addZone} className="flex gap-2 pt-2 border-t border-gray-100">
              <input value={newZone.zone_code} onChange={e => setNewZone(z => ({ ...z, zone_code: e.target.value }))}
                placeholder="Code" className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" required />
              <input value={newZone.zone_name} onChange={e => setNewZone(z => ({ ...z, zone_name: e.target.value }))}
                placeholder="Name" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" required />
              <Button type="submit" size="sm" loading={saving === 'zone'}>Add</Button>
            </form>
          </CardBody>
        </Card>

        {/* Aisles */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-700">Aisles ({layout.aisles?.length ?? 0})</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {layout.aisles?.length === 0
              ? <Empty message="No aisles yet." />
              : (
                <ul className="divide-y divide-gray-100">
                  {layout.aisles.map((a: Aisle) => (
                    <li key={a.id} className="py-2 flex justify-between text-sm">
                      <span className="font-medium text-gray-900">{a.aisle_name}</span>
                      <span className="text-gray-400 font-mono text-xs">{a.aisle_code}</span>
                    </li>
                  ))}
                </ul>
              )
            }
            <form onSubmit={addAisle} className="flex gap-2 pt-2 border-t border-gray-100">
              <select value={newAisle.zone_id} onChange={e => setNewAisle(a => ({ ...a, zone_id: e.target.value }))}
                className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" required>
                <option value="">Zone…</option>
                {layout.zones.map((z: Zone) => <option key={z.id} value={z.id}>{z.zone_name}</option>)}
              </select>
              <input value={newAisle.aisle_code} onChange={e => setNewAisle(a => ({ ...a, aisle_code: e.target.value }))}
                placeholder="Code" className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" required />
              <input value={newAisle.aisle_name} onChange={e => setNewAisle(a => ({ ...a, aisle_name: e.target.value }))}
                placeholder="Name" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" required />
              <Button type="submit" size="sm" loading={saving === 'aisle'}>Add</Button>
            </form>
          </CardBody>
        </Card>
      </div>

      {/* Bins */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Bins ({layout.bays?.length ?? 0})</h2>
            <Button size="sm" variant="secondary" onClick={() => window.open(`/stores/${id}/layout/import`, '_self')}>
              Import from CSV
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Add bin form */}
          <form onSubmit={addBin} className="flex gap-2 pb-4 border-b border-gray-100">
            <select value={newBin.aisle_id} onChange={e => setNewBin(b => ({ ...b, aisle_id: e.target.value }))}
              className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" required>
              <option value="">Aisle…</option>
              {layout.aisles.map((a: Aisle) => <option key={a.id} value={a.id}>{a.aisle_name}</option>)}
            </select>
            <input value={newBin.bay_code} onChange={e => setNewBin(b => ({ ...b, bay_code: e.target.value }))}
              placeholder="Bin code" className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" required />
            <input value={newBin.bay_name} onChange={e => setNewBin(b => ({ ...b, bay_name: e.target.value }))}
              placeholder="Bin name" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" required />
            <Button type="submit" size="sm" loading={saving === 'bin'}>Add bin</Button>
          </form>

          {layout.bays?.length === 0 ? (
            <Empty message="No bins yet. Add aisles first, then add bins or bulk import from CSV." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Bin code', 'Bin name', 'Barcode', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {layout.bays.map((bin: Bay) => (
                  <tr key={bin.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{bin.bay_code}</td>
                    <td className="px-4 py-2.5 text-gray-900">{bin.bay_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{bin.barcode}</td>
                    <td className="px-4 py-2.5">
                      <a href={stores.bayLabelUrl(id, bin.id)} target="_blank" rel="noreferrer"
                        className="text-teal-600 hover:text-teal-700 text-xs font-medium">Label</a>
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