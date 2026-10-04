import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon } from '../../components/Icon'
import { Sheet, SheetHead, useToast } from '../../components/ui'
import { db, type DDay, type Piece, type RepList, type Section } from '../../lib/db'
import { LIST_COLORS, STAGES, newSection, pieceName, sectionDue, splitMeasures } from '../../lib/repertoire'
import { ivlLabel, newSrs, type Srs } from '../../lib/srs'
import { dateKey } from '../../lib/time'
import { koreanize, partHint, searchCatalog, searchOnline, type CatalogWork } from '../../lib/catalog'

const fieldOnSheet = { background: 'var(--bg)' }

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, flex: 'none', display: 'inline-block' }} />
}

export function StageBars({ stage, w = 24 }: { stage: number; w?: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {STAGES.map((_, j) => (
        <span key={j} style={{ width: w, height: 5, borderRadius: 3, background: j < stage ? 'var(--ink3)' : j === stage ? (stage === 5 ? 'var(--ok)' : 'var(--accent)') : 'var(--line)' }} />
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="sec-label">{label}</span>
      {children}
    </label>
  )
}

function Num({ value, onChange, w = 90, onPanel }: { value: number; onChange: (n: number) => void; w?: number; onPanel?: boolean }) {
  return (
    <input
      className="field"
      inputMode="numeric"
      value={value || ''}
      onChange={e => {
        const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
        onChange(Number.isNaN(n) ? 0 : n)
      }}
      style={{ background: onPanel ? 'var(--s1)' : 'var(--bg)', width: w, textAlign: 'center', fontWeight: 600 }}
    />
  )
}

// ── 레퍼토리 목록 ──

export function ListSheet({ list, onClose }: { list?: RepList; onClose: () => void }) {
  const [name, setName] = useState(list?.name ?? '')
  const [color, setColor] = useState(list?.color ?? LIST_COLORS[0])
  const save = async () => {
    if (!name.trim()) return
    if (list?.id) await db.lists.update(list.id, { name: name.trim(), color })
    else {
      const n = await db.lists.count()
      await db.lists.add({ name: name.trim(), color, order: n })
    }
    onClose()
  }
  const remove = async () => {
    if (!list?.id || !window.confirm(`"${list.name}" 목록을 지울까요? 곡은 지워지지 않아요.`)) return
    const pieces = await db.pieces.where('listIds').equals(list.id).toArray()
    await db.transaction('rw', db.pieces, db.lists, async () => {
      for (const p of pieces) await db.pieces.update(p.id!, { listIds: p.listIds.filter(x => x !== list.id) })
      await db.lists.delete(list.id!)
    })
    onClose()
  }
  return (
    <Sheet onClose={onClose}>
      <SheetHead title={list ? '목록 편집' : '새 목록'} sub="예) 이번 실기, 연주회, 반주, 유지곡, 언젠가 칠 곡" onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 22 }}>
        <Field label="이름">
          <input className="field" style={fieldOnSheet} value={name} onChange={e => setName(e.target.value)} placeholder="이번 실기" autoFocus />
        </Field>
        <Field label="색">
          <div style={{ display: 'flex', gap: 10 }}>
            {LIST_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 44, height: 44, borderRadius: '50%', background: c, outline: c === color ? '3px solid var(--ink)' : 'none', outlineOffset: 2 }} aria-label={c} />
            ))}
          </div>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 26 }}>
        {list && <button className="btn" style={{ color: 'var(--alert)' }} onClick={remove}><Icon name="trash" /> 지우기</button>}
        <button className="btn primary" style={{ flex: 1, height: 60 }} disabled={!name.trim()} onClick={save}>저장</button>
      </div>
    </Sheet>
  )
}

// ── 곡 ──

