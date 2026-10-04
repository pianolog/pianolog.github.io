import { useMemo } from 'react'
import { exerciseTitle } from '../data/exercises'
import { useCards } from '../lib/cards'
import { useEntries } from '../lib/hooks'
import { useRepData } from '../lib/repertoire'
import { RATINGS, type Rating, type Srs } from '../lib/srs'
import { addDays, dateKey, daysAgo } from '../lib/time'
import { useNav } from '../nav'

const DAYS = 30
const R_COLOR: Record<Rating, string> = { again: 'var(--alert)', hard: 'var(--ink3)', good: 'var(--accent)', easy: 'var(--ok)' }

function countStates(list: Srs[]) {
  const n = { new: 0, learning: 0, review: 0, leech: 0, suspended: 0 }
  for (const c of list) {
    if (c.suspended) n.suspended++
    else if (c.state === 'new') n.new++
    else if (c.state === 'review') n.review++
    else n.learning++
    if (c.leech) n.leech++
  }
  return n
}

/** 기록 → 복습: 앞으로 30일 예정, 기억률, 상태별 개수, 어려운 곳 목록 */
export function ReviewStats() {
  const nav = useNav()
  const rep = useRepData()
  const cards = useCards()
  const entries = useEntries()
  const today = dateKey()

  const live = useMemo(() => new Set(rep.pieces.filter(p => !p.archived).map(p => p.id!)), [rep.pieces])
  const sections = rep.sections.filter(s => live.has(s.pieceId))
  const cardList = [...cards.values()]

  const forecast = useMemo(() => {
    const out = Array.from({ length: DAYS }, (_, i) => ({ date: dateKey(addDays(new Date(), i)), rep: 0, basic: 0 }))
    const put = (c: Srs, k: 'rep' | 'basic') => {
      if (c.suspended || c.state === 'new') return
      const d = Math.max(0, -daysAgo(c.due, today))
      if (d < DAYS) out[d][k]++
    }
    for (const s of sections) put(s.srs, 'rep')
    for (const c of cardList) put(c.srs, 'basic')
    return out
  }, [sections, cardList, today])
  const peak = Math.max(4, ...forecast.map(f => f.rep + f.basic))
  const week = forecast.slice(0, 7).reduce((a, f) => a + f.rep + f.basic, 0)

  const since = dateKey(addDays(new Date(), -(DAYS - 1)))
  const graded = entries.filter(e => e.date >= since && e.grade)
  const retention = (isRep: boolean) => {
    const rs = graded.filter(e => e.srsKind === 'review' && (e.refType === 'section') === isRep)
    return rs.length ? { pct: Math.round((rs.filter(e => e.grade !== 'again').length / rs.length) * 100), n: rs.length } : null
  }
  const byRating = RATINGS.map(({ r, label }) => ({ r, label, n: graded.filter(e => e.grade === r).length }))
  const ratedTotal = byRating.reduce((a, x) => a + x.n, 0)

  const secStates = countStates(sections.map(s => s.srs))
  const cardStates = countStates(cardList.map(c => c.srs))
  const leechSecs = sections.filter(s => s.srs.leech)
  const leechCards = cardList.filter(c => c.srs.leech)
  const pieceTitle = (id: number) => rep.pieces.find(p => p.id === id)?.title ?? ''

  const tile = { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 } as const

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {(
          [
            ['오늘 복습', `${forecast[0].rep + forecast[0].basic}`, `레퍼토리 ${forecast[0].rep} · 기초 ${forecast[0].basic}`],
            ['앞으로 7일', `${week}`, '오늘 포함'],
            ['레퍼토리 기억률', retention(true) ? `${retention(true)!.pct}%` : '—', retention(true) ? `최근 30일 복습 ${retention(true)!.n}번` : '복습 기록 없음'],
            ['기초 기억률', retention(false) ? `${retention(false)!.pct}%` : '—', retention(false) ? `최근 30일 복습 ${retention(false)!.n}번` : '복습 기록 없음']
          ] as const
        ).map(([l, v, sub]) => (
          <div key={l} className="card" style={tile}>
            <span className="label" style={{ fontSize: 13 }}>{l}</span>
            <span style={{ fontSize: 28, fontWeight: 600, lineHeight: 1 }}>{v}</span>
            <span className="caption" style={{ fontSize: 12 }}>{sub}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '18px 20px' }}>
        <div className="card-head">
          <span className="t">앞으로 30일 복습 예정<span className="sub">밀린 것은 오늘에 포함</span></span>
          <span style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--ink2)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent)' }} />레퍼토리</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ink3)' }} />기초</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
          {forecast.map((f, i) => (
            <div key={f.date} title={`${f.date} · 레퍼토리 ${f.rep} · 기초 ${f.basic}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', gap: 1 }}>
              {f.rep + f.basic > 0 && <span style={{ fontSize: 10, textAlign: 'center', color: 'var(--ink3)' }}>{f.rep + f.basic}</span>}
              <div style={{ height: `${(f.rep / peak) * 110}px`, background: 'var(--accent)', borderRadius: '3px 3px 0 0', opacity: i === 0 ? 1 : 0.8 }} />
              <div style={{ height: `${(f.basic / peak) * 110}px`, background: 'var(--ink3)', borderRadius: f.rep ? 0 : '3px 3px 0 0', opacity: i === 0 ? 1 : 0.7 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
          {forecast.map((f, i) => (
            <span key={f.date} style={{ flex: 1, fontSize: 10, color: 'var(--ink3)', textAlign: 'center', whiteSpace: 'nowrap' }}>{i === 0 ? '오늘' : i % 7 === 0 ? `${i}일` : ''}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {(
          [
            ['레퍼토리 구간', secStates, '새 구간'],
            ['기초 카드', cardStates, '새 카드']
          ] as const
        ).map(([title, n, newLabel]) => (
          <div key={title} className="card" style={{ padding: '16px 20px' }}>
            <div className="card-head">
              <span className="t">{title}</span>
            </div>
            {(
              [
                [newLabel, n.new],
                ['익히는 중', n.learning],
                ['복습 중', n.review],
                ['어려운 곳', n.leech],
                ['쉬는 중', n.suspended]
              ] as const
            ).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 15 }}>
                <span style={{ color: l === '어려운 곳' && v ? 'var(--alert)' : 'var(--ink2)' }}>{l}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            {title === '기초 카드' && <span className="caption" style={{ fontSize: 12 }}>한 번이라도 평가한 카드만 세요</span>}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '18px 20px' }}>
        <div className="card-head">
          <span className="t">최근 30일 평가<span className="sub">{ratedTotal}번</span></span>
        </div>
        {ratedTotal === 0 ? (
          <div className="empty" style={{ padding: 12 }}>구간이나 기초를 끝낼 때 다시 / 어려움 / 됨 / 쉬움을 누르면 여기에 쌓여요.</div>
        ) : (
          <>
            <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden' }}>
              {byRating.map(x => x.n > 0 && <div key={x.r} style={{ flex: x.n, background: R_COLOR[x.r] }} />)}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13, color: 'var(--ink2)' }}>
              {byRating.map(x => (
                <span key={x.r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: R_COLOR[x.r] }} />
                  {x.label} {x.n}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="t">어려운 곳<span className="sub">'다시'가 자꾸 나오는 것 · 방법을 바꿔 볼 곳</span></span>
        </div>
        {leechSecs.length + leechCards.length === 0 && <div className="empty" style={{ padding: 12 }}>아직 없어요.</div>}
        {leechSecs.map(s => (
          <button key={`s${s.id}`} onClick={() => nav.openPage({ kind: 'piece', pieceId: s.pieceId })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line)', textAlign: 'left', fontSize: 15 }}>
            <span className="serif" style={{ fontWeight: 600, flex: 1 }}>{pieceTitle(s.pieceId)} · {s.label}</span>
            <span style={{ color: 'var(--alert)', fontWeight: 600 }}>다시 {s.srs.lapses}번</span>
          </button>
        ))}
        {leechCards.map(c => (
          <button key={c.id} onClick={() => nav.startPractice({ refType: c.book, queue: [c.no], keys: [c.key] })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line)', textAlign: 'left', fontSize: 15 }}>
            <span style={{ fontWeight: 600, flex: 1 }}>
              {exerciseTitle(c.book, c.no)}
              {c.key && <span className="serif" style={{ marginLeft: 8, color: 'var(--ink2)' }}>{c.key}</span>}
            </span>
            <span style={{ color: 'var(--alert)', fontWeight: 600 }}>다시 {c.srs.lapses}번</span>
          </button>
        ))}
      </div>
    </>
  )
}
