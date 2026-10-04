import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BOOK_NAME, KEYS, PISCHNA_SIZE, bookItems, type ScoreBook } from '../data/exercises'
import { Icon } from '../components/Icon'
import { Segmented, Sheet, SheetHead, useToast } from '../components/ui'
import { db, saveSetting, type BookMap } from '../lib/db'
import { exportBackup, importBackup } from '../lib/backup'
import { useSettings } from '../lib/hooks'
import { forgetScore } from '../lib/pdf'
import { useNav } from '../nav'
import { PdfUploadButton } from './ScorePicker'

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>{label}</span>
        {sub && <span className="caption">{sub}</span>}
      </div>
      {children}
    </div>
  )
}

export function SettingsPage() {
  const nav = useNav()
  const toast = useToast()
  const s = useSettings()
  const scores = useLiveQuery(() => db.scores.orderBy('createdAt').reverse().toArray(), [], [])
  const [mapping, setMapping] = useState<ScoreBook | null>(null)
  const [splitting, setSplitting] = useState(false)
  const [usage, setUsage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void navigator.storage?.estimate?.().then(e => setUsage(`${((e.usage ?? 0) / 1048576).toFixed(1)}MB 사용 중`))
  }, [scores.length])

  const removeScore = async (id: number, name: string) => {
    if (!window.confirm(`"${name}" 악보를 iPad에서 지울까요?`)) return
    forgetScore(id)
    await db.scores.delete(id)
    for (const b of ['hanonBook', 'pischnaBook'] as const) if (s[b].scoreId === id) await saveSetting(b, { ...s[b], scoreId: null })
  }

  return (
    <div className="screen">
      <div className="screen-inner">
        <div>
          <button className="back" onClick={nav.closePage}>
            <Icon name="left" size={20} width={1.8} />
            오늘
          </button>
          <h1 className="page-title">설정</h1>
        </div>

        <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <Row label="하루 목표 시간">
            <Segmented value={s.dailyGoalMin} onChange={v => saveSetting('dailyGoalMin', v)} options={[60, 120, 180, 240, 300].map(m => ({ value: m, label: `${m / 60}시간` }))} />
          </Row>
          <Row label="오늘의 조" sub="하농 조옮김·스케일 기준 · 「오늘」에서 오늘만 바꿀 수도 있어요">
            <Segmented value={s.todayKeyMode} onChange={v => saveSetting('todayKeyMode', v)} options={[{ value: 'cycle', label: '5도권 순환' }, { value: 'stale', label: '오래 안 친 조' }, { value: 'fixed', label: '직접 고르기' }]} />
          </Row>
          {s.todayKeyMode === 'fixed' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 6, padding: '12px 0 14px', borderBottom: '1px solid var(--line)' }}>
              {KEYS.map(k => (
                <button key={k} className={`keychip tap${s.fixedKey === k ? ' on' : ''}`} style={{ height: 52, fontSize: 17 }} onClick={() => saveSetting('fixedKey', k)}>
                  {k}
                </button>
              ))}
            </div>
          )}
          <Row label="템포 사다리 간격">
            <Segmented value={s.ladderStep} onChange={v => saveSetting('ladderStep', v)} options={[2, 4, 6, 8].map(n => ({ value: n, label: `+${n}` }))} />
          </Row>
          <Row label="테마">
            <Segmented value={s.theme} onChange={v => saveSetting('theme', v)} options={[{ value: 'system', label: '시스템' }, { value: 'dark', label: '다크' }, { value: 'light', label: '라이트' }]} />
          </Row>
        </div>

        <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <div className="card-head" style={{ paddingTop: 14 }}>
            <span className="t">간격 복습<span className="sub">Anki 방식 · 다시 / 어려움 / 됨 / 쉬움</span></span>
          </div>
          <Row label="레퍼토리 하루 복습" sub="오늘 할 구간 중 복습 최대 개수">
            <Segmented value={s.dailyReviewMax} onChange={v => saveSetting('dailyReviewMax', v)} options={[4, 6, 8, 10, 15].map(n => ({ value: n, label: `${n}개` }))} />
          </Row>
          <Row label="레퍼토리 하루 새 구간" sub="처음 연습하는 구간">
            <Segmented value={s.repNewPerDay} onChange={v => saveSetting('repNewPerDay', v)} options={[0, 1, 2, 3, 5].map(n => ({ value: n, label: `${n}개` }))} />
          </Row>
          <Row label="기초 하루 복습" sub="하농·피쉬나·스케일 책마다">
            <Segmented value={s.cardReviewMax} onChange={v => saveSetting('cardReviewMax', v)} options={[5, 10, 15, 20].map(n => ({ value: n, label: `${n}개` }))} />
          </Row>
          <Row label="기초 하루 새 카드" sub="책마다 · 하농은 번호×조가 카드 하나">
            <Segmented value={s.cardNewPerDay} onChange={v => saveSetting('cardNewPerDay', v)} options={[0, 1, 2, 3, 5].map(n => ({ value: n, label: `${n}개` }))} />
          </Row>
          <Row label="최대 간격" sub="잘 되는 것도 이 기간 안에는 다시 나와요">
            <Segmented value={s.maxIvl} onChange={v => saveSetting('maxIvl', v)} options={[30, 60, 90, 180].map(n => ({ value: n, label: `${n}일` }))} />
          </Row>
          <Row label="고질 기준" sub="복습 중 '다시'를 이만큼 누르면 고질로 표시">
            <Segmented value={s.leechAt} onChange={v => saveSetting('leechAt', v)} options={[4, 6, 8].map(n => ({ value: n, label: `${n}번` }))} />
          </Row>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="t">하농·피쉬나 악보<span className="sub">책 PDF 연결 + 번호별 페이지</span></span>
          </div>
          {(['hanon', 'pischna'] as ScoreBook[]).map(b => {
            const map = b === 'hanon' ? s.hanonBook : s.pischnaBook
            const sc = scores.find(x => x.id === map.scoreId)
            const items = bookItems(b, s.pischnaSplits)
            const mapped = items.filter(it => map.pages[it.no]).length
            return (
              <Row key={b} label={BOOK_NAME[b]} sub={sc ? `${sc.name} · ${mapped}/${items.length} 번호 페이지 지정` : '연결된 PDF 없음'}>
                <button className="btn sm" onClick={() => setMapping(b)}>{sc ? '편집' : '연결'}</button>
              </Row>
            )
          })}
        </div>

        <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <Row label="피쉬나 a·b 번호" sub={s.pischnaSplits.length ? `${[...s.pischnaSplits].sort((a, b) => a - b).join(', ')}번을 a·b로 나눔` : '나눈 번호 없음 (1–60)'}>
            <button className="btn sm" onClick={() => setSplitting(true)}>편집</button>
          </Row>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="t">악보 보관함<span className="sub">{usage}</span></span>
            <PdfUploadButton />
          </div>
          {scores.length === 0 && <div className="empty">파일 앱·iCloud Drive의 PDF를 추가하면 오프라인에서도 열 수 있어요.</div>}
          {scores.map(sc => (
            <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <Icon name="book" />
              <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{sc.name}</span>
              <span className="caption">{sc.pageCount}쪽</span>
              <button className="btn sm" onClick={() => nav.openScore(sc.id!, 1)}>열기</button>
              <button className="btn icon sm" style={{ color: 'var(--alert)' }} onClick={() => removeScore(sc.id!, sc.name)} aria-label="삭제"><Icon name="trash" /></button>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-head">
            <span className="t">백업<span className="sub">기록은 이 iPad 안에만 저장돼요</span></span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            <button className="btn" onClick={() => exportBackup().catch(() => toast('내보내지 못했어요'))}>
              <Icon name="download" /> 기록 내보내기 (JSON)
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" /> 가져오기
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async e => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f || !window.confirm('지금 기록을 백업 파일 내용으로 바꿀까요? 되돌릴 수 없어요.')) return
                try {
                  const r = await importBackup(f)
                  toast(`${r.entries}개 기록을 가져왔어요`)
                } catch (err) {
                  toast((err as Error).message || '가져오지 못했어요')
                }
              }}
            />
          </div>
          <div className="caption" style={{ marginTop: 12, lineHeight: 1.6 }}>
            내보내기를 누르면 공유 시트가 열려요 → "파일에 저장"으로 iCloud Drive에 보관하세요. 악보 PDF와 런스루 녹음은 백업에 포함되지 않아요.
          </div>
        </div>
      </div>

      {mapping && <BookMapSheet book={mapping} splits={s.pischnaSplits} value={mapping === 'hanon' ? s.hanonBook : s.pischnaBook} onClose={() => setMapping(null)} />}
      {splitting && <SplitSheet value={s.pischnaSplits} onClose={() => setSplitting(false)} />}
    </div>
  )
}

