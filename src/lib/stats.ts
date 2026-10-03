import { KEYS, type Book, type Key } from '../data/exercises'
import type { Entry, RoutineItem, TodayKeyMode } from './db'
import { addDays, dateKey, dayIndex } from './time'

export function secondsOn(entries: Entry[], day: string) {
  return entries.filter(e => e.date === day).reduce((a, e) => a + e.seconds, 0)
}

export function secondsByDay(entries: Entry[]) {
  const m = new Map<string, number>()
  for (const e of entries) m.set(e.date, (m.get(e.date) ?? 0) + e.seconds)
  return m
}

/** 오늘(또는 오늘 아직 안 쳤으면 어제)부터 거꾸로 이어진 연습일 수 */
export function streak(entries: Entry[]) {
  const days = new Set(entries.map(e => e.date))
  let d = new Date()
  if (!days.has(dateKey(d))) d = addDays(d, -1)
  let n = 0
  let start = d
  while (days.has(dateKey(d))) {
    n++
    start = d
    d = addDays(d, -1)
  }
  return { days: n, since: n ? start : null }
}

export interface KeyStat {
  best: number
  last?: string
}

export interface ExerciseStat {
  no: number
  best: number // 전 조 중 최고 클린 BPM
  last?: string
  keys: Partial<Record<Key, KeyStat>>
  variations: Record<string, { best: number; keys: Set<string>; last: string }>
  seconds: number
}

export function exerciseStats(entries: Entry[], book: Book) {
  const out = new Map<number, ExerciseStat>()
  for (const e of entries) {
    if (e.refType !== book) continue
    let s = out.get(e.refNo)
    if (!s) {
      s = { no: e.refNo, best: 0, keys: {}, variations: {}, seconds: 0 }
      out.set(e.refNo, s)
    }
    s.best = Math.max(s.best, e.cleanBpm)
    s.seconds += e.seconds
    if (!s.last || e.date > s.last) s.last = e.date
    if (e.key) {
      const k = (s.keys[e.key] ??= { best: 0 })
      k.best = Math.max(k.best, e.cleanBpm)
      if (!k.last || e.date > k.last) k.last = e.date
    }
    for (const v of e.variations) {
      const vs = (s.variations[v] ??= { best: 0, keys: new Set(), last: e.date })
      vs.best = Math.max(vs.best, e.cleanBpm)
      if (e.key) vs.keys.add(e.key)
      if (e.date > vs.last) vs.last = e.date
    }
  }
  return out
}

export function coverage(s: ExerciseStat | undefined) {
  return s ? Object.keys(s.keys).length : 0
}

/** 오늘의 조: 5도권 하루 한 조 순환, 또는 하농 전체에서 가장 오래 안 친 조 */
export function todayKey(mode: TodayKeyMode, entries: Entry[], date = new Date()): Key {
  if (mode === 'cycle') return KEYS[dayIndex(date) % 12]
  const last = new Map<Key, string>()
  for (const e of entries) {
    if (e.refType !== 'hanon' || !e.key) continue
    const p = last.get(e.key)
    if (!p || e.date > p) last.set(e.key, e.date)
  }
  let pick: Key = KEYS[0]
  let oldest = '9999'
  for (const k of KEYS) {
    const d = last.get(k) ?? '0000'
    if (d < oldest) {
      oldest = d
      pick = k
    }
  }
  return pick
}

export function nextKeyLabel(mode: TodayKeyMode) {
  return mode === 'cycle' ? `5도권 순환 · 내일 ${KEYS[(dayIndex() + 1) % 12]}` : '가장 오래 안 친 조'
}

// ── 루틴 ──

export function routineNumbers(item: RoutineItem) {
  if (item.refType === 'free') return []
  const out: number[] = []
  for (let n = item.from; n <= item.to; n++) out.push(n)
  return out
}

export function routineLabel(item: RoutineItem, key?: Key) {
  if (item.refType === 'free') return item.title
  const name = item.refType === 'hanon' ? '하농' : '피쉬나'
  const range = item.from === item.to ? `${item.from}` : `${item.from}–${item.to}`
  return item.refType === 'hanon' && key ? `${name} ${range} · ${key}` : `${name} ${range}`
}

export interface RoutineProgress {
  item: RoutineItem
  done: number // 오늘 친 번호 수
  total: number
  seconds: number
  status: 'done' | 'prog' | 'pend'
  nextNo: number | null // 다음에 칠 번호
}

export function routineProgress(item: RoutineItem, todayEntries: Entry[]): RoutineProgress {
  if (item.refType === 'free') {
    const mine = todayEntries.filter(e => e.refType === 'free' && e.title === item.title)
    const seconds = mine.reduce((a, e) => a + e.seconds, 0)
    const status = seconds >= item.minutes * 60 ? 'done' : seconds > 0 ? 'prog' : 'pend'
    return { item, done: mine.length ? 1 : 0, total: 1, seconds, status, nextNo: null }
  }
  const nums = routineNumbers(item)
  const mine = todayEntries.filter(e => e.refType === item.refType && nums.includes(e.refNo))
  const doneSet = new Set(mine.map(e => e.refNo))
  const seconds = mine.reduce((a, e) => a + e.seconds, 0)
  const done = doneSet.size
  const nextNo = nums.find(n => !doneSet.has(n)) ?? null
  const status = done >= nums.length ? 'done' : done > 0 ? 'prog' : 'pend'
  return { item, done, total: nums.length, seconds, status, nextNo }
}

/** 최근 n주 주별 최고 BPM (클린 / 도달) */
export function weeklyBest(entries: Entry[], weeks = 8) {
  const today = new Date()
  const start = addDays(today, -(weeks * 7 - 1))
  const out = Array.from({ length: weeks }, (_, i) => {
    const from = addDays(start, i * 7)
    return { label: `${from.getMonth() + 1}/${from.getDate()}`, from: dateKey(from), to: dateKey(addDays(from, 6)), clean: 0, reach: 0 }
  })
  for (const e of entries) {
    const w = out.find(w => e.date >= w.from && e.date <= w.to)
    if (!w) continue
    w.clean = Math.max(w.clean, e.cleanBpm)
    w.reach = Math.max(w.reach, e.bpm)
  }
  return out
}
