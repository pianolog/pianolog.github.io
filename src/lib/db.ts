import Dexie, { type EntityTable } from 'dexie'
import type { Book, Hand, Key } from '../data/exercises'

export type RefType = Book | 'free'

export interface Session {
  id?: number
  date: string // YYYY-MM-DD (로컬)
  startedAt: number
  endedAt: number
}

export interface Entry {
  id?: number
  sessionId: number
  date: string
  createdAt: number
  refType: RefType
  refNo: number // 하농 번호, 피쉬나 번호×10+a/b, 스케일 종류×100+조, 자유 연습은 0
  title: string // 자유 연습 제목 또는 표시용 이름
  key?: Key
  seconds: number
  bpm: number // 도달 BPM
  cleanBpm: number // 클린 BPM
  hands: Hand
  variations: string[]
  rating: number // 0–5
  memo: string
}

export interface RoutineItem {
  id?: number
  order: number
  refType: RefType
  from: number // 하농·피쉬나 시작 번호 (스케일은 오늘의 조라서 안 씀)
  to: number // 끝 번호 (단일이면 from과 같음)
  title: string // 자유 항목 제목
  minutes: number
}

export interface Score {
  id?: number
  name: string
  blob: Blob
  pageCount: number
  createdAt: number
  bookmarks: { page: number; label: string }[]
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('piano-practice') as Dexie & {
  sessions: EntityTable<Session, 'id'>
  entries: EntityTable<Entry, 'id'>
  routine: EntityTable<RoutineItem, 'id'>
  scores: EntityTable<Score, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  sessions: '++id, date',
  entries: '++id, sessionId, date, [refType+refNo], createdAt',
  routine: '++id, order',
  scores: '++id, createdAt',
  settings: 'key'
})

// ── 설정 ──

export type TodayKeyMode = 'cycle' | 'stale'
export type Theme = 'system' | 'dark' | 'light'

export interface BookMap {
  scoreId: number | null
  pages: Record<number, number> // 번호 → PDF 페이지
}

export interface Settings {
  dailyGoalMin: number
  todayKeyMode: TodayKeyMode
  theme: Theme
  ladderStep: number
  hanonBook: BookMap
  pischnaBook: BookMap
  pischnaSplits: number[] // a·b로 나뉜 피쉬나 번호
}

export const DEFAULT_SETTINGS: Settings = {
  dailyGoalMin: 180,
  todayKeyMode: 'cycle',
  theme: 'system',
  ladderStep: 4,
  hanonBook: { scoreId: null, pages: {} },
  pischnaBook: { scoreId: null, pages: {} },
  pischnaSplits: []
}

export async function loadSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value
  return out as unknown as Settings
}

export function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  return db.settings.put({ key, value })
}
