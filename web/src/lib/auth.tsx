'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { auth } from './api'

interface AuthContext {
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthContext | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Read token from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const t = localStorage.getItem('st_token')
    setToken(t)
    if (!t && pathname !== '/login') {
      router.replace('/login')
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await auth.login(username, password)
    localStorage.setItem('st_token', res.token)
    setToken(res.token)
    router.push('/dashboard')
  }, [router])

  const logout = useCallback(() => {
    localStorage.removeItem('st_token')
    setToken(null)
    router.push('/login')
  }, [router])

  return <Ctx.Provider value={{ token, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}