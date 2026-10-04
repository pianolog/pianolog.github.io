import { useLiveQuery } from 'dexie-react-hooks'
import { exerciseTitle } from '../data/exercises'
import { db, type DDay, type Entry, type Lesson, type Piece, type Section, type Settings } from './db'
import { againToday, ddayCap, doneToday, newSrs, schedule, type Rating, type SrsOpts } from './srs'
import { dateKey, daysAgo } from './time'

export const STAGES = ['악보 읽기', '운지 확정', '느린 템포', '템포 업', '암보', '연주 완성'] as const

export const LIST_COLORS = ['#e2a84b', '#d9735b', '#c75b8a', '#8a72d6', '#4f8fd6', '#3fa58f', '#7fa34a', '#8c8c8c']

export function entryTitle(e: Entry) {
  return e.refType === 'hanon' || e.refType === 'pischna' || e.refType === 'scale' ? exerciseTitle(e.refType, e.refNo) : e.title
}

export function pieceName(p: Piece) {
  return [p.composer, p.title].filter(Boolean).join(' ')
}

// ── 간격 반복 ──

/** 이 곡이 걸린 가장 가까운 D-day까지 남은 날 */
export function daysToDday(pieceId: number, ddays: DDay[], today = dateKey()) {
  const near = ddays.filter(d => d.pieceIds.includes(pieceId) && d.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
  return near ? -daysAgo(near.date, today) : null
}

export function sectionOpts(settings: Settings, pieceId: number, ddays: DDay[], today = dateKey()): SrsOpts {
  return { maxIvl: settings.maxIvl, leechAt: settings.leechAt, cap: ddayCap(daysToDday(pieceId, ddays, today)) }
}

export function scheduleAfter(section: Section, rating: Rating, opts: SrsOpts, today = dateKey()): Partial<Section> {
  return {
    srs: schedule(section.srs, rating, today, opts),
    weak: rating === 'again' ? true : rating === 'good' || rating === 'easy' ? false : section.weak
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

/** 구간 표의 '다음 복습' 칸 */
export function sectionDue(s: Section, today = dateKey()) {
  const c = s.srs
  if (c.suspended) return { text: '쉬는 중', kind: 'later' as const }
  if (c.againOn === today) return { text: '오늘 다시', kind: 'over' as const }
  if (c.state === 'new') return { text: '새 구간', kind: 'later' as const }
  return dueLabel(c.due, today)
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
    srs: newSrs()
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
  again: boolean // 오늘 '다시'를 눌러 한 번 더 할 구간
}

export function openLessons(lessons: Lesson[], sectionId: number) {
  const out: { lesson: Lesson; text: string; id: string }[] = []
  for (const l of lessons) for (const it of l.items) if (it.sectionId === sectionId && !it.resolved) out.push({ lesson: l, text: it.text, id: it.id })
  return out
}

/**
 * 오늘 할 구간 (Anki 순서): 오늘 이미 한 구간 → 복습(점수순, 하루 상한) → 새 구간(하루 한도) → 오늘 다시
 * 복습 점수: 취약·레슨 지적·밀린 날·D-day·목표 템포 차이
 */
export function recommend(
  sections: Section[],
  pieces: Piece[],
  ddays: DDay[],
  lessons: Lesson[],
  opts: { limit: number; newMax: number; minutes: number; pieceId?: number; today?: string }
): Pick[] {
  const today = opts.today ?? dateKey()
  const live = new Map(pieces.filter(p => !p.archived).map(p => [p.id!, p]))
  const done: Pick[] = []
  const reviews: Pick[] = []
  const fresh: Pick[] = []
  const again: Pick[] = []
  let newUsed = 0
  for (const s of sections) {
    const piece = live.get(s.pieceId)
    if (!piece || (opts.pieceId && s.pieceId !== opts.pieceId)) continue
    const c = s.srs
    if (c.introduced === today) newUsed++
    if (c.suspended) continue
    const isDone = doneToday(c, today)
    const isAgain = againToday(c, today)
    const isNew = c.state === 'new'
    const overdue = !isNew && c.due <= today ? daysAgo(c.due, today) : -1
    const lessonsOpen = openLessons(lessons, s.id!).length
    if (!isDone && !isAgain && !isNew && overdue < 0 && !s.weak && !lessonsOpen) continue

    const tags: Tag[] = []
    let score = 0
    if (isNew) tags.push({ text: '새 구간', kind: 'plain' })
    if (isAgain) tags.push({ text: '오늘 다시', kind: 'over' })
    if (c.leech) tags.push({ text: '고질', kind: 'weak' })
    if (s.weak) {
      score += 4
      tags.push({ text: '취약', kind: 'weak' })
    }
    if (lessonsOpen) {
      score += 2 * lessonsOpen
      tags.push({ text: `레슨 지적 ${lessonsOpen}`, kind: 'lesson' })
    }
    if (!isAgain && overdue > 0) {
      score += 2 + overdue
      tags.push({ text: `복습 ${overdue}일 지남`, kind: 'over' })
    } else if (!isAgain && overdue === 0) {
      score += 2
      tags.push({ text: '복습 오늘', kind: 'plain' })
    }
    const left = daysToDday(s.pieceId, ddays, today)
    if (left !== null) {
      if (left <= 21 && !isNew) score += (21 - left) / 4
      const near = ddays.filter(d => d.pieceIds.includes(s.pieceId) && d.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
      if (left <= 60) tags.push({ text: `${near.title} ${ddayLabel(near.date, today)}`, kind: 'plain' })
    }
    const gap = s.targetBpm - s.bpm
    if (gap > 0) {
      if (!isNew) score += Math.min(2, gap / 10)
      if (s.stage >= 2) tags.push({ text: `목표까지 −${gap}`, kind: 'plain' })
    }
    const p: Pick = { section: s, piece, score, tags, minutes: 0, doneToday: isDone, again: isAgain }
    if (isAgain) again.push(p)
    else if (isDone) done.push(p)
    else if (isNew) fresh.push(p)
    else reviews.push(p)
  }
  reviews.sort((a, b) => b.score - a.score)
  // 새 구간: 취약·레슨 지적이 있는 것 먼저, 나머지는 곡 순서·구간 순서대로
  fresh.sort((a, b) => b.score - a.score || a.section.pieceId - b.section.pieceId || a.section.order - b.section.order)
  const reviewsUsed = done.filter(p => p.section.srs.introduced !== today).length
  const top = [
    ...done,
    ...reviews.slice(0, Math.max(0, opts.limit - reviewsUsed)),
    ...fresh.slice(0, Math.max(0, opts.newMax - newUsed)),
    ...again
  ]
  const total = top.reduce((a, p) => a + Math.max(1, p.score), 0)
  for (const p of top) p.minutes = Math.max(5, Math.round(((Math.max(1, p.score) / total) * opts.minutes) / 5) * 5)
  return top
}

/** 설정에서 오늘 할 구간 */
export function recommendToday(rep: { sections: Section[]; pieces: Piece[]; ddays: DDay[]; lessons: Lesson[] }, settings: Settings, extra: { pieceId?: number; limit?: number } = {}) {
  return recommend(rep.sections, rep.pieces, rep.ddays, rep.lessons, {
    limit: extra.limit ?? settings.dailyReviewMax,
    newMax: extra.pieceId ? 99 : settings.repNewPerDay,
    minutes: 60,
    pieceId: extra.pieceId
  })
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
  sections.sort((a, b) => a.pieceId - b.pieceId || a.order - b.order)
  return { pieces, sections, ddays, lessons }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}
