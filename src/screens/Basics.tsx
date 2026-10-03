import { useMemo, useState } from 'react'
import { KEYS, MINORS, bookItems, scaleNo, scaleQueue, type BookItem, type ScoreBook } from '../data/exercises'
import { PlayIcon } from '../components/Icon'
import { Segmented } from '../components/ui'
import { useEntries, useSettings } from '../lib/hooks'
import { coverage, exerciseStats, todayKey, type ExerciseStat } from '../lib/stats'
import { agoLabel, daysAgo } from '../lib/time'
import { useNav } from '../nav'
import { KeySheet } from './KeySheet'

const MIX = [0, 16, 32, 50, 72, 100]
const level = (b: number) => (!b ? 0 : b < 76 ? 1 : b < 88 ? 2 : b < 100 ? 3 : b < 112 ? 4 : 5)
const LEGEND = ['안 함', '~75', '76–87', '88–99', '100–111', '112+']

function heat(l: number): React.CSSProperties {
  return l === 0
    ? { background: 'transparent', border: '1.5px dashed var(--line)', color: 'var(--ink3)' }
    : { background: `color-mix(in oklch, var(--accent) ${MIX[l]}%, var(--s1))`, border: '1.5px solid transparent', color: l >= 4 ? 'var(--accentInk)' : 'var(--ink)' }
}

function Ring({ n }: { n: number }) {
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" style={{ transform: 'rotate(-90deg)', color: 'var(--accent)', flex: 'none' }}>
      <circle cx="13" cy="13" r="10" fill="none" strokeWidth="3.5" style={{ stroke: 'var(--line)' }} />
      <circle cx="13" cy="13" r="10" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray={`${((n / 12) * 62.83).toFixed(1)} 62.83`} strokeLinecap="round" />
    </svg>
  )
}

function Cell({ item, stat, mode, big, onClick }: { item: BookItem; stat?: ExerciseStat; mode: 'bpm' | 'cov'; big?: boolean; onClick: () => void }) {
  const cov = coverage(stat)
  const style = mode === 'bpm' ? heat(level(stat?.best ?? 0)) : stat ? { background: 'var(--s1)', border: '1.5px solid transparent', color: 'var(--ink)' } : heat(0)
  const main = mode === 'bpm' ? stat?.best || '—' : cov ? `${cov}/12` : stat ? '·' : '—'
  return (
    <button className="tap" onClick={onClick} style={{ height: big ? 140 : 92, borderRadius: big ? 14 : 10, padding: big ? '12px 14px' : '7px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{ fontSize: big ? 18 : 14, fontWeight: 600 }}>{item.label}</span>
        {mode === 'cov' && cov > 0 && <Ring n={cov} />}
      </div>
      {big && stat?.last && <span style={{ fontSize: 12, opacity: 0.75 }}>{agoLabel(stat.last)}</span>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: big ? 32 : mode === 'bpm' ? 22 : 17, fontWeight: 600 }}>{main}</span>
      </div>
    </button>
  )
}

function Legend({ hanon }: { hanon: boolean }) {
  return (
    <div style={{ padding: '24px 2px 8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 18px', fontSize: 13, color: 'var(--ink2)' }}>
      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>최고 클린 BPM (♩{hanon ? ', 12조 중' : ''})</span>
      {LEGEND.map((l, i) => (
        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 26, height: 16, borderRadius: 4, ...heat(i) }} />
          {l}
        </span>
      ))}
    </div>
  )
}

