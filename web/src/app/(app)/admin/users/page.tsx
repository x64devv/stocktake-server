'use client'

import { useEffect, useState } from 'react'
import { adminUsers } from '@/lib/api'
import type { AdminUser } from '@/types'
import { Button, Card, CardBody, CardHeader, Badge, Spinner, Empty } from '@/components/ui'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [form, setForm] = useState({ username: '', full_name: '', password: '' })

  useEffect(() => {
    adminUsers.list().then(setUsers).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const user = await adminUsers.create(form)
      setUsers(prev => [user, ...prev])
      setForm({ username: '', full_name: '', password: '' })
      setShowForm(false)
      setSuccess(`Admin user "${user.username}" created.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(user: AdminUser) {
    setError('')
    setSuccess('')
    try {
      await adminUsers.deactivate(user.id)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: false } : u))
      setSuccess(`${user.full_name} deactivated.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate user')
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await adminUsers.resetPassword(resetTarget.id, newPassword)
      setResetTarget(null)
      setNewPassword('')
      setSuccess(`Password reset for ${resetTarget.full_name}.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="p-6 space-y-6">
      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Reset password</h2>
            <p className="text-sm text-gray-500">
              Set a new password for <span className="font-medium text-gray-700">{resetTarget.full_name}</span>.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password"
                minLength={8}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="secondary" type="button" onClick={() => { setResetTarget(null); setNewPassword('') }}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>Reset password</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Admin users</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage portal access for stock controllers and managers</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : 'New admin user'}
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
      {success && <div className="bg-teal-50 border border-teal-200 text-teal-700 text-sm px-4 py-3 rounded-lg">{success}</div>}

      {showForm && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-gray-700">New admin user</h2></CardHeader>
          <CardBody>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
                  <input
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                  <input
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" loading={saving}>Create admin user</Button>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="p-0">
          {users.length === 0 ? (
            <Empty message="No admin users yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Username', 'Status', 'Created', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{user.full_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{user.username}</td>
                    <td className="px-4 py-3">
                      <Badge color={user.active ? 'green' : 'gray'}>{user.active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{user.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => setResetTarget(user)}
                          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                        >
                          Reset password
                        </button>
                        {user.active && (
                          <button
                            onClick={() => handleDeactivate(user)}
                            className="text-xs text-red-500 hover:text-red-600 font-medium"
                          >
                            Deactivate
                          </button>
                        )}
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
