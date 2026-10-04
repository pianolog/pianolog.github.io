import { addDays, dateKey, daysAgo, parseDateKey } from './time'

// Anki(SM-2) 방식 간격 복습. 하루 단위로 돌고, '다시'는 같은 날 한 번 더 나온다.

/** 다시 / 어려움 / 됨 / 쉬움 */
export type Rating = 'again' | 'hard' | 'good' | 'easy'
export type SrsState = 'new' | 'learning' | 'review' | 'relearning'

export interface Srs {
  state: SrsState
  ease: number // 쉬움 정도 (2.5 = 250%) — 됨을 누를 때마다 간격 × ease
  ivl: number // 지금 간격(일)
  due: string // 다음 복습일
  reps: number
  lapses: number // 복습 중 '다시'를 누른 횟수
  last?: string // 마지막 평가일
  lastRating?: Rating
  againOn?: string // 이 날 '다시'를 눌러서 그날 한 번 더 할 것
  introduced?: string // 처음 평가한 날 (새 항목 하루 한도에 씀)
  leech?: boolean // 어려운 곳 (Anki의 leech)
  suspended?: boolean // 잠시 쉬기
}

export interface SrsOpts {
  maxIvl: number // 최대 간격(일)
  leechAt: number // 어려운 곳으로 표시할 '다시' 횟수
  cap?: number // D-day 때문에 줄인 최대 간격
}

export const RATINGS: { r: Rating; label: string }[] = [
  { r: 'again', label: '다시' },
  { r: 'hard', label: '어려움' },
  { r: 'good', label: '됨' },
  { r: 'easy', label: '쉬움' }
]

export const RATING_LABEL: Record<Rating, string> = { again: '다시', hard: '어려움', good: '됨', easy: '쉬움' }

const START_EASE = 2.5
const MIN_EASE = 1.3

export function newSrs(today = dateKey()): Srs {
  return { state: 'new', ease: START_EASE, ivl: 0, due: today, reps: 0, lapses: 0 }
}

/** 평가 → 다음 상태 */
export function schedule(c: Srs, r: Rating, today: string, o: SrsOpts): Srs {
  const max = Math.max(1, Math.min(o.maxIvl, o.cap ?? Infinity))
  const clamp = (d: number) => Math.max(1, Math.min(max, Math.round(d)))
  const base = { ...c, reps: c.reps + 1, last: today, lastRating: r, againOn: undefined, introduced: c.introduced ?? today }
  const at = (ivl: number, state: SrsState, ease = c.ease): Srs => ({ ...base, state, ivl, ease, due: dateKey(addDays(parseDateKey(today), ivl)) })

  if (c.state !== 'review') {
    // 새 항목·익히는 중: '됨'이면 졸업
    if (r === 'again') return { ...base, state: c.state === 'new' ? 'learning' : c.state, due: today, againOn: today }
    if (r === 'hard') return at(1, c.state === 'new' ? 'learning' : c.state)
    if (r === 'good') return at(c.state === 'relearning' ? clamp(c.ivl) : 1, 'review')
    return at(clamp(c.state === 'relearning' ? c.ivl + 2 : 4), 'review', c.ease + 0.15)
  }

  const late = Math.max(0, daysAgo(c.due, today))
  if (r === 'again') {
    const lapses = c.lapses + 1
    return {
      ...base,
      state: 'relearning',
      lapses,
      ease: Math.max(MIN_EASE, c.ease - 0.2),
      ivl: Math.max(1, Math.round(c.ivl * 0.25)),
      due: today,
      againOn: today,
      leech: c.leech || lapses >= o.leechAt
    }
  }
  const hard = clamp(Math.max(c.ivl + 1, c.ivl * 1.2))
  if (r === 'hard') return at(hard, 'review', Math.max(MIN_EASE, c.ease - 0.15))
  const good = clamp(Math.max(hard + 1, (c.ivl + late / 2) * c.ease))
  if (r === 'good') return at(good, 'review')
  return at(clamp(Math.max(good + 1, (c.ivl + late) * c.ease * 1.3)), 'review', c.ease + 0.15)
}

/** 버튼에 쓸 다음 간격 미리보기 */
export function previewAll(c: Srs, today: string, o: SrsOpts): Record<Rating, string> {
  const out = {} as Record<Rating, string>
  for (const { r } of RATINGS) {
    const n = schedule(c, r, today, o)
    out[r] = n.againOn === today ? '오늘 다시' : ivlLabel(n.ivl)
  }
  return out
}

export function ivlLabel(d: number) {
  if (d <= 1) return '내일'
  if (d < 30) return `${d}일`
  const m = d / 30
  return `${Number.isInteger(m) ? m : m.toFixed(1)}개월`
}

/** D-day까지 남은 날의 1/3을 넘지 않게 (D-day 전에 적어도 두세 번은 다시 보도록) */
export function ddayCap(daysLeft: number | null) {
  return daysLeft === null || daysLeft < 0 ? undefined : Math.max(1, Math.floor(daysLeft / 3))
}

export const isDue = (c: Srs, today: string) => !c.suspended && c.state !== 'new' && c.due <= today
export const doneToday = (c: Srs, today: string) => c.last === today && c.againOn !== today
export const againToday = (c: Srs, today: string) => c.againOn === today

/** 옛 3단계 평가(안 됨/애매/됨) → 4단계 */
export function migrateGrade(g: unknown): Rating | undefined {
  if (g === 'bad') return 'again'
  if (g === 'unsure') return 'hard'
  if (g === 'good' || g === 'again' || g === 'hard' || g === 'easy') return g
  return undefined
}

/** 옛 구간 필드(intervalDays/dueDate/lastGrade/lastPracticed) → Srs */
export function migrateSectionSrs(s: { intervalDays?: number; dueDate?: string; lastGrade?: unknown; lastPracticed?: string }): Srs {
  const today = dateKey()
  if (!s.lastPracticed) return { ...newSrs(today), due: s.dueDate ?? today }
  return {
    state: 'review',
    ease: START_EASE,
    ivl: s.intervalDays ?? 1,
    due: s.dueDate ?? today,
    reps: 1,
    lapses: 0,
    last: s.lastPracticed,
    lastRating: migrateGrade(s.lastGrade),
    introduced: s.lastPracticed
  }
}
