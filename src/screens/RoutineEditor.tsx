import { useState } from 'react'
import { HANON_FROM, bookItems, circleQueue, type ScoreBook } from '../data/exercises'
import { CircleSheet } from './CircleSheet'
import { Icon } from '../components/Icon'
import { Segmented, Sheet, SheetHead } from '../components/ui'
import { db, type RoutineType } from '../lib/db'
import { useRoutine, useSettings } from '../lib/hooks'
import { routineLabel } from '../lib/stats'

function NumBox({ value, onChange, min = 1, max = 240, w = 72 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; w?: number }) {
  return (
    <input
      className="field"
      inputMode="numeric"
      value={value || ''}
      onChange={e => {
        const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
        onChange(Number.isNaN(n) ? 0 : Math.min(max, Math.max(0, n)))
      }}
      onBlur={() => onChange(Math.min(max, Math.max(min, value || min)))}
      style={{ width: w, textAlign: 'center', fontSize: 18, fontWeight: 600, height: 52, background: 'var(--s1)' }}
    />
  )
}

const selectStyle = { width: 96, height: 52, background: 'var(--s1)', fontSize: 18, fontWeight: 600, textAlign: 'center' } as const

export function RoutineEditor({ onClose }: { onClose: () => void }) {
  const routine = useRoutine()
  const settings = useSettings()
  const [type, setType] = useState<RoutineType>('hanon')
  const [from, setFrom] = useState(HANON_FROM)
  const [to, setTo] = useState(HANON_FROM + 4)
  const items = type === 'hanon' || type === 'pischna' ? bookItems(type, settings.pischnaSplits) : []

  const changeType = (t: RoutineType) => {
    setType(t)
    if (t === 'hanon' || t === 'pischna') {
      const list = bookItems(t as ScoreBook, settings.pischnaSplits)
      setFrom(list[0].no)
      setTo(list[Math.min(4, list.length - 1)].no)
    }
  }
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(15)
  const [scaleMode, setScaleMode] = useState(0) // 0 오늘의 조, 1 5도권 묶음, 2 간격 복습
  const [srs, setSrs] = useState(false) // 하농·피쉬나: 범위 대신 간격 복습
  const [circle, setCircle] = useState(false)

  const valid = type === 'free' ? title.trim().length > 0 : type === 'scale' || type === 'rep' ? true : to >= from

  const add = async () => {
    if (!valid) return
    const order = routine.length ? Math.max(...routine.map(r => r.order)) + 1 : 0
    const ranged = (type === 'hanon' || type === 'pischna') && !srs
    const useSrs = ((type === 'hanon' || type === 'pischna') && srs) || (type === 'scale' && scaleMode === 2)
    await db.routine.add({ order, refType: type, from: ranged ? from : type === 'scale' && !useSrs ? scaleMode : 0, to: ranged ? to : 0, title: type === 'free' ? title.trim() : '', minutes: minutes || 5, srs: useSrs || undefined })
    setTitle('')
  }

  const move = async (i: number, d: -1 | 1) => {
    const a = routine[i]
    const b = routine[i + d]
    if (!a || !b) return
    await db.transaction('rw', db.routine, async () => {
      await db.routine.update(a.id!, { order: b.order })
      await db.routine.update(b.id!, { order: a.order })
    })
  }

  return (
    <Sheet onClose={onClose}>
      <SheetHead title="루틴 편집" sub="매일 하는 연습 순서. 오늘 화면에서 위에서부터 진행돼요." onClose={onClose} />

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
        {routine.length === 0 && <div className="empty" style={{ padding: 20 }}>아직 항목이 없어요. 아래에서 추가하세요.</div>}
        {routine.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ width: 28, color: 'var(--ink3)', fontWeight: 600, textAlign: 'center' }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{routineLabel(r)}</span>
            <span style={{ color: 'var(--ink2)', width: 52, textAlign: 'right' }}>{r.minutes}분</span>
            <button className="btn icon sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로"><Icon name="up" /></button>
            <button className="btn icon sm" onClick={() => move(i, 1)} disabled={i === routine.length - 1} aria-label="아래로"><Icon name="up" style={{ transform: 'rotate(180deg)' }} /></button>
            <button className="btn icon sm" style={{ color: 'var(--alert)' }} onClick={() => db.routine.delete(r.id!)} aria-label="삭제"><Icon name="trash" /></button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 22, background: 'var(--bg)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="sec-label">항목 추가</span>
        <Segmented
          large
          value={type}
          onChange={changeType}
          options={[
            { value: 'hanon', label: '하농' },
            { value: 'pischna', label: '피쉬나' },
            { value: 'scale', label: '스케일·아르페지오' },
            { value: 'rep', label: '레퍼토리' },
            { value: 'free', label: '자유 (곡 등)' }
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {type === 'free' ? (
            <input className="field" placeholder="예) 쇼팽 에튀드 Op.10 No.4" value={title} onChange={e => setTitle(e.target.value)} style={{ flex: 1, minWidth: 240, background: 'var(--s1)' }} />
          ) : type === 'scale' ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Segmented value={scaleMode} onChange={setScaleMode} options={[{ value: 0, label: '오늘의 조 4개' }, { value: 1, label: '5도권 묶음' }, { value: 2, label: '간격 복습' }]} />
              {scaleMode === 2 && <span className="caption">복습할 조 + 새 조 (하루 한도)</span>}
              {scaleMode === 1 && <button className="link" onClick={() => setCircle(true)}>묶음 편집 ({circleQueue(settings.scaleSet).length}항목)</button>}
            </div>
          ) : type === 'rep' ? (
            <span style={{ flex: 1, fontSize: 15, color: 'var(--ink2)' }}>앱이 고른 오늘 할 구간 (복습일·취약·레슨 지적·D-day 기준)</span>
          ) : (
            <>
              <Segmented value={srs ? 1 : 0} onChange={v => setSrs(v === 1)} options={[{ value: 0, label: '번호 범위' }, { value: 1, label: '간격 복습' }]} />
              {srs ? (
                <span className="caption">{type === 'hanon' ? '복습할 번호×조 + 새 카드 (하루 한도)' : '복습할 번호 + 새 번호 (하루 한도)'}</span>
              ) : (
            <>
              <select className="field" value={from} onChange={e => { const n = Number(e.target.value); setFrom(n); if (n > to) setTo(n) }} style={selectStyle}>
                {items.map(it => <option key={it.no} value={it.no}>{it.label}</option>)}
              </select>
              <span style={{ color: 'var(--ink3)' }}>번부터</span>
              <select className="field" value={to} onChange={e => setTo(Number(e.target.value))} style={selectStyle}>
                {items.filter(it => it.no >= from).map(it => <option key={it.no} value={it.no}>{it.label}</option>)}
              </select>
              <span style={{ color: 'var(--ink3)' }}>번까지</span>
            </>
              )}
            </>
          )}
          <span style={{ marginLeft: type === 'hanon' || type === 'pischna' ? 'auto' : 0 }} />
          <NumBox value={minutes} onChange={setMinutes} max={240} />
          <span style={{ color: 'var(--ink3)' }}>분</span>
        </div>
        <button className="btn primary" onClick={add} disabled={!valid}>
          <Icon name="plus" /> 추가
        </button>
      </div>
      {circle && <CircleSheet saveOnly onClose={() => setCircle(false)} />}
    </Sheet>
  )
}
