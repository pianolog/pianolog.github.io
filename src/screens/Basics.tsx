import { useMemo, useState } from 'react'
import { CHROMATIC, HANON_KEY_ORDER, dominantOf, KEYS, MINORS, bookItems, isArpeggio, scaleNo, type BookItem, type ScoreBook } from '../data/exercises'
import { PlayIcon } from '../components/Icon'
import { Segmented } from '../components/ui'
import { useEntries, useSettings } from '../lib/hooks'
import { coverage, exerciseStats, todayKey, type ExerciseStat } from '../lib/stats'
import { agoLabel, daysAgo } from '../lib/time'
import { useNav } from '../nav'
import { KeySheet } from './KeySheet'
import { SrsBar } from './SrsBar'
import { cardQueue, useCards } from '../lib/cards'
import { cardId, type Card } from '../lib/db'
import { dueLabel } from '../lib/repertoire'
import type { Srs } from '../lib/srs'
import { CircleSheet } from './CircleSheet'

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

function srsText(c: Srs | undefined) {
  if (!c || c.state === 'new') return null
  if (c.suspended) return '쉬는 중'
  return dueLabel(c.due).text
}

/** 스케일·아르페지오 칸 하나 */
function ScaleCell({ no, label, sub, stat, today, cards, wide }: { no: number; label: string; sub?: string; stat?: ExerciseStat; today: boolean; cards: Map<string, Card>; wide?: boolean }) {
  const nav = useNav()
  const stale = stat?.last ? daysAgo(stat.last) >= 14 : false
  const c = cards.get(cardId('scale', no))?.srs
  const next = srsText(c)
  return (
    <button
      className="tap"
      onClick={() => nav.startPractice({ refType: 'scale', queue: [no] })}
      style={{ height: 88, borderRadius: 12, padding: '9px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', gridColumn: wide ? 'span 2' : undefined, ...heat(level(stat?.best ?? 0)), ...(stale ? { border: '1.5px solid var(--alert)' } : today ? { border: '2px solid var(--accent)' } : {}) }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, width: '100%' }}>
        <span className="serif" style={{ fontSize: 19, fontWeight: 600 }}>{label}</span>
        {sub && <span style={{ fontSize: 11, opacity: 0.7 }}>{sub}</span>}
        {next && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: c?.leech ? 'var(--alert)' : next === '오늘' || next.endsWith('지남') ? 'var(--accentText)' : 'inherit', opacity: next === '오늘' || next.endsWith('지남') ? 1 : 0.7, whiteSpace: 'nowrap' }}>{next}</span>}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', width: '100%' }}>
        <span style={{ fontSize: 22, fontWeight: 600 }}>{stat?.best || '—'}</span>
        <span style={{ fontSize: 11, fontWeight: stale ? 600 : 400, color: stale ? 'var(--alert)' : 'inherit', opacity: stale ? 1 : 0.75 }}>{stat ? agoLabel(stat.last) : ''}</span>
      </span>
    </button>
  )
}

