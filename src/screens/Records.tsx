import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Segmented, useToast } from '../components/ui'
import { Lessons } from './rep/Lessons'
import { db } from '../lib/db'
import { useEntries } from '../lib/hooks'
import { secondsByDay } from '../lib/stats'
import { entryTitle } from '../lib/repertoire'
import { addDays, clock, dateKey, duration, parseDateKey, shortDate } from '../lib/time'

const WEEKS = 53
const LEVELS = [0, 30 * 60, 60 * 60, 120 * 60, 180 * 60] // 0 / 30분 / 1h / 2h / 3h+

function heatColor(sec: number) {
  if (!sec) return 'var(--s2)'
  const l = LEVELS.filter(x => sec >= x).length // 1–5
  return `color-mix(in oklch, var(--accent) ${[0, 22, 42, 64, 84, 100][l]}%, var(--s1))`
}

export function Records() {
  const entries = useEntries()
  const toast = useToast()
  const [view, setView] = useState<'cal' | 'lesson'>('cal')
  const byDay = useMemo(() => secondsByDay(entries), [entries])
  const [sel, setSel] = useState(dateKey())

  const today = new Date()
  // 마지막 열이 이번 주가 되도록 일요일 기준으로 시작
  const start = addDays(today, -(WEEKS - 1) * 7 - today.getDay())
  const cols = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))

  const sum = (from: Date) => {
    const k = dateKey(from)
    let s = 0
    byDay.forEach((v, d) => d >= k && (s += v))
    return s
  }
  const weekSec = sum(addDays(today, -today.getDay()))
  const monthSec = sum(new Date(today.getFullYear(), today.getMonth(), 1))
  const totalSec = [...byDay.values()].reduce((a, b) => a + b, 0)
  const days = byDay.size

  const dayEntries = entries.filter(e => e.date === sel)

  const remove = async (id: number) => {
    if (!window.confirm('이 기록을 지울까요?')) return
    await db.entries.delete(id)
    toast('기록을 지웠어요')
  }

  return (
    <div className="screen">
      <div className="screen-inner">
        <div className="page-head">
          <h1 className="page-title">기록</h1>
          <Segmented value={view} onChange={setView} options={[{ value: 'cal', label: '연습 기록' }, { value: 'lesson', label: '레슨노트' }]} />
        </div>
        {view === 'lesson' ? (
          <Lessons />
        ) : (
          <>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          {[['이번 주', duration(weekSec)], ['이번 달', duration(monthSec)], ['전체', duration(totalSec)], ['연습한 날', `${days}일`]].map(([l, v]) => (
            <div key={l} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="label" style={{ fontSize: 13 }}>{l}</span>
              <span style={{ fontSize: 28, fontWeight: 600, lineHeight: 1 }}>{v}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="card-head">
            <span className="t">연습 캘린더<span className="sub">최근 1년 · 하루 연습 시간</span></span>
          </div>
          <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 4 }}>
            {cols.map((col, w) => (
              <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 0 10px', minWidth: 10 }}>
                <span style={{ height: 14, fontSize: 10, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>{col[0].getDate() <= 7 ? `${col[0].getMonth() + 1}월` : ''}</span>
                {col.map(d => {
                  const k = dateKey(d)
                  const future = d > today
                  return (
                    <button
                      key={k}
                      disabled={future}
                      onClick={() => setSel(k)}
                      title={k}
                      style={{ aspectRatio: '1', width: '100%', borderRadius: 3, background: future ? 'transparent' : heatColor(byDay.get(k) ?? 0), outline: k === sel ? '2px solid var(--ink)' : 'none', outlineOffset: 1 }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, color: 'var(--ink3)' }}>
            <span>적게</span>
            {[0, 1, 30 * 60, 60 * 60, 120 * 60, 180 * 60].map(s => (
              <span key={s} style={{ width: 14, height: 14, borderRadius: 3, background: heatColor(s) }} />
            ))}
            <span>3시간+</span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="t">{shortDate(parseDateKey(sel))}<span className="sub">{dayEntries.length ? `${dayEntries.length}개 · ${duration(byDay.get(sel) ?? 0)}` : ''}</span></span>
          </div>
          {dayEntries.length === 0 && <div className="empty">이날은 기록이 없어요.</div>}
          {dayEntries.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line)', fontSize: 15 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontWeight: 600 }}>
                  {entryTitle(e)}
                  {e.key && <span className="serif" style={{ marginLeft: 8, color: 'var(--ink2)' }}>{e.key}</span>}
                </span>
                <span style={{ fontSize: 13, color: 'var(--ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[`클린 ${e.cleanBpm} · 도달 ${e.bpm}`, e.hands, ...e.variations, e.rating ? '★'.repeat(e.rating) : '', e.memo].filter(Boolean).join(' · ')}
                </span>
              </div>
              <span style={{ color: 'var(--ink2)' }}>{clock(e.seconds)}</span>
              <button className="btn icon sm" style={{ color: 'var(--ink3)', background: 'transparent' }} onClick={() => remove(e.id!)} aria-label="기록 삭제">
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
          </>
        )}
      </div>
    </div>
  )
}