export function PieceSheet({ piece, defaultListId, onClose, onCreated }: { piece?: Piece; defaultListId?: number; onClose: () => void; onCreated?: (id: number) => void }) {
  const lists = useLiveQuery(() => db.lists.orderBy('order').toArray(), [], [])
  const [title, setTitle] = useState(piece?.title ?? '')
  const [composer, setComposer] = useState(piece?.composer ?? '')
  const [opus, setOpus] = useState(piece?.opus ?? '')
  const [memo, setMemo] = useState(piece?.memo ?? '')
  const [listIds, setListIds] = useState<number[]>(piece?.listIds ?? (defaultListId ? [defaultListId] : []))
  const [total, setTotal] = useState(0)
  const [size, setSize] = useState(16)
  const [target, setTarget] = useState(60)
  const toast = useToast()
  // 곡 목록 검색
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogWork[]>([])
  const [online, setOnline] = useState<'idle' | 'loading' | 'none' | 'error'>('idle')
  const [catalog, setCatalog] = useState(piece?.catalog)
  const [base, setBase] = useState('') // 고른 곡의 한글 곡명 (번호·악장 붙이기 전)
  const [part, setPart] = useState('')
  const hint = catalog ? partHint(catalog.title) : null
  useEffect(() => {
    setOnline('idle')
    if (!query.trim()) return setResults([])
    let alive = true
    const t = setTimeout(() => void searchCatalog(query).then(r => alive && setResults(r)), 120)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query])
  const findOnline = async () => {
    setOnline('loading')
    try {
      const r = await searchOnline(query)
      setResults(x => [...x, ...r.filter(w => !x.some(y => y.title === w.title && y.composer === w.composer))])
      setOnline(r.length ? 'idle' : 'none')
    } catch {
      setOnline('error')
    }
  }
  const pick = (w: CatalogWork) => {
    const k = koreanize(w.title)
    setTitle(k.title)
    setBase(k.title)
    setPart('')
    setOpus(k.opus)
    setComposer(w.ko ?? w.composer)
    setCatalog({ composer: w.composer, title: w.title })
    setQuery('')
    setResults([])
  }
  const changePart = (v: string) => {
    setPart(v)
    const n = v.trim()
    // 곡집의 번호를 고르면 "13개의 전주곡" → "전주곡 5번"
    const head = hint === '번' && /^\d+$/.test(n) ? base.replace(/^\d+개의 /, '') : base
    setTitle(n ? `${head} ${/^\d+$/.test(n) ? `${n}${hint ?? '번'}` : n}` : base)
  }

  const save = async () => {
    if (!title.trim()) return
    const data = { title: title.trim(), composer: composer.trim(), opus: opus.trim(), memo: memo.trim(), listIds, catalog }
    if (piece?.id) {
      await db.pieces.update(piece.id, data)
      onClose()
      return
    }
    const id = (await db.pieces.add({ ...data, archived: 0, createdAt: Date.now(), scoreId: null })) as number
    if (total > 0 && size > 0) await db.sections.bulkAdd(splitMeasures(total, size).map((l, i) => newSection(id, i, l, target || 60)))
    toast(`${title.trim()} 추가됨`)
    onClose()
    onCreated?.(id)
  }

  return (
    <Sheet onClose={onClose}>
      <SheetHead title={piece ? '곡 정보' : '곡 추가'} sub="곡명만 있으면 돼요. 악장·곡 단위로 따로 만들어도 좋아요." onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
        {!piece && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="sec-label">곡 찾기 (선택)</span>
            <input className="field" style={fieldOnSheet} value={query} onChange={e => setQuery(e.target.value)} placeholder="예) 쇼팽 발라드 1 · 베토벤 소나타 op 110 · 라흐마니노프 전주곡" autoFocus />
            {query.trim() && (
              <div style={{ maxHeight: 320, overflowY: 'auto', background: 'var(--bg)', borderRadius: 14, padding: '4px 0' }}>
                {results.map(w => {
                  const k = koreanize(w.title)
                  return (
                    <button key={`${w.composer}|${w.title}`} onClick={e => { e.preventDefault(); pick(w) }} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 16, fontWeight: 600 }}>
                        <span style={{ color: 'var(--ink2)', marginRight: 8 }}>{w.ko ?? w.composer}</span>
                        {k.title}
                        {k.opus && <span style={{ color: 'var(--ink3)', fontWeight: 500, marginLeft: 8 }}>{k.opus}</span>}
                        {w.online && <span style={{ fontSize: 11, color: 'var(--accentText)', marginLeft: 8 }}>온라인</span>}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{w.composer} · {w.title}</span>
                    </button>
                  )
                })}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
                  <span className="caption">{results.length ? `${results.length}곡` : '앱 안 목록에 없어요.'}</span>
                  <button className="link" style={{ marginLeft: 'auto', fontSize: 14 }} disabled={online === 'loading'} onClick={e => { e.preventDefault(); void findOnline() }}>
                    {online === 'loading' ? '찾는 중…' : online === 'none' ? '온라인에도 없어요' : online === 'error' ? '인터넷 연결을 확인하세요' : '온라인에서 더 찾기'}
                  </button>
                </div>
              </div>
            )}
            {catalog && !query.trim() && (
              <span className="caption">
                {catalog.composer} · {catalog.title}
                <button className="link" style={{ fontSize: 13, marginLeft: 10 }} onClick={e => { e.preventDefault(); setCatalog(undefined); setBase(''); setPart('') }}>
                  연결 해제
                </button>
              </span>
            )}
          </div>
        )}
        {catalog && hint && base && (
          <Field label={hint === '악장' ? '악장 (선택)' : '번호 (선택)'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input className="field" style={{ ...fieldOnSheet, width: 120 }} inputMode={hint === '번' ? 'numeric' : undefined} value={part} onChange={e => changePart(e.target.value)} placeholder={hint === '악장' ? '예) 1' : '예) 2'} />
              <span className="caption">{hint === '악장' ? '숫자를 넣으면 "1악장"처럼 곡명 뒤에 붙어요.' : '곡집에서 칠 곡 번호. 곡명 뒤에 "2번"처럼 붙어요.'}</span>
            </div>
          </Field>
        )}
        <Field label="곡명 (필수)">
          <input className="field" style={fieldOnSheet} value={title} onChange={e => setTitle(e.target.value)} placeholder="소나타 Op.110 1악장" autoFocus={!!piece} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="작곡가">
            <input className="field" style={fieldOnSheet} value={composer} onChange={e => setComposer(e.target.value)} placeholder="베토벤" />
          </Field>
          <Field label="작품번호·메모">
            <input className="field" style={fieldOnSheet} value={opus} onChange={e => setOpus(e.target.value)} placeholder="A♭ major · Moderato cantabile" />
          </Field>
        </div>
        <Field label="목록 (여러 개 가능)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lists.length === 0 && <span className="caption">레퍼토리 탭에서 목록을 먼저 만들면 여기서 고를 수 있어요.</span>}
            {lists.map(l => {
              const on = listIds.includes(l.id!)
              return (
                <button key={l.id} className={`pick${on ? ' on' : ''}`} style={{ gap: 8 }} onClick={e => { e.preventDefault(); setListIds(x => (on ? x.filter(v => v !== l.id) : [...x, l.id!])) }}>
                  <Dot color={l.color} /> {l.name}
                </button>
              )
            })}
          </div>
        </Field>
        {!piece && (
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="sec-label">구간 자동으로 나누기 (선택)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="caption">총</span>
              <Num value={total} onChange={setTotal} w={80} onPanel />
              <span className="caption">마디를</span>
              <Num value={size} onChange={setSize} w={70} onPanel />
              <span className="caption">마디씩, 목표</span>
              <Num value={target} onChange={setTarget} w={80} onPanel />
              <span className="caption">BPM</span>
            </div>
            {total > 0 && size > 0 && <span className="caption">{splitMeasures(total, size).join(' · ')}</span>}
          </div>
        )}
        <Field label="메모">
          <input className="field" style={fieldOnSheet} value={memo} onChange={e => setMemo(e.target.value)} placeholder="편집본, 운지 출처 등" />
        </Field>
      </div>
      <button className="btn primary" style={{ marginTop: 26, height: 60 }} disabled={!title.trim()} onClick={save}>
        {piece ? '저장' : '곡 추가'}
      </button>
    </Sheet>
  )
}

