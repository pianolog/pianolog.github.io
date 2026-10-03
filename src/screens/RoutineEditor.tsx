import { useState } from 'react'
import { HANON_FROM, bookItems, type ScoreBook } from '../data/exercises'
import { Icon } from '../components/Icon'
import { Segmented, Sheet, SheetHead } from '../components/ui'
import { db, type RefType } from '../lib/db'
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
  const [type, setType] = useState<RefType>('hanon')
  const [from, setFrom] = useState(HANON_FROM)
  const [to, setTo] = useState(HANON_FROM + 4)
  const items = type === 'hanon' || type === 'pischna' ? bookItems(type, settings.pischnaSplits) : []

  const changeType = (t: RefType) => {
    setType(t)
    if (t === 'hanon' || t === 'pischna') {
      const list = bookItems(t as ScoreBook, settings.pischnaSplits)
      setFrom(list[0].no)
      setTo(list[Math.min(4, list.length - 1)].no)
    }
  }
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(15)

  const valid = type === 'free' ? title.trim().length > 0 : type === 'scale' ? true : to >= from

  const add = async () => {
    if (!valid) return
    const order = routine.length ? Math.max(...routine.map(r => r.order)) + 1 : 0
    const ranged = type === 'hanon' || type === 'pischna'
    await db.routine.add({ order, refType: type, from: ranged ? from : 0, to: ranged ? to : 0, title: type === 'free' ? title.trim() : '', minutes: minutes || 5 })
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
            { value: 'free', label: '자유 (곡 등)' }
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {type === 'free' ? (
            <input className="field" placeholder="예) 쇼팽 에튀드 Op.10 No.4" value={title} onChange={e => setTitle(e.target.value)} style={{ flex: 1, minWidth: 240, background: 'var(--s1)' }} />
          ) : type === 'scale' ? (
            <span style={{ flex: 1, fontSize: 15, color: 'var(--ink2)' }}>그날의 조로 장조·단조 스케일과 아르페지오 4개</span>
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
          <span style={{ marginLeft: type === 'hanon' || type === 'pischna' ? 'auto' : 0 }} />
          <NumBox value={minutes} onChange={setMinutes} max={240} />
          <span style={{ color: 'var(--ink3)' }}>분</span>
        </div>
        <button className="btn primary" onClick={add} disabled={!valid}>
          <Icon name="plus" /> 추가
        </button>
      </div>
    </Sheet>
  )
}
