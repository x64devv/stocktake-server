'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { WSEvent } from '@/types'

function getWSBase(): string {
  if (typeof window === 'undefined') return ''
  // WebSocket uses same host as the page, just swap protocol
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}`
}

export function useSessionSocket(sessionId: string | null) {
  const [events, setEvents] = useState<WSEvent[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (!sessionId) return
    const token = localStorage.getItem('st_token')
    const url = `${getWSBase()}/ws/sessions/${sessionId}?token=${token}`
    const ws = new WebSocket(url)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      reconnectRef.current = setTimeout(connect, 3000)
    }
    ws.onmessage = (e) => {
      try {
        const event: WSEvent = JSON.parse(e.data)
        setEvents((prev) => [event, ...prev].slice(0, 200))
      } catch {}
    }
    wsRef.current = ws
  }, [sessionId])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const clearEvents = useCallback(() => setEvents([]), [])

  return { events, connected, clearEvents }
}