// ── 구간 ──

export function SectionSheet({ section, pieceId, nextOrder, onClose, onPractice }: { section?: Section; pieceId: number; nextOrder: number; onClose: () => void; onPractice?: (id: number) => void }) {
  const [s, setS] = useState<Section>(section ?? newSection(pieceId, nextOrder, '', 60))
  const set = (p: Partial<Section>) => setS(x => ({ ...x, ...p }))
  const save = async () => {
    if (!s.label.trim()) return
    const data = { ...s, label: s.label.trim(), ladderStart: Math.min(s.ladderStart, s.targetBpm - 4), bpm: Math.min(s.bpm, s.targetBpm) }
    if (section?.id) await db.sections.put(data)
    else await db.sections.add(data)
    onClose()
  }
  const remove = async () => {
    if (!section?.id || !window.confirm(`${section.label} 구간을 지울까요? 연습 기록은 남아요.`)) return
    await db.sections.delete(section.id)
    onClose()
  }
  return (
    <Sheet onClose={onClose}>
      <SheetHead title={section ? '구간' : '구간 추가'} onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
          <Field label="구간 이름">
            <input className="field" style={fieldOnSheet} value={s.label} onChange={e => set({ label: e.target.value })} placeholder="m.33–48" />
          </Field>
          <Field label="메모">
            <input className="field" style={fieldOnSheet} value={s.note} onChange={e => set({ note: e.target.value })} placeholder="왼손 아르페지오" />
          </Field>
        </div>
        <Field label="단계">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 6 }}>
            {STAGES.map((name, i) => (
              <button key={name} className={`pick${s.stage === i ? ' on' : ''}`} style={{ padding: 0, fontSize: 14 }} onClick={e => { e.preventDefault(); set({ stage: i }) }}>
                {name}
              </button>
            ))}
          </div>
        </Field>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="사다리 시작"><Num value={s.ladderStart} onChange={v => set({ ladderStart: v })} /></Field>
          <Field label="지금 BPM"><Num value={s.bpm} onChange={v => set({ bpm: v })} /></Field>
          <Field label="목표 BPM"><Num value={s.targetBpm} onChange={v => set({ targetBpm: v })} /></Field>
          <Field label="연속 성공 기준"><Num value={s.streakGoal} onChange={v => set({ streakGoal: Math.max(1, Math.min(10, v)) })} w={70} /></Field>
          <Field label="악보 페이지"><Num value={s.page ?? 0} onChange={v => set({ page: v || undefined })} w={70} /></Field>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className={`pick${s.weak ? ' on' : ''}`} onClick={e => { e.preventDefault(); set({ weak: !s.weak }) }} style={s.weak ? { borderColor: 'var(--alert)', color: 'var(--alert)', background: 'color-mix(in oklch, var(--alert) 12%, var(--s1))' } : undefined}>
            취약 구간
          </button>
          <span className="caption">취약 구간은 오늘 할 구간에 먼저 들어가요.</span>
        </div>
        {section && <SrsPanel s={s} setSrs={p => set({ srs: { ...s.srs, ...p } })} reset={() => set({ srs: newSrs() })} />}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 26 }}>
        {section && <button className="btn" style={{ color: 'var(--alert)' }} onClick={remove}><Icon name="trash" /></button>}
        {section && onPractice && (
          <button className="btn" onClick={async () => { await save(); onPractice(section.id!) }}>
            저장하고 연습
          </button>
        )}
        <button className="btn primary" style={{ flex: 1, height: 60 }} disabled={!s.label.trim()} onClick={save}>저장</button>
      </div>
    </Sheet>
  )
}

