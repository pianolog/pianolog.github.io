import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS, loadSettings, type Entry, type RoutineItem, type Settings } from './db'

const EMPTY: Entry[] = []

export function useSettings(): Settings {
  return useLiveQuery(loadSettings, [], DEFAULT_SETTINGS)
}

export function useEntries(): Entry[] {
  return useLiveQuery(() => db.entries.orderBy('createdAt').toArray(), [], EMPTY)
}

export function useRoutine(): RoutineItem[] {
  return useLiveQuery(() => db.routine.orderBy('order').toArray(), [], [] as RoutineItem[])
}

/** 1초마다 다시 그리기 (타이머 표시용) */
export function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

/** 연습 중 화면 꺼짐 방지 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release()
      } catch {
        /* 배터리 절약 모드 등에서는 거부될 수 있음 */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}

/** 시스템/다크/라이트 테마를 <html data-theme>에 반영 */
export function useThemeAttr(theme: Settings['theme']) {
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])
}
