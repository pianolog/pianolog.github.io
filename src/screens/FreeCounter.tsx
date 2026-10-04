import { useState } from 'react'
import type { Attempt, HandKey } from '../lib/db'
import { HAND_KEYS, HAND_LABEL, PRACTICE_WAYS, spanText, summarizeAttempts } from '../lib/repertoire'
import { Icon } from '../components/Icon'

/** 자유 연습: 손마다 손·마디·방법별로 친 횟수를 센다 */
export function useAttemptLog() {
  const [log, setLog] = useState<Attempt[]>([])
  const [hand, setHand] = useState<HandKey>('B')
  const [from, setFrom] = useState(0) // 0 = 마디 안 정함
  const [to, setTo] = useState(0)
  const [ways, setWays] = useState<string[]>([])
  const record = (ok: boolean, bpm: number) =>
    setLog(l => [...l, { h: hand, a: from && to ? Math.min(from, to) : 0, b: from && to ? Math.max(from, to) : 0, ok, bpm, w: ways.length ? ways : undefined }])
  const undo = () => setLog(l => l.slice(0, -1))
  const reset = () => {
    setLog([])
    setHand('B')
    setFrom(0)
    setTo(0)
    setWays([])
  }
  return { log, hand, setHand, from, setFrom, to, setTo, ways, setWays, record, undo, reset }
}

export type AttemptState = ReturnType<typeof useAttemptLog>

/** 가장 많이 친 손 (양손을 한 번이라도 쳤으면 양손) */
export function mainHand(log: Attempt[]): HandKey {
  if (!log.length || log.some(x => x.h === 'B')) return 'B'
  return log.filter(x => x.h === 'R').length >= log.filter(x => x.h === 'L').length ? 'R' : 'L'
}

/** 손마다 성공한 가장 먼 마디 (이전 기록과 합침) */
export function mergeFarthest(prev: Partial<Record<HandKey, number>>, log: Attempt[]) {
  const out = { ...prev }
  for (const x of log) if (x.ok && x.b) out[x.h] = Math.max(out[x.h] ?? 0, x.b)
  return out
}

export const farthestText = (r: Partial<Record<HandKey, number>>) =>
  HAND_KEYS.filter(h => r[h])
    .map(h => `${HAND_LABEL[h]} m.${r[h]}`)
    .join(' · ')

function Num({ value, onChange, placeholder }: { value: number; onChange: (n: number) => void; placeholder: string }) {
  return (
    <input
      className="field"
      inputMode="numeric"
      placeholder={placeholder}
      value={value || ''}
      onChange={e => {
        const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
        onChange(Number.isNaN(n) ? 0 : Math.min(999, n))
      }}
      style={{ width: 70, height: 44, textAlign: 'center', fontSize: 18, fontWeight: 600, background: 'var(--bg)', padding: 0 }}
    />
  )
}