const STATE_LABEL: Record<Srs['state'], string> = { new: '새 구간', learning: '익히는 중', review: '복습 중', relearning: '다시 익히는 중' }

function SrsPanel({ s, setSrs, reset }: { s: Section; setSrs: (p: Partial<Srs>) => void; reset: () => void }) {
  const c = s.srs
  const due = sectionDue(s)
  const stop = (f: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    f()
  }
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className="sec-label">간격 복습</span>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{STATE_LABEL[c.state]}</span>
        {c.leech && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--alert)', border: '1px solid var(--alert)', borderRadius: 6, padding: '1px 6px' }}>어려운 구간</span>}
        <span className="caption" style={{ marginLeft: 'auto' }}>
          다음 {due.text}
          {c.state !== 'new' && ` · 간격 ${ivlLabel(c.ivl)} · 쉬움 정도 ${Math.round(c.ease * 100)}% · 다시 ${c.lapses}번`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="pick" onClick={stop(() => setSrs({ due: dateKey(), suspended: false }))}>오늘 복습으로</button>
        <button className={`pick${c.suspended ? ' on' : ''}`} onClick={stop(() => setSrs({ suspended: !c.suspended }))}>{c.suspended ? '✓ 잠시 쉬는 중' : '잠시 쉬기'}</button>
        {c.leech && <button className="pick" onClick={stop(() => setSrs({ leech: false, lapses: 0 }))}>어려운 곳 해제</button>}
        {c.state !== 'new' && <button className="pick" style={{ color: 'var(--ink3)' }} onClick={stop(() => window.confirm('복습 기록을 지우고 새 구간으로 돌릴까요?') && reset())}>처음부터 다시</button>}
      </div>
      {c.leech && <span className="caption">'다시'가 {c.lapses}번 쌓였어요. 사다리 시작 BPM을 낮추거나, 구간을 더 잘게 나누거나, 레슨에서 물어보세요.</span>}
    </div>
  )
}

