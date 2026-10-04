import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon, PlayIcon } from '../../components/Icon'
import { useToast } from '../../components/ui'
import { db, type Section } from '../../lib/db'
import { ddayLabel, openLessons, reachText, recommend, sectionDue, STAGES, useRepData, type Tag } from '../../lib/repertoire'
import { clock, dateKey, parseDateKey, shortDate } from '../../lib/time'
import { useNav } from '../../nav'
import { ScorePicker } from '../ScorePicker'
import { Dot, PieceSheet, SectionSheet, StageBars } from './RepSheets'

export const TAG_STYLE: Record<Tag['kind'], React.CSSProperties> = {
  weak: { fontSize: 12, fontWeight: 600, color: 'var(--alert)', border: '1px solid var(--alert)', borderRadius: 6, padding: '2px 7px' },
  lesson: { fontSize: 12, fontWeight: 600, color: 'var(--accentText)', border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 7px' },
  plain: { fontSize: 12, fontWeight: 500, color: 'var(--ink2)', background: 'var(--s2)', borderRadius: 6, padding: '3px 8px' },
  over: { fontSize: 12, fontWeight: 600, color: 'var(--alert)', background: 'color-mix(in oklch, var(--alert) 14%, var(--s1))', borderRadius: 6, padding: '3px 8px' }
}

const DUE_COLOR = { over: 'var(--alert)', today: 'var(--accentText)', later: 'var(--ink3)' }

export function PieceDetail({ pieceId }: { pieceId: number }) {
  const nav = useNav()
  const toast = useToast()
  const { pieces, sections, ddays, lessons, lists } = useRepData()
  const runs = useLiveQuery(() => db.runs.where('pieceId').equals(pieceId).reverse().sortBy('createdAt'), [pieceId], [])
  const [edit, setEdit] = useState(false)
  const [sec, setSec] = useState<Section | 'new' | null>(null)
  const [picking, setPicking] = useState(false)
  const piece = pieces.find(p => p.id === pieceId)
  if (!piece) return <div className="screen"><div className="screen-inner"><button className="back" onClick={nav.closePage}><Icon name="left" size={20} />레퍼토리</button></div></div>

  const secs = sections.filter(s => s.pieceId === pieceId)
  const picks = recommend(sections, pieces, ddays, lessons, { limit: 4, newMax: 2, minutes: 40, pieceId })
  const total = picks.reduce((a, p) => a + p.minutes, 0)
  const d = ddays.find(x => x.pieceIds.includes(pieceId) && x.date >= dateKey())
  const pieceLists = piece.listIds.map(id => lists.find(l => l.id === id)).filter(Boolean)

  const openScore = () => (piece.scoreId ? nav.openScore(piece.scoreId, 1) : setPicking(true))
  const archive = async () => {
    await db.pieces.update(pieceId, { archived: piece.archived ? 0 : 1 })
    toast(piece.archived ? '복원했어요' : '아카이브했어요 — 기록은 그대로 남아요')
    if (!piece.archived) nav.closePage()
  }
  const remove = async () => {
    if (!window.confirm(`"${piece.title}"과 구간을 모두 지울까요? 연습 기록은 남아요.`)) return
    await db.transaction('rw', db.pieces, db.sections, async () => {
      await db.sections.where('pieceId').equals(pieceId).delete()
      await db.pieces.delete(pieceId)
    })
    nav.closePage()
  }

  return (
    <div className="screen">
      <div className="screen-inner">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="back" onClick={nav.closePage}>
            <Icon name="left" size={20} width={1.8} />
            레퍼토리
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <button onClick={() => setEdit(true)} className="page-title" style={{ textAlign: 'left' }}>
                {[piece.composer, piece.title].filter(Boolean).join(' ')}
              </button>
              {piece.opus && <span style={{ fontSize: 15, color: 'var(--ink3)' }}>{piece.opus}</span>}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flex: 'none' }}>
              <button className="btn s1" style={{ height: 52 }} onClick={openScore}>
                <Icon name="book" width={1.6} /> 악보
              </button>
              <button className="btn s1" style={{ height: 52 }} onClick={() => nav.startRun(pieceId)}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--alert)' }} /> 런스루
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {pieceLists.map(l => (
              <span key={l!.id} className="chip" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}><Dot color={l!.color} />{l!.name}</span>
            ))}
            {d && <span className="chip" style={{ fontSize: 13, fontWeight: 600 }}>{d.title} {ddayLabel(d.date)}</span>}
            {piece.scoreId ? <button className="chip" style={{ fontSize: 13 }} onClick={() => setPicking(true)}>악보 바꾸기</button> : null}
            {runs[0] && <span className="caption" style={{ marginLeft: 'auto' }}>최근 런스루 {shortDate(parseDateKey(runs[0].date))} · {clock(runs[0].durationSec)} · 마킹 {runs[0].marks.length}</span>}
          </div>
        </div>

        <div className="card" style={{ padding: '18px 12px 12px' }}>
          <div className="card-head" style={{ padding: '0 12px' }}>
            <span className="t">오늘 할 구간<span className="sub">{picks.length ? `${picks.length}개 · ${total}분 · 자동 추천` : ''}</span></span>
          </div>
          {picks.length === 0 && <div className="empty" style={{ padding: 18 }}>오늘 복습할 구간이 없어요. 구간을 눌러 바로 연습할 수도 있어요.</div>}
          {picks.map((p, i) => (
            <button key={p.section.id} onClick={() => nav.startPractice({ refType: 'section', queue: [p.section.id!] })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, minHeight: 60, padding: '4px 12px', textAlign: 'left' }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: p.doneToday ? 'var(--ok)' : 'var(--s2)', color: p.doneToday ? 'var(--bg)' : 'var(--ink2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flex: 'none' }}>
                {p.doneToday ? <Icon name="check" size={16} width={3} /> : i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span className="serif" style={{ fontSize: 17, fontWeight: 600 }}>{p.section.label}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{p.tags.map(t => <span key={t.text} style={TAG_STYLE[t.kind]}>{t.text}</span>)}</div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink2)' }}>{p.minutes}분</span>
            </button>
          ))}
          {picks.length > 0 && (
            <button className="tap" onClick={() => nav.startPractice({ refType: 'section', queue: picks.filter(p => !p.doneToday).map(p => p.section.id!) })} style={{ marginTop: 8, width: '100%', height: 64, borderRadius: 16, background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px' }}>
              <PlayIcon size={24} />
              <span style={{ fontSize: 19, fontWeight: 700 }}>오늘 구간 연습 시작</span>
              <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 500 }}>{picks.find(p => !p.doneToday)?.section.label ?? ''}부터 · {total}분</span>
            </button>
          )}
        </div>

        <div className="card" style={{ padding: '16px 20px 8px' }}>
          <div className="card-head">
            <span style={{ fontSize: 17, fontWeight: 600 }}>구간<span className="sub" style={{ fontSize: 13 }}>{secs.length}개</span></span>
            <button className="link" onClick={() => setSec('new')}>+ 구간 추가</button>
          </div>
          {secs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 170px 92px 84px', gap: 12, fontSize: 12, color: 'var(--ink3)', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span>구간</span><span>단계</span><span style={{ textAlign: 'right' }}>BPM</span><span style={{ textAlign: 'right' }}>다음 복습</span>
            </div>
          )}
          {secs.length === 0 && <div className="empty" style={{ padding: 18 }}>마디 단위로 구간을 만들어 두세요. (예: m.1–16)</div>}
          {secs.map(s => {
            const due = sectionDue(s)
            const nLesson = openLessons(lessons, s.id!).length
            return (
              <button key={s.id} onClick={() => setSec(s)} style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 170px 92px 84px', gap: 12, alignItems: 'center', minHeight: 54, borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span className="serif" style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>
                    {s.srs.leech && <span style={{ ...TAG_STYLE.weak, fontSize: 11, padding: '1px 6px' }}>어려운 곳</span>}
                    {s.weak && <span style={{ ...TAG_STYLE.weak, fontSize: 11, padding: '1px 6px' }}>취약</span>}
                    {nLesson > 0 && <span style={{ ...TAG_STYLE.lesson, fontSize: 11, padding: '1px 6px' }}>레슨 {nLesson}</span>}
                  </div>
                  {(s.note || reachText(s)) && <span style={{ fontSize: 12, color: 'var(--ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[reachText(s), s.note].filter(Boolean).join(' · ')}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <StageBars stage={s.stage} />
                  <span style={{ fontSize: 12, color: s.stage === 5 ? 'var(--ok)' : 'var(--ink2)' }}>{STAGES[s.stage]}</span>
                </div>
                <span style={{ textAlign: 'right', fontSize: 16, fontWeight: 600 }}>{s.bpm}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink3)' }}> / {s.targetBpm}</span></span>
                <span style={{ textAlign: 'right', fontSize: 14, fontWeight: due.kind === 'later' ? 500 : 700, color: DUE_COLOR[due.kind] }}>{due.text}</span>
              </button>
            )
          })}
        </div>

        <div className="card">
          <div className="card-head">
            <span style={{ fontSize: 17, fontWeight: 600 }}>런스루<span className="sub" style={{ fontSize: 13 }}>통주 녹음 · 걸린 곳 마킹</span></span>
            <button className="link" onClick={() => nav.startRun(pieceId)}>+ 런스루 시작</button>
          </div>
          {runs.length === 0 && <div className="empty" style={{ padding: 18 }}>통으로 쳐 보며 걸린 곳을 표시하면, 그 구간이 취약으로 잡혀요.</div>}
          {runs.map(r => (
            <button key={r.id} onClick={() => nav.openPage({ kind: 'run', runId: r.id! })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--line)', textAlign: 'left', fontSize: 15 }}>
              <span style={{ width: 120, color: 'var(--ink2)' }}>{shortDate(parseDateKey(r.date))}</span>
              <span style={{ fontWeight: 600 }}>{clock(r.durationSec)}</span>
              <span style={{ color: 'var(--ink3)' }}>마킹 {r.marks.length}</span>
              {!r.reviewed && r.marks.length > 0 && <span style={TAG_STYLE.lesson}>정리 안 함</span>}
              <Icon name="right" size={20} style={{ marginLeft: 'auto', color: 'var(--ink3)' }} />
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn sm" onClick={() => setEdit(true)}>곡 정보</button>
          <button className="btn sm" onClick={archive}>{piece.archived ? '아카이브에서 복원' : '아카이브'}</button>
          <button className="btn sm" style={{ color: 'var(--alert)' }} onClick={remove}><Icon name="trash" /></button>
        </div>
      </div>

      {edit && <PieceSheet piece={piece} onClose={() => setEdit(false)} />}
      {sec && <SectionSheet section={sec === 'new' ? undefined : sec} pieceId={pieceId} nextOrder={secs.length ? Math.max(...secs.map(s => s.order)) + 1 : 0} onClose={() => setSec(null)} onPractice={id => { setSec(null); nav.startPractice({ refType: 'section', queue: [id] }) }} />}
      {picking && (
        <ScorePicker
          title={`${piece.title} 악보`}
          onClose={() => setPicking(false)}
          onPick={async (id, page) => {
            await db.pieces.update(pieceId, { scoreId: id })
            setPicking(false)
            nav.openScore(id, page)
          }}
        />
      )}
    </div>
  )
}