function BookMapSheet({ book, splits, value, onClose }: { book: ScoreBook; splits: number[]; value: BookMap; onClose: () => void }) {
  const items = bookItems(book, splits)
  const scores = useLiveQuery(() => db.scores.orderBy('createdAt').reverse().toArray(), [], [])
  const [scoreId, setScoreId] = useState(value.scoreId)
  const [pages, setPages] = useState<Record<number, number>>(value.pages)
  const [first, setFirst] = useState(value.pages[items[0].no] ?? 1)
  const [per, setPer] = useState(1)
  const toast = useToast()
  const max = scores.find(x => x.id === scoreId)?.pageCount ?? 999

  const autofill = () => {
    const out: Record<number, number> = {}
    items.forEach((it, i) => (out[it.no] = Math.min(max, first + i * per)))
    setPages(out)
  }

  const save = async () => {
    await saveSetting(book === 'hanon' ? 'hanonBook' : 'pischnaBook', { scoreId, pages })
    toast('저장됨')
    onClose()
  }

  const num = (v: string) => {
    const n = parseInt(v.replace(/\D/g, ''), 10)
    return Number.isNaN(n) ? 0 : n
  }

  return (
    <Sheet onClose={onClose}>
      <SheetHead title={`${BOOK_NAME[book]} 악보 연결`} sub="책 한 권짜리 PDF를 고르고, 각 번호가 시작하는 페이지를 적어요." onClose={onClose} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18, alignItems: 'center' }}>
        {scores.map(sc => (
          <button key={sc.id} className={`pick${sc.id === scoreId ? ' on' : ''}`} onClick={() => setScoreId(sc.id!)}>
            {sc.name}
          </button>
        ))}
        <PdfUploadButton onAdded={setScoreId} />
      </div>

      <div style={{ marginTop: 22, background: 'var(--bg)', borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="sec-label">빠르게 채우기</span>
        <span className="caption">{items[0].label}번이</span>
        <input className="field" inputMode="numeric" value={first || ''} onChange={e => setFirst(num(e.target.value))} style={{ width: 70, height: 48, textAlign: 'center', background: 'var(--s1)' }} />
        <span className="caption">쪽, 번호당</span>
        <input className="field" inputMode="numeric" value={per || ''} onChange={e => setPer(num(e.target.value))} style={{ width: 60, height: 48, textAlign: 'center', background: 'var(--s1)' }} />
        <span className="caption">쪽</span>
        <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={autofill}>채우기</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 6, marginTop: 16 }}>
        {items.map(({ no: n, label }) => (
          <label key={n} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>{label}번</span>
            <input
              className="field"
              inputMode="numeric"
              value={pages[n] || ''}
              onChange={e => {
                const v = num(e.target.value)
                setPages(p => {
                  const x = { ...p }
                  if (v) x[n] = Math.min(max, v)
                  else delete x[n]
                  return x
                })
              }}
              style={{ height: 44, padding: 0, textAlign: 'center', fontWeight: 600 }}
            />
          </label>
        ))}
      </div>

      <button className="btn primary" style={{ marginTop: 22, height: 64 }} onClick={save} disabled={!scoreId}>
        저장
      </button>
    </Sheet>
  )
}

