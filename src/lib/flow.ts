import { useMemo } from 'react'
import type { Key } from '../data/exercises'
import type { PracticeTarget } from '../nav'
import { db, loadSettings, type Entry, type Settings } from './db'
import { loadRepData, recommend, useRepData } from './repertoire'
import { routineLabel, routineProgress, todayKey, type RoutineCtx, type RoutineProgress } from './stats'
import { dateKey } from './time'

/** 루틴 항목 → 연습 대상. 칠 번호가 없으면 null */
export function targetFor(p: RoutineProgress, key: Key): PracticeTarget | null {
  const { item, nums } = p
  if (item.refType === 'free') return { refType: 'free', title: item.title, routineId: item.id }
  if (!nums.length) return null
  const from = p.nextNo ?? nums[0]
  const queue = nums.slice(nums.indexOf(from))
  if (item.refType === 'rep') return { refType: 'section', queue, routineId: item.id }
  return { refType: item.refType, queue, key: item.refType === 'hanon' ? key : undefined, routineId: item.id }
}

export function targetLabel(t: PracticeTarget) {
  if (t.refType === 'free') return t.title
  if (t.refType === 'section') return '레퍼토리 · 오늘 할 구간'
  return routineLabel({ order: 0, refType: t.refType, from: t.queue[0], to: t.queue[t.queue.length - 1], title: '', minutes: 0 }, t.key)
}

/** 화면에서 쓰는 루틴 계산 조건 (오늘의 조, 피쉬나 a·b, 오늘 할 구간) */
export function useRoutineCtx(settings: Settings, entries: Entry[]): RoutineCtx {
  const rep = useRepData()
  const key = todayKey(settings.todayKeyMode, entries)
  return useMemo(
    () => ({
      splits: settings.pischnaSplits,
      key,
      repQueue: recommend(rep.sections, rep.pieces, rep.ddays, rep.lessons, { limit: settings.dailyReviewMax, minutes: 60 }).map(p => p.section.id!)
    }),
    [settings.pischnaSplits, settings.dailyReviewMax, key, rep]
  )
}

/** 루틴에서 지금 항목 다음으로 할 것 */
export async function nextRoutineTarget(routineId: number): Promise<PracticeTarget | null> {
  const [routine, all, s, rep] = await Promise.all([db.routine.orderBy('order').toArray(), db.entries.toArray(), loadSettings(), loadRepData()])
  const today = all.filter(e => e.date === dateKey())
  const key = todayKey(s.todayKeyMode, all)
  const ctx: RoutineCtx = {
    splits: s.pischnaSplits,
    key,
    repQueue: recommend(rep.sections, rep.pieces, rep.ddays, rep.lessons, { limit: s.dailyReviewMax, minutes: 60 }).map(p => p.section.id!)
  }
  const i = routine.findIndex(r => r.id === routineId)
  const next = routine
    .slice(i + 1)
    .map(r => routineProgress(r, today, ctx))
    .find(p => p.status !== 'done' && targetFor(p, key))
  return next ? targetFor(next, key) : null
}
