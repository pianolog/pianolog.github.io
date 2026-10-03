import { useLiveQuery } from 'dexie-react-hooks'
import { exerciseTitle } from '../data/exercises'
import { db, type DDay, type Entry, type Grade, type Lesson, type Piece, type Section } from './db'
import { addDays, dateKey, daysAgo, parseDateKey } from './time'

export const STAGES = ['악보 읽기', '운지 확정', '느린 템포', '템포 업', '암보', '연주 완성'] as const

export const LIST_COLORS = ['#e2a84b', '#d9735b', '#c75b8a', '#8a72d6', '#4f8fd6', '#3fa58f', '#7fa34a', '#8c8c8c']

export function entryTitle(e: Entry) {
  return e.refType === 'hanon' || e.refType === 'pischna' || e.refType === 'scale' ? exerciseTitle(e.refType, e.refNo) : e.title
}

export function pieceName(p: Piece) {
  return [p.composer, p.title].filter(Boolean).join(' ')
}

// ── 간격 반복 ──

const LADDER = [1, 2, 4, 7, 14, 30]

/** 평가 → 다음 간격(일) */
export function nextInterval(grade: Grade, current: number) {
  if (grade === 'bad') return 1
  if (grade === 'unsure') return Math.max(2, current)
  return LADDER.find(d => d > current) ?? 30
}

export function scheduleAfter(section: Section, grade: Grade, today = dateKey()): Partial<Section> {
  const intervalDays = nextInterval(grade, section.intervalDays)
  return {
    intervalDays,
    dueDate: dateKey(addDays(parseDateKey(today), intervalDays)),
    lastGrade: grade,
    lastPracticed: today,
    weak: grade === 'bad' ? true : grade === 'good' ? false : section.weak
  }
}

export function dueLabel(due: string, today = dateKey()) {
  const d = -daysAgo(due, today) // 양수 = 미래
  if (d === 0) return { text: '오늘', kind: 'today' as const }
  if (d < 0) return { text: `${-d}일 지남`, kind: 'over' as const }
  if (d === 1) return { text: '내일', kind: 'later' as const }
  if (d >= 14 && d % 7 === 0) return { text: `${d / 7}주 뒤`, kind: 'later' as const }
  return { text: `${d}일 뒤`, kind: 'later' as const }
}

export function ddayLabel(date: string, today = dateKey()) {
  const d = -daysAgo(date, today)
  return d === 0 ? 'D-day' : d > 0 ? `D-${d}` : `D+${-d}`
}

export function newSection(pieceId: number, order: number, label: string, targetBpm = 60): Section {
  return {
    pieceId,
    order,
    label,
    note: '',
    stage: 0,
    bpm: Math.max(40, targetBpm - 24),
    targetBpm,
    ladderStart: Math.max(40, targetBpm - 24),
    streakGoal: 3,
    weak: false,
    intervalDays: 1,
    dueDate: dateKey()
  }
}

/** "116마디를 16마디씩" → m.1–16, m.17–32 … */
export function splitMeasures(total: number, size: number) {
  const out: string[] = []
  for (let a = 1; a <= total; a += size) out.push(`m.${a}–${Math.min(total, a + size - 1)}`)
  return out
}

// ── 오늘 할 구간 추천 ──

export interface Tag {
  text: string
  kind: 'weak' | 'lesson' | 'over' | 'plain'
}

export interface Pick {
  section: Section
  piece: Piece
  score: number
  tags: Tag[]
  minutes: number
  doneToday: boolean
}

export function openLessons(lessons: Lesson[], sectionId: number) {
  const out: { lesson: Lesson; text: string; id: string }[] = []
  for (const l of lessons) for (const it of l.items) if (it.sectionId === sectionId && !it.resolved) out.push({ lesson: l, text: it.text, id: it.id })
  return out
}

export function recommend(
  sections: Section[],
  pieces: Piece[],
  ddays: DDay[],
  lessons: Lesson[],
  opts: { limit: number; minutes: number; pieceId?: number; today?: string }
): Pick[] {
  const today = opts.today ?? dateKey()
  const live = new Map(pieces.filter(p => !p.archived).map(p => [p.id!, p]))
  const picks: Pick[] = []
  for (const s of sections) {
    const piece = live.get(s.pieceId)
    if (!piece || (opts.pieceId && s.pieceId !== opts.pieceId)) continue
    const doneToday = s.lastPracticed === today
    const overdue = s.dueDate <= today ? daysAgo(s.dueDate, today) : -1
    const lessonsOpen = openLessons(lessons, s.id!).length
    if (!doneToday && overdue < 0 && !s.weak && !lessonsOpen) continue

    const tags: Tag[] = []
    let score = 0
    if (s.weak) {
      score += 4
      tags.push({ text: '취약', kind: 'weak' })
    }
    if (lessonsOpen) {
      score += 2 * lessonsOpen
      tags.push({ text: `레슨 지적 ${lessonsOpen}`, kind: 'lesson' })
    }
    if (overdue > 0) {
      score += 2 + overdue
      tags.push({ text: `복습 ${overdue}일 지남`, kind: 'over' })
    } else if (overdue === 0) {
      score += 2
      tags.push({ text: '복습 오늘', kind: 'plain' })
    }
    const near = ddays
      .filter(d => d.pieceIds.includes(s.pieceId) && d.date >= today)
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0]
    if (near) {
      const left = -daysAgo(near.date, today)
      if (left <= 21) score += (21 - left) / 4
      if (left <= 60) tags.push({ text: `${near.title} ${ddayLabel(near.date, today)}`, kind: 'plain' })
    }
    const gap = s.targetBpm - s.bpm
    if (gap > 0) {
      score += Math.min(2, gap / 10)
      if (s.stage >= 2) tags.push({ text: `목표까지 −${gap}`, kind: 'plain' })
    }
    picks.push({ section: s, piece, score, tags, minutes: 0, doneToday })
  }
  // 오늘 이미 한 구간은 목록에서 빠지지 않게 앞에 둔다 (진행 상황이 흔들리지 않도록)
  picks.sort((a, b) => Number(b.doneToday) - Number(a.doneToday) || b.score - a.score)
  const top = picks.slice(0, opts.limit)
  const total = top.reduce((a, p) => a + Math.max(1, p.score), 0)
  for (const p of top) p.minutes = Math.max(5, Math.round(((Math.max(1, p.score) / total) * opts.minutes) / 5) * 5)
  return top
}

export function useRepData() {
  return useLiveQuery(
    async () => {
      const [pieces, sections, ddays, lessons, lists] = await Promise.all([
        db.pieces.toArray(),
        db.sections.toArray(),
        db.ddays.orderBy('date').toArray(),
        db.lessons.orderBy('date').reverse().toArray(),
        db.lists.orderBy('order').toArray()
      ])
      sections.sort((a, b) => a.pieceId - b.pieceId || a.order - b.order)
      return { pieces, sections, ddays, lessons, lists }
    },
    [],
    { pieces: [] as Piece[], sections: [] as Section[], ddays: [] as DDay[], lessons: [] as Lesson[], lists: [] as import('./db').RepList[] }
  )
}

export async function loadRepData() {
  const [pieces, sections, ddays, lessons] = await Promise.all([db.pieces.toArray(), db.sections.toArray(), db.ddays.toArray(), db.lessons.toArray()])
  return { pieces, sections, ddays, lessons }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}
