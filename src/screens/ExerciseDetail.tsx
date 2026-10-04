import { useMemo } from 'react'
import { BOOK_NAME, KEYS, VARIATIONS, exerciseTitle, type ScoreBook } from '../data/exercises'
import { Icon, PlayIcon } from '../components/Icon'
import { useToast } from '../components/ui'
import { useEntries, useSettings } from '../lib/hooks'
import { coverage, exerciseStats, todayKey, weeklyBest } from '../lib/stats'
import { agoLabel, clock, daysAgo, parseDateKey, shortDate } from '../lib/time'
import { useNav } from '../nav'
import { useCards } from '../lib/cards'
import { cardId } from '../lib/db'
import { dueLabel } from '../lib/repertoire'
import type { Srs } from '../lib/srs'

function srsText(c: Srs | undefined) {
  if (!c) return null
  if (c.suspended) return '쉬는 중'
  if (c.state === 'new') return null
  return dueLabel(c.due).text
}

function Chart({ data }: { data: { label: string; clean: number; reach: number }[] }) {
  const vals = data.flatMap(d => [d.clean, d.reach]).filter(Boolean)
  if (vals.length === 0) return <div className="empty">최근 8주 기록이 없어요.</div>
  const lo = Math.floor((Math.min(...vals) - 6) / 10) * 10
  const hi = Math.ceil((Math.max(...vals) + 4) / 10) * 10
  const W = 730
  const X = (i: number) => 60 + i * (650 / (data.length - 1))
  const Y = (v: number) => 180 - ((v - lo) / (hi - lo)) * 168
  const grid: number[] = []
  for (let v = lo; v <= hi; v += (hi - lo) / 4) grid.push(Math.round(v))
  const line = (k: 'clean' | 'reach') => data.map((d, i) => (d[k] ? `${X(i)},${Y(d[k])}` : null)).filter(Boolean).join(' ')
  const last = [...data].reverse().find(d => d.clean)
  const lastI = last ? data.indexOf(last) : -1
  return (
    <svg viewBox={`0 0 ${W} 215`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {grid.map(v => (
        <g key={v}>
          <line x1="44" x2="720" y1={Y(v)} y2={Y(v)} style={{ stroke: 'var(--line)' }} />
          <text x="34" y={Y(v) + 4} textAnchor="end" style={{ fill: 'var(--ink3)', fontSize: 12 }}>{v}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={d.label} x={X(i)} y="208" textAnchor="middle" style={{ fill: 'var(--ink3)', fontSize: 12 }}>{d.label}</text>
      ))}
      <polyline points={line('reach')} fill="none" strokeWidth="2" strokeDasharray="5 5" style={{ stroke: 'var(--ink3)' }} />
      <polyline points={line('clean')} fill="none" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: 'var(--accent)' }} />
      {data.map((d, i) => d.clean ? <circle key={i} cx={X(i)} cy={Y(d.clean)} r="4" strokeWidth="2.5" style={{ fill: 'var(--s1)', stroke: 'var(--accent)' }} /> : null)}
      {last && <text x={X(lastI)} y={Y(last.clean) + 22} textAnchor="middle" style={{ fill: 'var(--accentText)', fontSize: 14, fontWeight: 700 }}>{last.clean}</text>}
    </svg>
  )
}

