import { useMemo, useState } from 'react'
import { BOOK_SIZE, HANON_PARTS, type Book } from '../data/exercises'
import { Segmented } from '../components/ui'
import { useEntries, useSettings } from '../lib/hooks'
import { coverage, exerciseStats, todayKey, type ExerciseStat } from '../lib/stats'
import { useNav } from '../nav'

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
    <svg width="20" height="20" viewBox="0 0 26 26" style={{ transform: 'rotate(-90deg)', color: 'var(--accent)', flex: 'none' }}>
      <circle cx="13" cy="13" r="10" fill="none" strokeWidth="3.5" style={{ stroke: 'var(--line)' }} />
      <circle cx="13" cy="13" r="10" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray={`${((n / 12) * 62.83).toFixed(1)} 62.83`} strokeLinecap="round" />
    </svg>
  )
}

function Cell({ no, stat, mode, onClick }: { no: number; stat?: ExerciseStat; mode: 'bpm' | 'cov'; onClick: () => void }) {
  const cov = coverage(stat)
  const style = mode === 'bpm' ? heat(level(stat?.best ?? 0)) : stat ? { background: 'var(--s1)', border: '1.5px solid transparent', color: 'var(--ink)' } : heat(0)
  const main = mode === 'bpm' ? stat?.best || '—' : cov ? `${cov}/12` : stat ? '·' : '—'
  return (
    <button className="tap" onClick={onClick} style={{ height: 92, borderRadius: 10, padding: '7px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{no}</span>
        {mode === 'cov' && cov > 0 && <Ring n={cov} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: mode === 'bpm' ? 22 : 17, fontWeight: 600 }}>{main}</span>
      </div>
    </button>
  )
}

export function Basics() {
  const nav = useNav()
  const entries = useEntries()
  const settings = useSettings()
  const [book, setBook] = useState<Book | 'scale'>('hanon')
  const [mode, setMode] = useState<'bpm' | 'cov'>('bpm')
  const stats = useMemo(() => (book === 'scale' ? new Map() : exerciseStats(entries, book)), [entries, book])
  const key = todayKey(settings.todayKeyMode, entries)

  const parts = book === 'hanon' ? HANON_PARTS : [{ label: '', from: 1, to: BOOK_SIZE }]

  return (
    <div className="screen">
      <div className="screen-inner" style={{ gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingTop: 4 }}>
          <h1 className="page-title" style={{ margin: 0 }}>기초</h1>
          <div style={{ marginLeft: 'auto' }}>
            <Segmented value={book} onChange={setBook} options={[{ value: 'hanon', label: '하농' }, { value: 'pischna', label: '피쉬나' }, { value: 'scale', label: '스케일' }]} />
          </div>
        </div>

        {book === 'scale' ? (
          <div className="empty" style={{ marginTop: 60 }}>
            스케일·아르페지오 24조 매트릭스는 2단계에서 추가돼요.
            <br />
            지금은 루틴에 자유 항목(예: "스케일 E♭")으로 넣어서 기록하세요.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 24px' }}>
              {book === 'hanon' && (
                <div style={{ height: 48, padding: '0 16px', borderRadius: 12, border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink2)' }}>오늘의 조</span>
                  <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--accentText)' }}>{key}</span>
                </div>
              )}
              <div style={{ marginLeft: 'auto' }}>
                {book === 'hanon' ? (
                  <Segmented value={mode} onChange={setMode} options={[{ value: 'bpm', label: 'BPM 보기' }, { value: 'cov', label: '조 커버리지' }]} />
                ) : (
                  <span className="caption">칸 색 = 최고 클린 BPM</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
              {parts.map(p => {
                const nums = Array.from({ length: p.to - p.from + 1 }, (_, i) => p.from + i)
                const full = nums.filter(n => coverage(stats.get(n)) === 12).length
                const started = nums.filter(n => stats.has(n)).length
                return (
                  <div key={p.from} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {p.label && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 2px' }}>
                        <span className="serif" style={{ fontSize: 20, fontWeight: 600 }}>{p.label}</span>
                        <span className="caption">{p.from}–{p.to}</span>
                        <span className="caption" style={{ marginLeft: 'auto' }}>12조 완료 {full} · 시작 {started}/{nums.length}</span>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 8 }}>
                      {nums.map(n => (
                        <Cell key={n} no={n} stat={stats.get(n)} mode={book === 'hanon' ? mode : 'bpm'} onClick={() => nav.openPage({ kind: 'detail', book, no: n })} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ padding: '28px 2px 8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 18px', fontSize: 13, color: 'var(--ink2)' }}>
              {mode === 'bpm' || book !== 'hanon' ? (
                <>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>최고 클린 BPM (♩{book === 'hanon' ? ', 12조 중' : ''})</span>
                  {LEGEND.map((l, i) => (
                    <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 26, height: 16, borderRadius: 4, ...heat(i) }} />
                      {l}
                    </span>
                  ))}
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>연습한 조 / 12</span>
                  <span>링이 꽉 차면 12조 모두 1회 이상</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
