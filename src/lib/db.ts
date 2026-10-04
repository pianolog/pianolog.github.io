import Dexie, { type EntityTable } from 'dexie'
import { SCALE_KINDS, type Book, type CircleMode, type Hand, type Key, type ScaleSet } from '../data/exercises'
import { migrateGrade, migrateSectionSrs, type Rating, type Srs } from './srs'

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
  grade?: Rating // 간격 복습 평가 (구간·기초)
  attemptLog?: Attempt[] // 구간 연습: 한 번 칠 때마다 (손·마디·성공)
  srsKind?: 'new' | 'learn' | 'review' // 평가할 때의 상태 — 기억률 계산에 씀
}

export interface RoutineItem {
  id?: number
  order: number
  refType: RoutineType
  from: number // 하농·피쉬나 시작 번호 · 스케일은 0 = 오늘의 조, 1 = 5도권 묶음(스케일), 2 = 5도권 묶음(아르페지오)
  to: number // 끝 번호 (단일이면 from과 같음)
  title: string // 자유 항목 제목
  minutes: number
  srs?: boolean // 하농·피쉬나·스케일: 범위 대신 간격 복습으로 오늘 할 것
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
  catalog?: { composer: string; title: string } // 곡 목록에서 고른 원래 이름 (IMSLP 검색에 씀)
}

/** 구간 연습에서 친 손: 양손 / 오른손 / 왼손 */
export type HandKey = 'B' | 'R' | 'L'

/** 구간을 한 번 친 기록 */
export interface Attempt {
  h: HandKey
  a: number // 시작 마디 (구간 이름에서 마디를 못 읽으면 0)
  b: number // 끝 마디
  ok: boolean
  bpm: number
  w?: string[] // 연습 방법 (암보, 리듬 변형 …)
}

/** 구간 단계: 악보 읽기 → 운지 확정 → 느린 템포 → 템포 업 → 암보 → 연주 완성 */

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
  srs: Srs // 간격 복습
  reach?: Partial<Record<HandKey, number>> // 손마다 구간 처음부터 이어서 성공한 마지막 마디
}

/** 기초 카드: 하농 번호×조 / 피쉬나 번호 / 스케일·아르페지오 조 */
export interface Card {
  id: string // cardId()
  book: Book
  no: number
  key?: Key // 하농만
  srs: Srs
}

export const cardId = (book: Book, no: number, key?: Key) => (book === 'hanon' ? `hanon:${no}:${key}` : `${book}:${no}`)

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
  cards: EntityTable<Card, 'id'>
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

// 3: Anki 방식 간격 복습 — 구간의 복습 필드를 srs로 묶고, 기초 카드 표를 더한다
db.version(3)
  .stores({ sections: '++id, pieceId', cards: 'id, book' })
  .upgrade(async tx => {
    await tx.table('sections').toCollection().modify(migrateSection)
    await tx.table('entries').toCollection().modify((e: Entry) => {
      if (e.grade) e.grade = migrateGrade(e.grade)
    })
  })

// 4: 5도권 묶음을 스케일·아르페지오로 나눔 — 옛 묶음에 섞인 아르페지오 종류를 arpSet으로 옮긴다
db.version(4)
  .stores({})
  .upgrade(tx => migrateCircleSets(tx.table('settings'), tx.table('routine')))

/** 옛 5도권 묶음(scaleSet 하나에 스케일·아르페지오 섞임)을 둘로 나눈다. 백업 복원 뒤에도 부른다 */
export async function migrateCircleSets(settings: Dexie.Table, routine: Dexie.Table) {
  const row = (await settings.get('scaleSet')) as Setting | undefined
  if (!row || (await settings.get('arpSet'))) return
  const old = row.value as ScaleSet
  const arpKinds = old.kinds.filter(k => k === 'ma' || k === 'na')
  const scaleKinds = old.kinds.filter(k => k === 'ms' || k === 'ns')
  if (!arpKinds.length) return
  await settings.put({ key: 'arpSet', value: { ...old, kinds: arpKinds } })
  await settings.put({ key: 'scaleSet', value: { ...old, kinds: scaleKinds.length ? scaleKinds : ['ms', 'ns'] } })
  // 아르페지오만 들어 있던 묶음을 쓰던 루틴 항목은 5도권 아르페지오로
  if (!scaleKinds.length) await routine.filter((r: RoutineItem) => r.refType === 'scale' && r.from === 1 && !r.srs).modify({ from: 2 })
}

/** 옛 구간(백업 포함)을 새 형식으로 */
export function migrateSection(s: Record<string, unknown>) {
  if (!s.srs) s.srs = migrateSectionSrs(s)
  delete s.intervalDays
  delete s.dueDate
  delete s.lastGrade
  delete s.lastPracticed
}

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
  dailyReviewMax: number // 레퍼토리: 하루 복습 구간 상한
  repNewPerDay: number // 레퍼토리: 하루 새 구간
  cardReviewMax: number // 기초: 책마다 하루 복습 상한
  cardNewPerDay: number // 기초: 책마다 하루 새 카드
  maxIvl: number // 최대 간격(일)
  leechAt: number // '다시' 몇 번이면 어려운 곳
  scaleSet: ScaleSet // 저장한 5도권 묶음 (스케일)
  arpSet: ScaleSet // 저장한 5도권 묶음 (아르페지오)
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
  dailyReviewMax: 8,
  repNewPerDay: 2,
  cardReviewMax: 10,
  cardNewPerDay: 3,
  maxIvl: 60,
  leechAt: 6,
  scaleSet: { keys: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], start: 0, dir: 'cw', kinds: ['ms', 'ns'] },
  arpSet: { keys: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], start: 0, dir: 'cw', kinds: ['ma', 'na'] }
}

export async function loadSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value
  return out as unknown as Settings
}

/** 스케일·아르페지오 묶음. 예전에 한 묶음에 섞여 저장된 종류는 걸러낸다 */
export function circleSet(s: Settings, mode: CircleMode): ScaleSet {
  const set = mode === 'scale' ? s.scaleSet : s.arpSet
  const allowed = SCALE_KINDS.filter(k => k.mode === mode).map(k => k.id)
  const kinds = set.kinds.filter(k => allowed.includes(k))
  return { ...set, kinds: kinds.length ? kinds : DEFAULT_SETTINGS[mode === 'scale' ? 'scaleSet' : 'arpSet'].kinds }
}

export function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  return db.settings.put({ key, value })
}
