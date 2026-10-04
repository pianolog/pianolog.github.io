import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PlayIcon } from '../components/Icon'
import { koreanize, norm, partHint, searchCatalog, type CatalogWork } from '../lib/catalog'
import { db } from '../lib/db'
import { useEntries } from '../lib/hooks'
import { pieceName } from '../lib/repertoire'
import { useNav } from '../nav'

interface Suggestion {
  title: string // 자유 연습 제목으로 쓸 이름
  sub: string
  kind: '최근' | '레퍼토리' | '곡 목록'
  hint?: '번' | '악장' | null
}

const catalogTitle = (w: CatalogWork) => {
  const k = koreanize(w.title)
  return [w.ko ?? w.composer, k.title, k.opus].filter(Boolean).join(' ')
}

/** 「오늘」의 자유 연습 카드: 곡 이름으로 바로 시작. 최근 곡·레퍼토리·곡 목록에서 찾기 */
export function FreeStart() {
  const nav = useNav()
  const entries = useEntries()
  const pieces = useLiveQuery(() => db.pieces.filter(p => !p.archived).toArray(), [], [])
  const [free, setFree] = useState('')
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<CatalogWork[]>([])
  const [hint, setHint] = useState<'번' | '악장' | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // 최근에 쓴 자유 연습 제목
  const recent = useMemo(() => {
    const out: string[] = []
    for (let i = entries.length - 1; i >= 0 && out.length < 8; i--) {
      const e = entries[i]
      if (e.refType === 'free' && !out.includes(e.title)) out.push(e.title)
    }
    return out
  }, [entries])

  const q = free.trim()
  useEffect(() => {
    if (!q) return setCatalog([])
    let alive = true
    const t = setTimeout(() => void searchCatalog(q, 8).then(r => alive && setCatalog(r)), 120)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  // 단어마다 이름에 들어 있으면 맞는 것으로 (최근 곡·레퍼토리는 한글 그대로 비교)
  const has = (text: string) => norm(q).trim().split(' ').every(t => norm(text).includes(t))
  const suggestions: Suggestion[] = q
    ? [
        ...recent.filter(has).map(t => ({ title: t, sub: '전에 친 곡', kind: '최근' as const })),
        ...pieces
          .filter(p => has(`${pieceName(p)} ${p.opus}`))
          .map(p => ({ title: pieceName(p), sub: p.opus || '레퍼토리 곡', kind: '레퍼토리' as const })),
        ...catalog.map(w => ({ title: catalogTitle(w), sub: `${w.composer} · ${w.title}`, kind: '곡 목록' as const, hint: partHint(w.title) }))
      ]
        .filter((s, i, all) => all.findIndex(x => x.title === s.title) === i)
        .slice(0, 8)
    : []

  const start = (title: string) => title.trim() && nav.startPractice({ refType: 'free', title: title.trim() })
  const pick = (s: Suggestion) => {
    setOpen(false)
    if (s.hint) {
      // 곡집·소나타는 번호·악장을 덧붙일 수 있게 입력 칸에 넣어 둔다
      setFree(`${s.title} `)
      setHint(s.hint)
      input.current?.focus()
    } else start(s.title)
  }

  return (
    <div className="card">
      <div className="card-head" style={{ marginBottom: 14 }}>
        <span className="t">
          자유 연습<span className="sub">곡·초견·반주 등 · 손·마디별 횟수를 셀 수 있어요</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          ref={input}
          className="field"
          placeholder="곡 이름으로 찾기 · 예) 쇼팽 발라드 1"
          value={free}
          onChange={e => {
            setFree(e.target.value)
            setOpen(true)
            setHint(null)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => e.key === 'Enter' && start(free)}
        />
        <button className="btn primary" onClick={() => start(free)} disabled={!q}>
          <PlayIcon size={20} /> 시작
        </button>
      </div>
      {hint && <span className="caption" style={{ display: 'block', marginTop: 8 }}>{hint === '악장' ? '악장을 덧붙여 쓰세요. 예) 1악장' : '칠 곡 번호를 덧붙여 쓰세요. 예) 2번'} · 그대로 [시작]해도 돼요.</span>}
      {open && suggestions.length > 0 && (
        <div style={{ marginTop: 10, background: 'var(--bg)', borderRadius: 14, padding: '4px 0' }}>
          {suggestions.map(s => (
            <button key={s.title} onClick={() => pick(s)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: s.kind === '곡 목록' ? 'var(--ink3)' : 'var(--accentText)', width: 52, flex: 'none' }}>{s.kind}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{s.title}</span>
                <span style={{ fontSize: 12, color: 'var(--ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {!q && recent.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {recent.map(t => (
            <button key={t} className="pick" onClick={() => start(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
