import { useMemo } from 'react'
import type { Key } from '../data/exercises'
import type { PracticeTarget } from '../nav'
import { cardQueue, loadCards, useCards } from './cards'
import { circleSet, db, loadSettings, type Card, type Entry, type Settings } from './db'
import { loadRepData, recommendToday, useRepData } from './repertoire'
import { routineLabel, routineProgress, todayKey, type RoutineCtx, type RoutineProgress } from './stats'

type RepData = Awaited<ReturnType<typeof loadRepData>>
import { dateKey } from './time'
import { scaleTitle } from '../data/exercises'

/** 루틴 항목 → 연습 대상. 칠 번호가 없으면 null */
export function targetFor(p: RoutineProgress, key: Key): PracticeTarget | null {
  const { item, nums } = p
  if (item.refType === 'free') return { refType: 'free', title: item.title, routineId: item.id }
  if (p.pending && item.refType !== 'rep') {
    if (!p.pending.length) return null
    return { refType: item.refType, queue: p.pending.map(c => c.no), keys: p.pending.map(c => c.key), routineId: item.id, label: routineLabel(item, key) }
  }
  if (!nums.length) return null
  const from = p.nextNo ?? nums[0]
  const queue = nums.slice(nums.indexOf(from))
  if (item.refType === 'rep') return { refType: 'section', queue, routineId: item.id }
  return { refType: item.refType, queue, key: item.refType === 'hanon' ? key : undefined, routineId: item.id, label: routineLabel(item, key) }
}

export function targetLabel(t: PracticeTarget) {
  if (t.refType === 'free') return t.title
  if (t.refType === 'section') return '레퍼토리 · 오늘 할 구간'
  if (t.label) return t.label
  if (t.keys) return `${routineLabel({ order: 0, refType: t.refType, from: 0, to: 0, title: '', minutes: 0, srs: true })} ${t.queue.length}개`
  if (t.refType === 'scale') return t.queue.length > 1 ? `${scaleTitle(t.queue[0])} 외 ${t.queue.length - 1}개` : scaleTitle(t.queue[0])
  return routineLabel({ order: 0, refType: t.refType, from: t.queue[0], to: t.queue[t.queue.length - 1], title: '', minutes: 0 }, t.key)
}

function buildCtx(settings: Settings, entries: Entry[], rep: RepData, cards: Map<string, Card>): RoutineCtx {
  const key = todayKey(settings, entries)
  const picks = recommendToday(rep, settings)
  const o = { splits: settings.pischnaSplits, key, settings }
  return {
    splits: settings.pischnaSplits,
    key,
    repQueue: picks.map(p => p.section.id!),
    repDone: picks.filter(p => p.doneToday).map(p => p.section.id!),
    scaleSet: circleSet(settings, 'scale'),
    arpSet: circleSet(settings, 'arpeggio'),
    cards: { hanon: cardQueue('hanon', cards, o), pischna: cardQueue('pischna', cards, o), scale: cardQueue('scale', cards, o) }
  }
}

/** 화면에서 쓰는 루틴 계산 조건 (오늘의 조, 피쉬나 a·b, 오늘 할 구간, 기초 카드) */
export function useRoutineCtx(settings: Settings, entries: Entry[]): RoutineCtx {
  const rep = useRepData()
  const cards = useCards()
  const key = todayKey(settings, entries)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildCtx(settings, entries, rep, cards), [settings, key, rep, cards])
}

/** 루틴에서 지금 항목 다음으로 할 것 */
export async function nextRoutineTarget(routineId: number): Promise<PracticeTarget | null> {
  const [routine, all, s, rep, cards] = await Promise.all([db.routine.orderBy('order').toArray(), db.entries.toArray(), loadSettings(), loadRepData(), loadCards()])
  const today = all.filter(e => e.date === dateKey())
  const ctx = buildCtx(s, all, rep, cards)
  const i = routine.findIndex(r => r.id === routineId)
  const next = routine
    .slice(i + 1)
    .map(r => routineProgress(r, today, ctx))
    .find(p => p.status !== 'done' && targetFor(p, ctx.key))
  return next ? targetFor(next, ctx.key) : null
}
