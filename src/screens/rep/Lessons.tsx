import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead } from '../../components/ui'
import { db, type Lesson, type LessonItem } from '../../lib/db'
import { pieceName, uid, useRepData } from '../../lib/repertoire'
import { dateKey, parseDateKey, shortDate } from '../../lib/time'

export function Lessons() {
  const { lessons, pieces, sections } = useRepData()
  const [edit, setEdit] = useState<Lesson | 'new' | null>(null)
  const label = (it: LessonItem) => {
    const p = pieces.find(x => x.id === it.pieceId)
    const s = sections.find(x => x.id === it.sectionId)
    return [p?.title, s?.label].filter(Boolean).join(' · ')
  }
  const toggle = (l: Lesson, id: string) => db.lessons.update(l.id!, { items: l.items.map(it => (it.id === id ? { ...it, resolved: !it.resolved } : it)) })
  const open = lessons.reduce((a, l) => a + l.items.filter(i => !i.resolved).length, 0)

  return (
    <>
      <div className="card">
        <div className="card-head">
          <span className="t">레슨노트<span className="sub">{open ? `미해결 ${open}개` : ''}</span></span>
          <button className="link" onClick={() => setEdit('new')}>+ 레슨 기록</button>
        </div>
        {lessons.length === 0 && <div className="empty">레슨에서 들은 지적을 곡·구간에 붙여 두면, 그 구간을 연습할 때 화면 위에 떠요.</div>}
        {lessons.map(l => (
          <div key={l.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{shortDate(parseDateKey(l.date))}</span>
              <button className="link" style={{ marginLeft: 'auto', fontSize: 14 }} onClick={() => setEdit(l)}>편집</button>
            </div>
            {l.items.map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
                <button onClick={() => toggle(l, it.id)} className={`st ${it.resolved ? 'done' : 'pend'}`} style={{ width: 24, height: 24, marginTop: 1 }} aria-label={it.resolved ? '미해결로' : '해결로'}>
                  {it.resolved && <Icon name="check" size={14} width={3} />}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 15, lineHeight: 1.45, color: it.resolved ? 'var(--ink3)' : undefined, textDecoration: it.resolved ? 'line-through' : 'none' }}>{it.text}</span>
                  {label(it) && <span style={{ fontSize: 12, color: 'var(--accentText)', fontWeight: 600 }}>{label(it)}</span>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {edit && <LessonSheet lesson={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  )
}

export function LessonSheet({ lesson, onClose }: { lesson?: Lesson; onClose: () => void }) {
  const { pieces, sections } = useRepData()
  const [date, setDate] = useState(lesson?.date ?? dateKey())
  const [items, setItems] = useState<LessonItem[]>(lesson?.items ?? [{ id: uid(), text: '', resolved: false }])
  const set = (id: string, p: Partial<LessonItem>) => setItems(xs => xs.map(x => (x.id === id ? { ...x, ...p } : x)))
  const live = pieces.filter(p => !p.archived)
  const valid = items.some(i => i.text.trim())

  const save = async () => {
    const clean = items.filter(i => i.text.trim()).map(i => ({ ...i, text: i.text.trim() }))
    if (!clean.length) return
    if (lesson?.id) await db.lessons.update(lesson.id, { date, items: clean })
    else await db.lessons.add({ date, items: clean })
    onClose()
  }

  const sel = { height: 48, background: 'var(--s1)', fontSize: 15, padding: '0 10px' } as const

  return (
    <Sheet onClose={onClose}>
      <SheetHead title={lesson ? '레슨 기록' : '레슨 기록 추가'} sub="지적마다 곡·구간을 붙여 두면 그 구간 연습 화면에 떠요." onClose={onClose} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
        <span className="sec-label">날짜</span>
        <input className="field" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 200 }} />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
        {items.map((it, i) => (
          <div key={it.id} style={{ background: 'var(--bg)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ width: 22, color: 'var(--ink3)', fontWeight: 600, paddingTop: 16 }}>{i + 1}</span>
              <input className="field" style={{ background: 'var(--s1)' }} placeholder="예) 왼손 아르페지오는 손목 회전으로, 레가토 끊기지 않게" value={it.text} onChange={e => set(it.id, { text: e.target.value })} />
              <button className="btn icon" style={{ color: 'var(--ink3)', background: 'transparent' }} onClick={() => setItems(xs => xs.filter(x => x.id !== it.id))} aria-label="지우기"><Icon name="trash" /></button>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingLeft: 32 }}>
              <select className="field" style={{ ...sel, flex: 1.4 }} value={it.pieceId ?? ''} onChange={e => set(it.id, { pieceId: e.target.value ? Number(e.target.value) : undefined, sectionId: undefined })}>
                <option value="">곡 (선택)</option>
                {live.map(p => <option key={p.id} value={p.id}>{pieceName(p)}</option>)}
              </select>
              <select className="field" style={{ ...sel, flex: 1 }} value={it.sectionId ?? ''} disabled={!it.pieceId} onChange={e => set(it.id, { sectionId: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">구간 (선택)</option>
                {sections.filter(s => s.pieceId === it.pieceId).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => setItems(xs => [...xs, { id: uid(), text: '', resolved: false, pieceId: xs[xs.length - 1]?.pieceId }])}>
          <Icon name="plus" /> 지적 추가
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        {lesson && <button className="btn" style={{ color: 'var(--alert)' }} onClick={async () => { if (window.confirm('이 레슨 기록을 지울까요?')) { await db.lessons.delete(lesson.id!); onClose() } }}><Icon name="trash" /></button>}
        <button className="btn primary" style={{ flex: 1, height: 60 }} disabled={!valid} onClick={save}>저장</button>
      </div>
    </Sheet>
  )
}
