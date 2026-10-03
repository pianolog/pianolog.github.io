import { useMemo } from 'react'
import { useEntries } from '../lib/hooks'
import { duration, agoLabel } from '../lib/time'
import { useNav } from '../nav'
import { PlayIcon } from '../components/Icon'

/** 1단계: 자유 연습 기록을 곡별로 모아 보기. 목록·구간·간격 반복은 2단계. */
export function Repertoire() {
  const nav = useNav()
  const entries = useEntries()
  const pieces = useMemo(() => {
    const m = new Map<string, { title: string; seconds: number; last: string; count: number }>()
    for (const e of entries) {
      if (e.refType !== 'free') continue
      const p = m.get(e.title) ?? { title: e.title, seconds: 0, last: e.date, count: 0 }
      p.seconds += e.seconds
      p.count++
      if (e.date > p.last) p.last = e.date
      m.set(e.title, p)
    }
    return [...m.values()].sort((a, b) => (a.last < b.last ? 1 : -1))
  }, [entries])

  return (
    <div className="screen">
      <div className="screen-inner">
        <h1 className="page-title" style={{ paddingTop: 4 }}>레퍼토리</h1>
        <div className="card" style={{ background: 'color-mix(in oklch, var(--accent) 12%, var(--s1))', fontSize: 15, lineHeight: 1.6 }}>
          레퍼토리 목록 · 구간 관리 · 런스루 · 오늘 할 구간 추천 · 간격 반복은 <b>2단계</b>에서 추가돼요.
          <br />
          지금은 <b>연습 → 자유 연습</b>으로 기록한 곡이 여기 모여요.
        </div>
        <div className="card">
          {pieces.length === 0 && <div className="empty">아직 자유 연습 기록이 없어요.</div>}
          {pieces.map(p => (
            <div key={p.title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="serif" style={{ fontSize: 18, fontWeight: 600 }}>{p.title}</span>
                <span className="caption">총 {duration(p.seconds)} · {p.count}회 · 마지막 {agoLabel(p.last)}</span>
              </div>
              <button className="btn sm" onClick={() => nav.startPractice({ refType: 'free', title: p.title })}>
                <PlayIcon size={18} /> 연습
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
