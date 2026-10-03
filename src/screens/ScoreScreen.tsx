import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookmarkIcon, Icon, PauseIcon, PlayIcon } from '../components/Icon'
import { Sheet, SheetHead } from '../components/ui'
import { db } from '../lib/db'
import { metronome, useMetronome } from '../lib/metronome'
import { openScore, renderPage } from '../lib/pdf'

/** 메트로놈을 상단 얇은 바로 줄인 악보 화면 */
export function ScoreScreen({ scoreId, initialPage = 1, title, closeLabel, onClose, extra }: { scoreId: number; initialPage?: number; title?: string; closeLabel: string; onClose: () => void; extra?: ReactNode }) {
  const score = useLiveQuery(() => db.scores.get(scoreId), [scoreId])
  const m = useMetronome()
  const [page, setPage] = useState(initialPage)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [error, setError] = useState('')
  const [marks, setMarks] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const c1 = useRef<HTMLCanvasElement>(null)
  const c2 = useRef<HTMLCanvasElement>(null)
  const pageCount = score?.pageCount ?? 1
  const spread = size.w > size.h * 1.15 // 가로로 돌리면 2페이지 펼침
  const step = spread ? 2 : 1

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 펼침 모드에서는 홀수 페이지가 왼쪽
  const first = spread ? Math.max(1, page - ((page - 1) % 2)) : page

  useEffect(() => {
    if (!size.w || !size.h) return
    let alive = true
    openScore(scoreId)
      .then(async doc => {
        const w = spread ? (size.w - 6) / 2 : size.w
        const tasks = [renderPage(doc, Math.min(first, doc.numPages), c1.current!, w, size.h)]
        if (spread && first + 1 <= doc.numPages) tasks.push(renderPage(doc, first + 1, c2.current!, w, size.h))
        else if (c2.current) c2.current.width = 0
        await Promise.all(tasks)
        if (alive) setError('')
      })
      .catch(e => alive && setError(String(e.message ?? e)))
    return () => {
      alive = false
    }
  }, [scoreId, first, spread, size.w, size.h])

  const go = useCallback((d: number) => setPage(p => Math.min(pageCount, Math.max(1, (spread ? p - ((p - 1) % 2) : p) + d * step))), [pageCount, spread, step])

  // 블루투스 페이지 터너 페달은 키보드 입력으로 들어온다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        go(1)
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        go(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const swipe = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => (swipe.current = { x: e.clientX, y: e.clientY })
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return go(dx < 0 ? 1 : -1)
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const r = boxRef.current!.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      if (x < 0.3) go(-1)
      else if (x > 0.7) go(1)
    }
  }

  const bookmarks = score?.bookmarks ?? []
  const marked = bookmarks.some(b => b.page === first || (spread && b.page === first + 1))
  const toggleMark = () => {
    if (!score) return
    const next = marked ? bookmarks.filter(b => b.page !== first && b.page !== first + 1) : [...bookmarks, { page: first, label: `${first}쪽` }].sort((a, b) => a.page - b.page)
    void db.scores.update(scoreId, { bookmarks: next })
  }

  const pageLabel = spread && first + 1 <= pageCount ? `${first}–${first + 1} / ${pageCount}` : `${first} / ${pageCount}`

  return (
    <div className="full" style={{ zIndex: 35 }}>
      <div style={{ height: 76, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', borderBottom: '1px solid var(--line)', background: 'var(--s1)' }}>
        <button className="btn" style={{ padding: '0 16px', fontSize: 15 }} onClick={onClose}>
          <Icon name={closeLabel === '닫기' ? 'close' : 'expand'} size={20} />
          {closeLabel}
        </button>
        <div style={{ width: 1, height: 36, background: 'var(--line)', margin: '0 4px' }} />
        <button className="btn icon" style={{ fontSize: 24, fontWeight: 500 }} onClick={() => metronome.nudge(-1)}>−</button>
        <div style={{ width: 76, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 32, fontWeight: 600, lineHeight: 1 }}>{m.bpm}</span>
          <span style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>{m.beats}/4</span>
        </div>
        <button className="btn icon" style={{ fontSize: 24, fontWeight: 500 }} onClick={() => metronome.nudge(1)}>+</button>
        <button className="tap" onClick={() => metronome.toggle()} style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }} aria-label={m.playing ? '정지' : '재생'}>
          {m.playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
        </button>
        <div style={{ marginLeft: 'auto' }} />
        {extra}
        <button className="btn icon" style={{ color: marked ? 'var(--accentText)' : 'var(--ink3)' }} onClick={toggleMark} onContextMenu={e => { e.preventDefault(); setMarks(true) }} aria-label="북마크">
          <BookmarkIcon />
        </button>
        <button className="btn sm" onClick={() => setMarks(true)} style={{ fontSize: 14 }}>
          목록
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', padding: '14px 44px 64px' }}>
        <div ref={boxRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ position: 'absolute', inset: '14px 44px 64px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 6, touchAction: 'pan-y' }}>
          <canvas ref={c1} style={{ background: '#fff', boxShadow: '0 2px 14px rgba(0,0,0,.18)' }} />
          <canvas ref={c2} style={{ background: '#fff', boxShadow: '0 2px 14px rgba(0,0,0,.18)', display: spread && first + 1 <= pageCount ? 'block' : 'none' }} />
        </div>
        {error && <div className="empty" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{error}</div>}
        <button onClick={() => go(-1)} style={{ position: 'absolute', left: 8, top: '50%', marginTop: -30, color: 'var(--ink3)', padding: 6 }} aria-label="이전 페이지">
          <svg width="22" height="44" viewBox="0 0 12 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M9 4 3 12l6 8" /></svg>
        </button>
        <button onClick={() => go(1)} style={{ position: 'absolute', right: 8, top: '50%', marginTop: -30, color: 'var(--ink3)', padding: 6 }} aria-label="다음 페이지">
          <svg width="22" height="44" viewBox="0 0 12 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 4l6 8-6 8" /></svg>
        </button>
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', height: 40, padding: '0 18px', borderRadius: 99, background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
          {title && <span className="serif" style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>}
          {title && <span style={{ width: 1, height: 16, background: 'var(--line)' }} />}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink2)' }}>{pageLabel}</span>
        </div>
      </div>

      {marks && (
        <Sheet onClose={() => setMarks(false)}>
          <SheetHead title="북마크" sub={score?.name} onClose={() => setMarks(false)} />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
            {bookmarks.length === 0 && <div className="empty">북마크 아이콘을 누르면 지금 페이지가 저장돼요.</div>}
            {bookmarks.map(b => (
              <div key={b.page} style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
                <button style={{ flex: 1, textAlign: 'left', height: 48, fontSize: 17, fontWeight: 600 }} onClick={() => { setPage(b.page); setMarks(false) }}>
                  {b.page}쪽
                </button>
                <button className="btn icon sm" style={{ color: 'var(--alert)' }} onClick={() => db.scores.update(scoreId, { bookmarks: bookmarks.filter(x => x.page !== b.page) })} aria-label="삭제">
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
          <div className="caption" style={{ marginTop: 14 }}>페이지로 바로 가기</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
              <button key={p} className={`pick${p === first ? ' on' : ''}`} style={{ width: 56, padding: 0 }} onClick={() => { setPage(p); setMarks(false) }}>
                {p}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}