function ScaleMatrix() {
  const nav = useNav()
  const entries = useEntries()
  const settings = useSettings()
  const stats = useMemo(() => exerciseStats(entries, 'scale'), [entries])
  const key = todayKey(settings, entries)
  const [pickKey, setPickKey] = useState(false)
  const COLS: { label: string; kind: 0 | 1; minor: boolean }[] = [
    { label: '장조 스케일', kind: 0, minor: false },
    { label: '장조 아르페지오', kind: 1, minor: false },
    { label: '단조 스케일', kind: 0, minor: true },
    { label: '단조 아르페지오', kind: 1, minor: true }
  ]
  const touched = COLS.flatMap(c => KEYS.map((_, i) => scaleNo(c.kind, i + (c.minor ? 12 : 0)))).filter(n => stats.has(n)).length

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 20px' }}>
        <button className="tap" onClick={() => setPickKey(true)} style={{ height: 48, padding: '0 16px', borderRadius: 12, border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink2)' }}>오늘의 조</span>
          <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--accentText)' }}>{key} / {MINORS[KEYS.indexOf(key)]}</span>
        </button>
        <span className="caption">{touched} / 48칸 연습함</span>
        <button className="btn primary sm" style={{ marginLeft: 'auto', height: 48 }} onClick={() => nav.startPractice({ refType: 'scale', queue: scaleQueue(key) })}>
          <PlayIcon size={18} /> 오늘의 조 4개
        </button>
      </div>

      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '92px repeat(4, minmax(0, 1fr))', gap: 6, fontSize: 12, color: 'var(--ink3)', padding: '4px 0 8px' }}>
          <span>조</span>
          {COLS.map(c => <span key={c.label}>{c.label}</span>)}
        </div>
        {KEYS.map((k, i) => {
          const isToday = k === key
          return (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '92px repeat(4, minmax(0, 1fr))', gap: 6, alignItems: 'center', padding: '4px 0', borderTop: '1px solid var(--line)' }}>
              <span className="serif" style={{ fontSize: 17, fontWeight: 600, color: isToday ? 'var(--accentText)' : undefined }}>
                {k} <span style={{ color: isToday ? 'var(--accentText)' : 'var(--ink3)' }}>/ {MINORS[i]}</span>
              </span>
              {COLS.map(c => {
                const no = scaleNo(c.kind, i + (c.minor ? 12 : 0))
                const st = stats.get(no)
                const stale = st?.last ? daysAgo(st.last) >= 14 : false
                return (
                  <button
                    key={no}
                    className="tap"
                    onClick={() => nav.startPractice({ refType: 'scale', queue: [no] })}
                    style={{ height: 52, borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, ...heat(level(st?.best ?? 0)), ...(stale ? { borderColor: 'var(--alert)', borderStyle: 'solid' } : isToday && !st ? { borderColor: 'var(--accent)' } : {}) }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 600 }}>{st?.best ?? '—'}</span>
                    <span style={{ fontSize: 11, fontWeight: stale ? 600 : 400, color: stale ? 'var(--alert)' : 'inherit', opacity: stale ? 1 : 0.75 }}>{st ? agoLabel(st.last) : ''}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 2px', fontSize: 13, color: 'var(--ink2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--alert)' }} />14일 이상 안 침</span>
        <span>칸 색 = 최고 클린 BPM</span>
      </div>
      {pickKey && <KeySheet onClose={() => setPickKey(false)} />}
    </>
  )
}

export function Basics() {
  const nav = useNav()
  const entries = useEntries()
  const settings = useSettings()
  const [book, setBook] = useState<ScoreBook | 'scale'>('hanon')
  const [mode, setMode] = useState<'bpm' | 'cov'>('bpm')
  const [pickKey, setPickKey] = useState(false)
  const stats = useMemo(() => (book === 'scale' ? new Map<number, ExerciseStat>() : exerciseStats(entries, book)), [entries, book])
  const key = todayKey(settings, entries)
  const items = book === 'scale' ? [] : bookItems(book, settings.pischnaSplits)

  return (
    <div className="screen">
      <div className="screen-inner" style={{ gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingTop: 4 }}>
          <h1 className="page-title" style={{ margin: 0 }}>기초</h1>
          <div style={{ marginLeft: 'auto' }}>
            <Segmented value={book} onChange={setBook} options={[{ value: 'hanon', label: '하농' }, { value: 'pischna', label: '피쉬나' }, { value: 'scale', label: '스케일·아르페지오' }]} />
          </div>
        </div>

        {book === 'scale' ? (
          <ScaleMatrix />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 24px' }}>
              {book === 'hanon' ? (
                <>
                  <button className="tap" onClick={() => setPickKey(true)} style={{ height: 48, padding: '0 16px', borderRadius: 12, border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink2)' }}>오늘의 조</span>
                    <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--accentText)' }}>{key}</span>
                  </button>
                  <span className="caption">21–30번 · 12조 완료 {items.filter(it => coverage(stats.get(it.no)) === 12).length} / {items.length}</span>
                  <div style={{ marginLeft: 'auto' }}>
                    <Segmented value={mode} onChange={setMode} options={[{ value: 'bpm', label: 'BPM 보기' }, { value: 'cov', label: '조 커버리지' }]} />
                  </div>
                </>
              ) : (
                <>
                  <span className="caption">시작 {items.filter(it => stats.has(it.no)).length} / {items.length} · a·b 나눔은 설정에서</span>
                  <span className="caption" style={{ marginLeft: 'auto' }}>칸 색 = 최고 클린 BPM</span>
                </>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${book === 'hanon' ? 5 : 10}, minmax(0, 1fr))`, gap: book === 'hanon' ? 12 : 8 }}>
              {items.map(it => (
                <Cell key={it.no} item={it} stat={stats.get(it.no)} mode={book === 'hanon' ? mode : 'bpm'} big={book === 'hanon'} onClick={() => nav.openPage({ kind: 'detail', book, no: it.no })} />
              ))}
            </div>

            {book === 'hanon' && mode === 'cov' ? (
              <div style={{ padding: '24px 2px 8px', display: 'flex', gap: 18, fontSize: 13, color: 'var(--ink2)' }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>연습한 조 / 12</span>
                <span>링이 꽉 차면 12조 모두 1회 이상</span>
              </div>
            ) : (
              <Legend hanon={book === 'hanon'} />
            )}
          </>
        )}
      </div>
      {pickKey && <KeySheet onClose={() => setPickKey(false)} />}
    </div>
  )
}
