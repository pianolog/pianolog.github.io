import { useState } from 'react'
import { KEYS, MINORS, SCALE_KINDS, circleQueue, type ScaleSet } from '../data/exercises'
import { PlayIcon } from '../components/Icon'
import { Segmented, Sheet, SheetHead } from '../components/ui'
import { saveSetting } from '../lib/db'
import { useEntries, useSettings } from '../lib/hooks'
import { todayKey } from '../lib/stats'
import { useNav } from '../nav'

const SIZE = 360
const C = SIZE / 2
const R_OUT = 172
const R_MID = 118
const R_IN = 66

function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}

function wedge(r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = polar(r2, a1)
  const [x2, y2] = polar(r2, a2)
  const [x3, y3] = polar(r1, a2)
  const [x4, y4] = polar(r1, a1)
  return `M${x1},${y1} A${r2},${r2} 0 0 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 0 0 ${x4},${y4} Z`
}

/** 5도권 원에서 조를 골라 스케일·아르페지오를 묶어 연습 */
export function CircleSheet({ onClose, saveOnly }: { onClose: () => void; saveOnly?: boolean }) {
  const nav = useNav()
  const settings = useSettings()
  const entries = useEntries()
  const today = KEYS.indexOf(todayKey(settings, entries))
  const [set, setSet] = useState<ScaleSet>(settings.scaleSet)
  const patch = (p: Partial<ScaleSet>) => setSet(s => ({ ...s, ...p }))

  const toggle = (k: number) => {
    const keys = set.keys.includes(k) ? set.keys.filter(x => x !== k) : [...set.keys, k]
    patch({ keys, start: keys.includes(set.start) ? set.start : keys[0] ?? 0 })
  }
  const pick = (keys: number[], start = keys[0]) => patch({ keys, start })
  const fromToday = (n: number) => pick(Array.from({ length: n }, (_, i) => (today + (set.dir === 'cw' ? i : -i) + 12) % 12), today)

  const queue = circleQueue(set)
  const order: number[] = []
  for (let i = 0; i < 12; i++) {
    const k = (set.start + (set.dir === 'cw' ? i : -i) + 12) % 12
    if (set.keys.includes(k)) order.push(k)
  }

  const save = () => saveSetting('scaleSet', set)
  const start = async () => {
    await save()
    onClose()
    nav.startPractice({ refType: 'scale', queue })
  }

  return (
    <Sheet onClose={onClose}>
      <SheetHead title="5도권 묶음" sub="원에서 조를 누르세요. 바깥은 장조, 안쪽은 관계 단조예요." onClose={onClose} />

      <div style={{ display: 'flex', gap: 24, marginTop: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ flex: 'none', maxWidth: '100%', touchAction: 'manipulation' }}>
          {KEYS.map((k, i) => {
            const mid = -90 + i * 30
            const on = set.keys.includes(i)
            const isStart = on && i === set.start
            const fill = on ? 'color-mix(in oklch, var(--accent) 70%, var(--s1))' : 'var(--s2)'
            const fillIn = on ? 'color-mix(in oklch, var(--accent) 40%, var(--s1))' : 'var(--s1)'
            const [tx, ty] = polar((R_OUT + R_MID) / 2, mid)
            const [mx, my] = polar((R_MID + R_IN) / 2, mid)
            return (
              <g key={k} onClick={() => toggle(i)} style={{ cursor: 'pointer' }}>
                <path d={wedge(R_MID, R_OUT, mid - 15, mid + 15)} style={{ fill, stroke: 'var(--bg)' }} strokeWidth={2} />
                <path d={wedge(R_IN, R_MID, mid - 15, mid + 15)} style={{ fill: fillIn, stroke: 'var(--bg)' }} strokeWidth={2} />
                <text x={tx} y={ty + 7} textAnchor="middle" style={{ fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600, fill: on ? 'var(--accentInk)' : 'var(--ink)' }}>{k}</text>
                <text x={mx} y={my + 5} textAnchor="middle" style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, fill: on ? 'var(--accentInk)' : 'var(--ink3)' }}>{MINORS[i]}</text>
                {isStart && <path d={wedge(R_OUT + 2, R_OUT + 8, mid - 13, mid + 13)} style={{ fill: 'var(--ink)' }} />}
                {i === today && <circle cx={polar(R_IN - 12, mid)[0]} cy={polar(R_IN - 12, mid)[1]} r={4} style={{ fill: 'var(--accentText)' }} />}
              </g>
            )
          })}
          <text x={C} y={C - 4} textAnchor="middle" style={{ fontSize: 26, fontWeight: 700, fill: 'var(--ink)' }}>{set.keys.length}</text>
          <text x={C} y={C + 18} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--ink3)' }}>개 조</text>
        </svg>

        <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="sec-label">빠르게 고르기</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button className="pick" style={{ height: 44 }} onClick={() => pick(KEYS.map((_, i) => i), set.keys.includes(set.start) ? set.start : 0)}>전체 12조</button>
              <button className="pick" style={{ height: 44 }} onClick={() => fromToday(3)}>오늘의 조부터 3개</button>
              <button className="pick" style={{ height: 44 }} onClick={() => fromToday(6)}>오늘의 조부터 6개</button>
              <button className="pick" style={{ height: 44 }} onClick={() => pick([0, 1, 2, 3, 4, 5, 6])}>♯ 쪽 (C–F♯)</button>
              <button className="pick" style={{ height: 44 }} onClick={() => pick([0, 11, 10, 9, 8, 7], 0)}>♭ 쪽 (C–D♭)</button>
              <button className="pick" style={{ height: 44, color: 'var(--ink3)' }} onClick={() => pick([], 0)}>지우기</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="sec-label">돌아가는 방향</span>
            <Segmented value={set.dir} onChange={dir => patch({ dir })} options={[{ value: 'cw', label: '5도씩 C→G→D' }, { value: 'ccw', label: '4도씩 C→F→B♭' }]} />
          </div>
          {set.keys.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="sec-label">시작 조</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {set.keys.slice().sort((a, b) => a - b).map(k => (
                  <button key={k} className={`keychip tap${set.start === k ? ' on' : ''}`} style={{ height: 44, width: 52, fontSize: 16 }} onClick={() => patch({ start: k })}>{KEYS[k]}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
        <span className="sec-label">조마다 칠 것</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SCALE_KINDS.map(k => {
            const on = set.kinds.includes(k.id)
            return (
              <button key={k.id} className={`pick${on ? ' on' : ''}`} onClick={() => patch({ kinds: on ? set.kinds.filter(x => x !== k.id) : [...set.kinds, k.id] })}>
                {k.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 18, background: 'var(--bg)', borderRadius: 14, padding: '12px 16px', fontSize: 15, lineHeight: 1.6 }}>
        <span className="serif" style={{ fontWeight: 600 }}>{order.length ? order.map(k => `${KEYS[k]}/${MINORS[k]}`).join(' → ') : '조를 골라 주세요'}</span>
        <span className="caption" style={{ marginLeft: 10 }}>{queue.length}항목</span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button className="btn" style={{ height: 64, flex: saveOnly ? 1 : undefined }} disabled={!queue.length} onClick={async () => { await save(); onClose() }}>
          {saveOnly ? '이 묶음 저장' : '저장만'}
        </button>
        {!saveOnly && (
          <button className="btn primary" style={{ flex: 1, height: 64, fontSize: 18 }} disabled={!queue.length} onClick={start}>
            <PlayIcon size={20} /> {queue.length}항목 연습 시작
          </button>
        )}
      </div>
    </Sheet>
  )
}