// ── D-day ──

export function DdaySheet({ dday, onClose }: { dday?: DDay; onClose: () => void }) {
  const pieces = useLiveQuery(() => db.pieces.filter(p => !p.archived).toArray(), [], [])
  const [title, setTitle] = useState(dday?.title ?? '')
  const [date, setDate] = useState(dday?.date ?? dateKey())
  const [pinned, setPinned] = useState(dday?.pinned ?? true)
  const [pieceIds, setPieceIds] = useState<number[]>(dday?.pieceIds ?? [])
  const save = async () => {
    if (!title.trim() || !date) return
    const data = { title: title.trim(), date, pinned, pieceIds }
    if (dday?.id) await db.ddays.update(dday.id, data)
    else await db.ddays.add(data)
    onClose()
  }
  return (
    <Sheet onClose={onClose}>
      <SheetHead title={dday ? 'D-day 편집' : 'D-day 추가'} sub="이름과 날짜만 있으면 돼요." onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
          <Field label="이름">
            <input className="field" style={fieldOnSheet} value={title} onChange={e => setTitle(e.target.value)} placeholder="기말 실기" autoFocus />
          </Field>
          <Field label="날짜">
            <input className="field" style={fieldOnSheet} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="연결할 곡 (선택) — 날짜가 가까워지면 이 곡 구간이 먼저 추천돼요">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pieces.length === 0 && <span className="caption">아직 곡이 없어요.</span>}
            {pieces.map(p => {
              const on = pieceIds.includes(p.id!)
              return (
                <button key={p.id} className={`pick${on ? ' on' : ''}`} onClick={e => { e.preventDefault(); setPieceIds(x => (on ? x.filter(v => v !== p.id) : [...x, p.id!])) }}>
                  {pieceName(p)}
                </button>
              )
            })}
          </div>
        </Field>
        <button className={`pick${pinned ? ' on' : ''}`} style={{ alignSelf: 'flex-start' }} onClick={e => { e.preventDefault(); setPinned(!pinned) }}>
          {pinned ? '✓ ' : ''}오늘 화면에 고정
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 26 }}>
        {dday && <button className="btn" style={{ color: 'var(--alert)' }} onClick={async () => { await db.ddays.delete(dday.id!); onClose() }}><Icon name="trash" /></button>}
        <button className="btn primary" style={{ flex: 1, height: 60 }} disabled={!title.trim() || !date} onClick={save}>저장</button>
      </div>
    </Sheet>
  )
}
