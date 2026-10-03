import { useState } from 'react'
import { BOOK_SIZE } from '../data/exercises'
import { Icon } from '../components/Icon'
import { Segmented, Sheet, SheetHead } from '../components/ui'
import { db, type RefType } from '../lib/db'
import { useRoutine } from '../lib/hooks'
import { routineLabel } from '../lib/stats'

function NumBox({ value, onChange, min = 1, max = BOOK_SIZE, w = 72 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; w?: number }) {
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

export function RoutineEditor({ onClose }: { onClose: () => void }) {
  const routine = useRoutine()
  const [type, setType] = useState<RefType>('hanon')
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(5)
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(15)

  const valid = type === 'free' ? title.trim().length > 0 : from >= 1 && to >= from && to <= BOOK_SIZE

  const add = async () => {
    if (!valid) return
    const order = routine.length ? Math.max(...routine.map(r => r.order)) + 1 : 0
    await db.routine.add({ order, refType: type, from: type === 'free' ? 0 : from, to: type === 'free' ? 0 : to, title: title.trim(), minutes: minutes || 5 })
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
          onChange={setType}
          options={[
            { value: 'hanon', label: '하농' },
            { value: 'pischna', label: '피쉬나' },
            { value: 'free', label: '자유 (곡·스케일 등)' }
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {type === 'free' ? (
            <input className="field" placeholder="예) 쇼팽 에튀드 Op.10 No.4, 스케일 E♭" value={title} onChange={e => setTitle(e.target.value)} style={{ flex: 1, minWidth: 240, background: 'var(--s1)' }} />
          ) : (
            <>
              <NumBox value={from} onChange={n => { setFrom(n); if (n > to) setTo(n) }} />
              <span style={{ color: 'var(--ink3)' }}>번부터</span>
              <NumBox value={to} onChange={setTo} min={from} />
              <span style={{ color: 'var(--ink3)' }}>번까지</span>
            </>
          )}
          <span style={{ marginLeft: type === 'free' ? 0 : 'auto' }} />
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
