import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import type { DDay, RepList } from '../lib/db'
import { ddayLabel, pieceName, STAGES, useRepData } from '../lib/repertoire'
import { isDue } from '../lib/srs'
import { dateKey, parseDateKey, shortDate } from '../lib/time'
import { useNav } from '../nav'
import { DdaySheet, Dot, ListSheet, PieceSheet } from './rep/RepSheets'

type Filter = number | 'all' | 'archive'

export function Repertoire() {
  const nav = useNav()
  const { pieces, sections, ddays, lists } = useRepData()
  const [filter, setFilter] = useState<Filter>('all')
  const [listSheet, setListSheet] = useState<RepList | 'new' | null>(null)
  const [pieceSheet, setPieceSheet] = useState(false)
  const [ddaySheet, setDdaySheet] = useState<DDay | 'new' | null>(null)
  const today = dateKey()

  const shown = useMemo(
    () =>
      pieces
        .filter(p => (filter === 'archive' ? p.archived : !p.archived && (filter === 'all' || p.listIds.includes(filter))))
        .sort((a, b) => b.createdAt - a.createdAt),
    [pieces, filter]
  )
  const listById = new Map(lists.map(l => [l.id!, l]))
  const upcoming = ddays.filter(d => d.date >= today)
  const current = typeof filter === 'number' ? listById.get(filter) : undefined

  const chip = (on: boolean): React.CSSProperties => ({
    height: 44,
    padding: '0 16px',
    borderRadius: 99,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 15,
    fontWeight: on ? 600 : 500,
    flex: 'none',
    background: on ? 'var(--ink)' : 'var(--s1)',
    color: on ? 'var(--bg)' : 'var(--ink2)'
  })

  return (
    <div className="screen">
      <div className="screen-inner">
        <div className="page-head">
          <h1 className="page-title">레퍼토리</h1>
          <button className="btn primary sm" style={{ height: 48 }} onClick={() => setPieceSheet(true)}>
            <Icon name="plus" /> 곡 추가
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, margin: '0 calc(-1 * var(--pad))', padding: '0 var(--pad) 2px' }}>
          <button style={chip(filter === 'all')} onClick={() => setFilter('all')}>전체</button>
          {lists.map(l => (
            <button key={l.id} style={chip(filter === l.id)} onClick={() => setFilter(l.id!)} onDoubleClick={() => setListSheet(l)}>
              <Dot color={l.color} /> {l.name}
            </button>
          ))}
          <button style={{ ...chip(false), border: '1.5px dashed var(--line)', background: 'transparent' }} onClick={() => setListSheet('new')}>
            <Icon name="plus" size={18} /> 새 목록
          </button>
          <button style={{ ...chip(filter === 'archive'), marginLeft: 'auto' }} onClick={() => setFilter('archive')}>
            아카이브
          </button>
        </div>
        {current && (
          <button className="link" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setListSheet(current)}>
            "{current.name}" 목록 편집
          </button>
        )}

        {shown.length === 0 && (
          <div className="card empty">
            {filter === 'archive' ? '아카이브한 곡이 없어요.' : '곡을 추가하면 구간으로 나눠서 연습하고, 오늘 할 구간을 추천받을 수 있어요.'}
          </div>
        )}

        {shown.map(p => {
          const secs = sections.filter(s => s.pieceId === p.id)
          const due = secs.filter(s => isDue(s.srs, today)).length
          const weak = secs.filter(s => s.weak).length
          const done = secs.filter(s => s.stage === 5).length
          const d = upcoming.find(x => x.pieceIds.includes(p.id!))
          return (
            <button key={p.id} className="card tap" onClick={() => nav.openPage({ kind: 'piece', pieceId: p.id! })} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="serif" style={{ fontSize: 20, fontWeight: 600 }}>{pieceName(p)}</span>
                  {p.opus && <span className="caption" style={{ fontSize: 14 }}>{p.opus}</span>}
                </div>
                {d && <span className="chip" style={{ fontWeight: 600 }}>{d.title} {ddayLabel(d.date)}</span>}
                {p.scoreId ? <Icon name="book" style={{ color: 'var(--ink3)' }} /> : null}
              </div>
              {secs.length > 0 && (
                <div style={{ display: 'flex', gap: 3 }}>
                  {secs.map(s => (
                    <span key={s.id} title={`${s.label} · ${STAGES[s.stage]}`} style={{ flex: 1, height: 6, borderRadius: 3, background: s.stage === 5 ? 'var(--ok)' : `color-mix(in oklch, var(--accent) ${20 + s.stage * 16}%, var(--s2))`, outline: s.weak ? '1.5px solid var(--alert)' : 'none' }} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: 'var(--ink2)' }}>
                {p.listIds.map(id => listById.get(id)).filter(Boolean).map(l => (
                  <span key={l!.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Dot color={l!.color} />{l!.name}</span>
                ))}
                <span style={{ marginLeft: 'auto' }}>구간 {secs.length}{done ? ` · 완성 ${done}` : ''}</span>
                {due > 0 && <span style={{ color: 'var(--accentText)', fontWeight: 600 }}>오늘 복습 {due}</span>}
                {weak > 0 && <span style={{ color: 'var(--alert)', fontWeight: 600 }}>취약 {weak}</span>}
              </div>
            </button>
          )
        })}

        <div className="card">
          <div className="card-head">
            <span className="t">D-day<span className="sub">이름과 날짜만 있으면 돼요</span></span>
            <button className="link" onClick={() => setDdaySheet('new')}>+ 추가</button>
          </div>
          {ddays.length === 0 && <div className="empty" style={{ padding: 20 }}>실기·연주회·리허설·레슨 날짜를 넣어 두세요.</div>}
          {[...upcoming, ...ddays.filter(d => d.date < today).reverse()].map(d => (
            <button key={d.id} onClick={() => setDdaySheet(d)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderTop: '1px solid var(--line)', textAlign: 'left', opacity: d.date < today ? 0.5 : 1 }}>
              <span style={{ width: 80, fontSize: 22, fontWeight: 700, color: d.date === upcoming[0]?.date ? 'var(--accentText)' : undefined }}>{ddayLabel(d.date)}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{d.title}</span>
                <span className="caption">{shortDate(parseDateKey(d.date))}{d.pieceIds.length ? ` · ${d.pieceIds.map(id => pieces.find(p => p.id === id)?.title).filter(Boolean).join(', ')}` : ''}</span>
              </div>
              {d.pinned && <span className="chip">고정</span>}
            </button>
          ))}
        </div>
      </div>

      {listSheet && <ListSheet list={listSheet === 'new' ? undefined : listSheet} onClose={() => setListSheet(null)} />}
      {pieceSheet && <PieceSheet defaultListId={typeof filter === 'number' ? filter : undefined} onClose={() => setPieceSheet(false)} onCreated={id => nav.openPage({ kind: 'piece', pieceId: id })} />}
      {ddaySheet && <DdaySheet dday={ddaySheet === 'new' ? undefined : ddaySheet} onClose={() => setDdaySheet(null)} />}
    </div>
  )
}