function Section({ title, sub, onStart, children }: { title: string; sub: string; onStart?: () => void; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '16px 16px 18px' }}>
      <div className="card-head" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>
          {title}
          <span className="sub" style={{ fontSize: 13 }}>{sub}</span>
        </span>
        {onStart && (
          <button className="link" onClick={onStart}>
            오늘의 조부터 ▶
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

/** 하농 3부 기준 스케일(39·40) / 아르페지오(41·42·43) */
function ScaleBook({ arp }: { arp: boolean }) {
  const nav = useNav()
  const entries = useEntries()
  const settings = useSettings()
  const cards = useCards()
  const stats = useMemo(() => exerciseStats(entries, 'scale'), [entries])
  const key = todayKey(settings, entries)
  const ki = KEYS.indexOf(key)
  const [pickKey, setPickKey] = useState(false)
  const [circle, setCircle] = useState(false)
  const kind = arp ? 1 : 0
  // 하농 39·41 순서 (C, a, G, e …), 오늘의 조부터 돌린 순서
  const main = HANON_KEY_ORDER.map(i => scaleNo(kind, i))
  const fromToday = (list: number[], first: number) => [...list.slice(list.indexOf(first)), ...list.slice(0, list.indexOf(first))]
  const sevenths = (k: 3 | 4) => KEYS.map((_, i) => scaleNo(k, i))
  const all = arp ? [...main, ...sevenths(3), ...sevenths(4)] : [...main, CHROMATIC]
  const touched = all.filter(n => stats.has(n)).length
  const isTodayKey = (i: number) => i === ki || i === ki + 12

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 18px', flexWrap: 'wrap' }}>
        <button className="tap" onClick={() => setPickKey(true)} style={{ height: 48, padding: '0 16px', borderRadius: 12, border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink2)' }}>오늘의 조</span>
          <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--accentText)' }}>{key} / {MINORS[ki]}</span>
        </button>
        <span className="caption">{touched} / {all.length}칸 연습함</span>
        <button className="btn sm" style={{ marginLeft: 'auto', height: 48 }} onClick={() => setCircle(true)}>
          5도권 묶음
        </button>
        <button className="btn primary sm" style={{ height: 48 }} onClick={() => nav.startPractice({ refType: 'scale', queue: [scaleNo(kind, ki), scaleNo(kind, ki + 12)] })}>
          <PlayIcon size={18} /> {key}·{MINORS[ki]} {arp ? '아르페지오' : '스케일'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Section title={arp ? '하농 41 · 아르페지오' : '하농 39 · 스케일'} sub="24조 · 장조 다음 관계 단조" onStart={() => nav.startPractice({ refType: 'scale', queue: fromToday(main, scaleNo(kind, ki)) })}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
            {HANON_KEY_ORDER.map(i => {
              const no = scaleNo(kind, i)
              return <ScaleCell key={no} no={no} label={i < 12 ? KEYS[i] : MINORS[i - 12]} sub={i < 12 ? '장조' : '단조'} stat={stats.get(no)} today={isTodayKey(i)} cards={cards} />
            })}
          </div>
        </Section>

        {arp ? (
          ([3, 4] as const).map(k => (
            <Section key={k} title={k === 3 ? '하농 42 · 속7화음 아르페지오' : '하농 43 · 감7화음 아르페지오'} sub="12조" onStart={() => nav.startPractice({ refType: 'scale', queue: fromToday(sevenths(k), scaleNo(k, ki)) })}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
                {KEYS.map((kk, i) => {
                  const no = scaleNo(k, i)
                  return <ScaleCell key={no} no={no} label={kk} sub={k === 3 ? `${dominantOf(i)}7` : 'dim7'} stat={stats.get(no)} today={i === ki} cards={cards} />
                })}
              </div>
            </Section>
          ))
        ) : (
          <Section title="하농 40 · 반음계" sub="반음계 스케일">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
              <ScaleCell no={CHROMATIC} label="반음계" stat={stats.get(CHROMATIC)} today={false} cards={cards} wide />
            </div>
          </Section>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 2px', fontSize: 13, color: 'var(--ink2)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid var(--accent)' }} />오늘의 조</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--alert)' }} />14일 이상 안 침</span>
        <span>칸 색 = 최고 클린 BPM · 오른쪽 위 = 다음 복습</span>
      </div>
      {pickKey && <KeySheet onClose={() => setPickKey(false)} />}
      {circle && <CircleSheet onClose={() => setCircle(false)} />}
    </>
  )
}

export function Basics() {
  const nav = useNav()
  const entries = useEntries()
  const settings = useSettings()
  const [book, setBook] = useState<ScoreBook | 'scale' | 'arpeggio'>('hanon')
  const [mode, setMode] = useState<'bpm' | 'cov'>('bpm')
  const [pickKey, setPickKey] = useState(false)
  const stats = useMemo(() => (book === 'scale' || book === 'arpeggio' ? new Map<number, ExerciseStat>() : exerciseStats(entries, book)), [entries, book])
  const key = todayKey(settings, entries)
  const items = book === 'scale' || book === 'arpeggio' ? [] : bookItems(book, settings.pischnaSplits)
  const cards = useCards()
  const srsBook = book === 'arpeggio' ? 'scale' : book
  // 스케일 탭에는 스케일 카드만, 아르페지오 탭에는 아르페지오 카드만
  const due = useMemo(
    () => cardQueue(srsBook, cards, { splits: settings.pischnaSplits, key, settings }).filter(c => srsBook !== 'scale' || isArpeggio(c.no) === (book === 'arpeggio')),
    [srsBook, book, cards, settings, key]
  )

  return (
    <div className="screen">
      <div className="screen-inner" style={{ gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingTop: 4 }}>
          <h1 className="page-title" style={{ margin: 0 }}>기초</h1>
          <div style={{ marginLeft: 'auto' }}>
            <Segmented value={book} onChange={setBook} options={[{ value: 'hanon', label: '하농' }, { value: 'pischna', label: '피쉬나' }, { value: 'scale', label: '스케일' }, { value: 'arpeggio', label: '아르페지오' }]} />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <SrsBar book={srsBook} items={due} />
        </div>

        {book === 'scale' || book === 'arpeggio' ? (
          <ScaleBook key={book} arp={book === 'arpeggio'} />
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