export function FreeCounterPanel({ st, bpm, farthest }: { st: AttemptState; bpm: number; farthest: Partial<Record<HandKey, number>> }) {
  const { log, hand, from, to, ways } = st
  const ranged = from > 0 && to > 0
  const a = Math.min(from, to)
  const b = Math.max(from, to)
  const mine = log.filter(x => x.h === hand && (ranged ? x.a === a && x.b === b : !x.a))
  const len = b - a + 1
  const next = () => {
    st.setFrom(b + 1)
    st.setTo(b + len)
  }
  const prevText = farthestText(farthest)
  return (
    <div style={{ background: 'var(--s1)', borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {HAND_KEYS.map(h => {
          const on = hand === h
          const n = log.filter(x => x.h === h).length
          return (
            <button
              key={h}
              className="tap"
              onClick={() => st.setHand(h)}
              style={{ height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', background: on ? 'var(--ink)' : 'var(--bg)', color: on ? 'var(--bg)' : 'var(--ink2)' }}
            >
              {HAND_LABEL[h]}
              <span style={{ minWidth: 26, height: 26, borderRadius: 13, padding: '0 7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: n ? 'var(--accent)' : 'transparent', color: n ? 'var(--accentInk)' : on ? 'var(--bg)' : 'var(--ink3)', opacity: n ? 1 : 0.6 }}>{n}</span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="sec-label" style={{ marginRight: 4 }}>마디</span>
        <Num value={from} onChange={st.setFrom} placeholder="부터" />
        <span style={{ color: 'var(--ink3)' }}>–</span>
        <Num value={to} onChange={st.setTo} placeholder="까지" />
        {ranged && (
          <>
            <button className="btn sm" style={{ height: 44 }} onClick={next}>
              다음 {len}마디 <Icon name="arrow" size={16} />
            </button>
            <button className="link" style={{ fontSize: 14 }} onClick={() => { st.setFrom(0); st.setTo(0) }}>
              지우기
            </button>
          </>
        )}
        <span className="caption" style={{ marginLeft: 'auto' }}>{prevText ? `지난번까지 ${prevText}` : '비워 두면 곡 전체'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span className="sec-label" style={{ marginRight: 4 }}>방법</span>
        {PRACTICE_WAYS.map(w => {
          const on = ways.includes(w)
          return (
            <button key={w} className={`pick${on ? ' on' : ''}`} style={{ height: 40, padding: '0 14px', fontSize: 14 }} onClick={() => st.setWays(x => (on ? x.filter(v => v !== w) : [...x, w]))}>
              {w}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10 }}>
        <button className="tap" onClick={() => st.record(false, bpm)} style={{ height: 76, borderRadius: 18, background: 'var(--bg)', color: 'var(--alert)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 21, fontWeight: 700 }}>
          <Icon name="close" size={22} width={2.4} /> 실수
        </button>
        <button className="tap" onClick={() => st.record(true, bpm)} style={{ height: 76, borderRadius: 18, background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 21, fontWeight: 700 }}>
          <Icon name="check" size={24} width={2.6} /> 성공
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--ink3)' }}>
        <span>
          <b style={{ color: 'var(--ink)', fontSize: 16 }}>
            {HAND_LABEL[hand]}
            {ranged ? ` ${spanText(a, b)}` : ''} {mine.length}번
          </b>{' '}
          · 성공 {mine.filter(x => x.ok).length} · 오늘 이 곡 {log.length}번
        </span>
        {log.length > 0 && (
          <button className="link" style={{ fontSize: 14, marginLeft: 'auto' }} onClick={st.undo}>
            방금 것 취소
          </button>
        )}
      </div>
    </div>
  )
}

/** 항목 끝내기 시트에 넣는 요약 */
export function FreeSummary({ log, before }: { log: Attempt[]; before: Partial<Record<HandKey, number>> }) {
  const after = mergeFarthest(before, log)
  const ways = new Map<string, number>()
  for (const x of log) for (const w of x.w ?? []) ways.set(w, (ways.get(w) ?? 0) + 1)
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 16, padding: '6px 18px 10px', display: 'flex', flexDirection: 'column' }}>
      {summarizeAttempts(log).map(x => (
        <div key={x.h} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 12, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontWeight: 700 }}>{HAND_LABEL[x.h]}</span>
          <span style={{ fontSize: 14, color: 'var(--ink2)' }}>
            {x.spans.join(', ') || '마디 안 정함'}
            {after[x.h] && (
              <span style={{ marginLeft: 8, color: after[x.h] !== before[x.h] ? 'var(--ok)' : 'var(--ink3)', fontWeight: after[x.h] !== before[x.h] ? 600 : 400 }}>m.{after[x.h]}까지</span>
            )}
          </span>
          <span style={{ fontSize: 15 }}>
            <b>{x.n}번</b> <span style={{ color: 'var(--ink3)' }}>· 성공 {x.ok}</span>
          </span>
        </div>
      ))}
      {ways.size > 0 && <span style={{ fontSize: 14, color: 'var(--ink2)', paddingTop: 8 }}>{[...ways].map(([w, n]) => `${w} ${n}번`).join(' · ')}</span>}
    </div>
  )
}