export function ExerciseDetail({ book, no }: { book: ScoreBook; no: number }) {
  const nav = useNav()
  const toast = useToast()
  const all = useEntries()
  const settings = useSettings()
  const mine = useMemo(() => all.filter(e => e.refType === book && e.refNo === no), [all, book, no])
  const stat = useMemo(() => exerciseStats(mine, book).get(no), [mine, book, no])
  const weekly = useMemo(() => weeklyBest(mine), [mine])
  const tKey = todayKey(settings, all)
  const map = book === 'hanon' ? settings.hanonBook : settings.pischnaBook
  const page = map.pages[no]
  const cards = useCards()
  const own = book === 'pischna' ? cards.get(cardId('pischna', no)) : undefined
  const sub = [book === 'hanon' && `${coverage(stat)}/12조`, stat?.best ? `최고 클린 ${stat.best}` : '기록 없음', own && srsText(own.srs) && `다음 복습 ${srsText(own.srs)}`, own?.srs.leech && '고질'].filter(Boolean).join(' · ')

  const openScore = () => {
    if (!map.scoreId) return toast(`설정에서 ${BOOK_NAME[book]} 악보 PDF를 연결하세요`)
    nav.openScore(map.scoreId, page ?? 1)
  }

  return (
    <div className="screen">
      <div className="screen-inner">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="back" onClick={nav.closePage}>
            <Icon name="left" size={20} width={1.8} />
            {BOOK_NAME[book]}
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="page-title" style={{ fontSize: 34 }}>{exerciseTitle(book, no)}</span>
              <span style={{ fontSize: 15, color: 'var(--ink3)' }}>{sub}</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button className="btn s1" style={{ height: 52 }} onClick={openScore}>
                <Icon name="book" width={1.6} /> 악보 {page && <span style={{ color: 'var(--ink3)', fontWeight: 500 }}>p.{page}</span>}
              </button>
              <button className="btn primary" style={{ height: 52 }} onClick={() => nav.startPractice({ refType: book, queue: [no], key: book === 'hanon' ? tKey : undefined })}>
                <PlayIcon size={20} /> 이 번호 연습하기
              </button>
            </div>
          </div>
        </div>

        {book === 'hanon' && (
          <div className="card" style={{ padding: '16px 18px 18px' }}>
            <div className="card-head" style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>12조<span className="sub" style={{ fontSize: 13 }}>5도권 순서 · 최고 클린 BPM · 마지막 연습 · 오른쪽 위는 다음 복습</span></span>
              <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--ink2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, border: '1.5px solid var(--alert)' }} />21일+</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, border: '1.5px solid var(--accent)' }} />오늘의 조</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
              {KEYS.map(k => {
                const ks = stat?.keys[k]
                const stale = ks?.last ? daysAgo(ks.last) >= 21 : false
                const isToday = k === tKey
                const card = cards.get(cardId('hanon', no, k))
                const next = srsText(card?.srs)
                return (
                  <button
                    key={k}
                    className="tap"
                    onClick={() => nav.startPractice({ refType: 'hanon', queue: [no], key: k })}
                    style={{ height: 98, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', background: ks ? 'var(--s2)' : 'transparent', border: `1.5px ${ks ? 'solid' : 'dashed'} ${stale ? 'var(--alert)' : isToday ? 'var(--accent)' : ks ? 'transparent' : 'var(--line)'}` }}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                      <span className="serif" style={{ fontSize: 19, fontWeight: 600, color: ks ? undefined : 'var(--ink3)' }}>{k}</span>
                      {next && <span style={{ fontSize: 11, fontWeight: 600, color: card?.srs.leech ? 'var(--alert)' : next === '오늘' || next.endsWith('지남') ? 'var(--accentText)' : 'var(--ink3)', whiteSpace: 'nowrap' }}>{next}</span>}
                    </span>
                    <span style={{ fontSize: 26, fontWeight: 600, lineHeight: 1, color: ks ? undefined : 'var(--ink3)' }}>{ks?.best ?? '—'}</span>
                    <span style={{ fontSize: 12, fontWeight: stale || isToday ? 600 : 400, color: stale ? 'var(--alert)' : isToday ? 'var(--accentText)' : 'var(--ink3)' }}>{isToday && !ks?.last ? '오늘의 조' : agoLabel(ks?.last)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: '16px 20px' }}>
          <div className="card-head">
            <span style={{ fontSize: 17, fontWeight: 600 }}>BPM 추이<span className="sub" style={{ fontSize: 13 }}>최근 8주 · 주별 최고</span></span>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--ink2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 2.5, background: 'var(--accent)' }} />클린</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, borderTop: '2px dashed var(--ink3)' }} />도달</span>
            </div>
          </div>
          <Chart data={weekly} />
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div className="card-head">
            <span style={{ fontSize: 17, fontWeight: 600 }}>변형별 최고<span className="sub" style={{ fontSize: 13 }}>클린 BPM</span></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 56px 64px', fontSize: 12, color: 'var(--ink3)', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span>변형</span><span /><span style={{ textAlign: 'right' }}>{book === 'hanon' ? '조' : ''}</span><span style={{ textAlign: 'right' }}>최근</span>
          </div>
          {VARIATIONS.map(v => {
            const vs = stat?.variations[v]
            return (
              <div key={v} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 56px 64px', alignItems: 'center', height: 44, borderBottom: '1px solid var(--line)', fontSize: 15 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ width: 96, flex: 'none', color: vs ? undefined : 'var(--ink3)' }}>{v}</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--s2)', marginRight: 18 }}>
                    {vs && <div style={{ width: `${Math.max(4, Math.min(100, ((vs.best - 40) / 100) * 100))}%`, height: '100%', borderRadius: 2, background: 'var(--ink3)' }} />}
                  </div>
                </div>
                <span style={{ fontSize: 18, fontWeight: 600, textAlign: 'right', paddingRight: 6 }}>{vs?.best ?? '—'}</span>
                <span style={{ textAlign: 'right', color: 'var(--ink2)', fontSize: 13 }}>{vs && book === 'hanon' ? `${vs.keys.size}조` : ''}</span>
                <span style={{ textAlign: 'right', color: 'var(--ink3)', fontSize: 13 }}>{vs ? `${parseDateKey(vs.last).getMonth() + 1}/${parseDateKey(vs.last).getDate()}` : ''}</span>
              </div>
            )
          })}
        </div>

        <div className="card">
          <div className="card-head">
            <span style={{ fontSize: 17, fontWeight: 600 }}>최근 기록<span className="sub" style={{ fontSize: 13 }}>{mine.length}회 · 총 {clock(stat?.seconds ?? 0)}</span></span>
          </div>
          {mine.length === 0 && <div className="empty">아직 기록이 없어요.</div>}
          {[...mine].reverse().slice(0, 12).map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line)', fontSize: 15 }}>
              <span style={{ width: 110, color: 'var(--ink2)' }}>{shortDate(parseDateKey(e.date))}</span>
              {e.key && <span className="serif" style={{ width: 34, fontWeight: 600 }}>{e.key}</span>}
              <span style={{ fontWeight: 600 }}>클린 {e.cleanBpm}</span>
              <span style={{ color: 'var(--ink3)' }}>도달 {e.bpm}</span>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[e.hands, ...e.variations, e.memo].filter(Boolean).join(' · ')}</span>
              <span style={{ color: 'var(--ink3)' }}>{clock(e.seconds)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