function SplitSheet({ value, onClose }: { value: number[]; onClose: () => void }) {
  const [sel, setSel] = useState<number[]>(value)
  const toast = useToast()
  const toggle = (n: number) => setSel(x => (x.includes(n) ? x.filter(v => v !== n) : [...x, n]))
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="피쉬나 a·b 번호" sub="기본값은 Schirmer 판 기준(1·2·5·6·15·16·20번)이에요. 쓰는 악보가 다르면 고치세요." onClose={onClose} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 6, marginTop: 18 }}>
        {Array.from({ length: PISCHNA_SIZE }, (_, i) => i + 1).map(n => (
          <button key={n} className={`pick tap${sel.includes(n) ? ' on' : ''}`} style={{ padding: 0, height: 56, flexDirection: 'column', gap: 0 }} onClick={() => toggle(n)}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>{n}</span>
            {sel.includes(n) && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accentText)' }}>a · b</span>}
          </button>
        ))}
      </div>
      <div className="caption" style={{ marginTop: 14, lineHeight: 1.6 }}>
        이미 기록이 있는 번호를 나누면, 나누기 전 기록은 상세 화면에서 따로 보이지 않을 수 있어요. 처음에 한 번 정해 두는 걸 권해요.
      </div>
      <button
        className="btn primary"
        style={{ marginTop: 22, height: 64 }}
        onClick={async () => {
          await saveSetting('pischnaSplits', [...sel].sort((a, b) => a - b))
          toast('저장됨')
          onClose()
        }}
      >
        저장
      </button>
    </Sheet>
  )
}
