import Dexie, { type EntityTable } from 'dexie'
import type { Book, Hand, Key, ScaleSet } from '../data/exercises'

/** 기록 종류: 기초(하농·피쉬나·스케일) / 자유 / 레퍼토리 구간 / 런스루 */
export type RefType = Book | 'free' | 'section' | 'run'
/** 루틴 항목 종류: 'rep' = 레퍼토리 오늘 할 구간 */
export type RoutineType = Book | 'free' | 'rep'

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
  refNo: number // 하농 번호, 피쉬나 번호×10+a/b, 스케일 종류×100+조, 구간 id, 런스루는 곡 id, 자유 연습은 0
  title: string // 자유 연습 제목 또는 표시용 이름
  key?: Key
  seconds: number
  bpm: number // 도달 BPM
  cleanBpm: number // 클린 BPM
  hands: Hand
  variations: string[]
  rating: number // 0–5
  memo: string
  // 레퍼토리 구간 연습
  pieceId?: number
  attempts?: number
  successes?: number
  grade?: Grade
}

export interface RoutineItem {
  id?: number
  order: number
  refType: RoutineType
  from: number // 하농·피쉬나 시작 번호 · 스케일은 0 = 오늘의 조, 1 = 저장한 5도권 묶음
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

// ── 레퍼토리 ──

export interface RepList {
  id?: number
  name: string
  color: string
  order: number
}

export interface Piece {
  id?: number
  title: string
  composer: string
  opus: string
  memo: string
  listIds: number[]
  archived: 0 | 1
  createdAt: number
  scoreId?: number | null
}

/** 구간 단계: 악보 읽기 → 운지 확정 → 느린 템포 → 템포 업 → 암보 → 연주 완성 */
export type Grade = 'bad' | 'unsure' | 'good'

export interface Section {
  id?: number
  pieceId: number
  order: number
  label: string // m.33–48
  note: string
  stage: number // 0–5
  bpm: number // 지금 사다리 BPM
  targetBpm: number
  ladderStart: number
  streakGoal: number // 연속 성공 기준
  weak: boolean
  page?: number // 악보 PDF 페이지
  intervalDays: number // 간격 반복 간격
  dueDate: string // 다음 복습일 YYYY-MM-DD
  lastGrade?: Grade
  lastPracticed?: string
}

export interface RunMark {
  atSec: number
  page?: number
  sectionId?: number | null // null = 해당 없음
}

export interface RunThrough {
  id?: number
  pieceId: number
  date: string
  createdAt: number
  durationSec: number
  recordingId?: number
  marks: RunMark[]
  reviewed: boolean
}

export interface Recording {
  id?: number
  blob: Blob
  createdAt: number
}

export interface DDay {
  id?: number
  title: string
  date: string
  pinned: boolean
  pieceIds: number[]
}

export interface LessonItem {
  id: string
  text: string
  pieceId?: number
  sectionId?: number
  resolved: boolean
}

export interface Lesson {
  id?: number
  date: string
  items: LessonItem[]
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
  lists: EntityTable<RepList, 'id'>
  pieces: EntityTable<Piece, 'id'>
  sections: EntityTable<Section, 'id'>
  runs: EntityTable<RunThrough, 'id'>
  recordings: EntityTable<Recording, 'id'>
  ddays: EntityTable<DDay, 'id'>
  lessons: EntityTable<Lesson, 'id'>
}

db.version(1).stores({
  sessions: '++id, date',
  entries: '++id, sessionId, date, [refType+refNo], createdAt',
  routine: '++id, order',
  scores: '++id, createdAt',
  settings: 'key'
})

db.version(2).stores({
  lists: '++id, order',
  pieces: '++id, *listIds, archived, createdAt',
  sections: '++id, pieceId, dueDate',
  runs: '++id, pieceId, date',
  recordings: '++id',
  ddays: '++id, date',
  lessons: '++id, date'
})

// ── 설정 ──

/** 오늘의 조: 5도권 순환 / 오래 안 친 조 / 직접 고른 조 */
export type TodayKeyMode = 'cycle' | 'stale' | 'fixed'
export type Theme = 'system' | 'dark' | 'light'

export interface BookMap {
  scoreId: number | null
  pages: Record<number, number> // 번호 → PDF 페이지
}

export interface Settings {
  dailyGoalMin: number
  todayKeyMode: TodayKeyMode
  fixedKey: Key // '직접 고르기'일 때의 조
  keyOverride: { date: string; key: Key } | null // 오늘만 바꾼 조
  theme: Theme
  ladderStep: number
  hanonBook: BookMap
  pischnaBook: BookMap
  pischnaSplits: number[] // a·b로 나뉜 피쉬나 번호
  dailyReviewMax: number // 하루 복습 구간 상한
  scaleSet: ScaleSet // 저장한 5도권 묶음
}

export const DEFAULT_SETTINGS: Settings = {
  dailyGoalMin: 180,
  todayKeyMode: 'cycle',
  fixedKey: 'C',
  keyOverride: null,
  theme: 'system',
  ladderStep: 4,
  hanonBook: { scoreId: null, pages: {} },
  pischnaBook: { scoreId: null, pages: {} },
  // Schirmer 판(Library of Musical Classics Vol. 792, Wolff·Riemann 편집)에서 a·b로 나뉜 번호
  pischnaSplits: [1, 2, 5, 6, 15, 16, 20],
  dailyReviewMax: 6,
  scaleSet: { keys: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], start: 0, dir: 'cw', kinds: ['ms', 'ma', 'ns', 'na'] }
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
