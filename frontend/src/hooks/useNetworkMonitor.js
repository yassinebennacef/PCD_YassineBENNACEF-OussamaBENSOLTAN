import { useEffect, useRef } from 'react'
import { contextApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

/**
 * Periodically measures download speed + latency and reports to the backend.
 * Used by the recommendation engine to avoid suggesting heavy resources
 * when bandwidth is low.
 */
export function useNetworkMonitor(intervalMs = 60_000) {
  const { user } = useAuth()
  const timerRef = useRef(null)

  const measure = async () => {
    if (!user) return
    try {
      const start = performance.now()
      // Fetch a tiny probe file (1 KB) served by the Django dev server
      const token = localStorage.getItem('access_token')
      const res = await fetch('/api/resources/recent/', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const latency_ms = performance.now() - start

      // Rough download estimate using Navigation Timing API
      const nav = performance.getEntriesByType('navigation')[0]
      const download_kbps = nav
        ? Math.round((nav.transferSize / 1024) / (nav.duration / 1000))
        : 0

      await contextApi.logNetwork({
        download_kbps: download_kbps || 0,
        latency_ms: Math.round(latency_ms),
        location_hint: 'campus',
      })
    } catch {
      // Silent — network monitoring is non-critical
    }
  }

  useEffect(() => {
    if (!user) return
    measure()
    timerRef.current = setInterval(measure, intervalMs)
    return () => clearInterval(timerRef.current)
  }, [user])
}
