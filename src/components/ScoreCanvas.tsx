import { useCallback, useEffect, useRef, useState } from 'react'
import { openScore, renderPage } from '../lib/pdf'

const NEXT = ['ArrowRight', 'ArrowDown', 'PageDown', ' ']
const PREV = ['ArrowLeft', 'ArrowUp', 'PageUp']
const HOLD_MS = 600

/**
 * 런스루용 악보 영역. 넘김은 스와이프·페달, 마킹은 두 번 탭 또는 페달 길게 누르기.
 * (탭 한 번으로는 넘기지 않는다 — 연주 중 실수로 넘어가지 않게)
 */
export function ScoreCanvas({ scoreId, page, pageCount, onPage, onMark }: { scoreId: number; page: number; pageCount: number; onPage: (p: number) => void; onMark: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const c1 = useRef<HTMLCanvasElement>(null)
  const c2 = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const spread = size.w > size.h * 1.15
  const first = spread ? Math.max(1, page - ((page - 1) % 2)) : page

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!size.w || !size.h) return
    void openScore(scoreId).then(async doc => {
      const w = spread ? (size.w - 6) / 2 : size.w
      await renderPage(doc, Math.min(first, doc.numPages), c1.current!, w, size.h)
      if (spread && first + 1 <= doc.numPages) await renderPage(doc, first + 1, c2.current!, w, size.h)
    })
  }, [scoreId, first, spread, size.w, size.h])

  const go = useCallback((d: number) => onPage(Math.min(pageCount, Math.max(1, first + d * (spread ? 2 : 1)))), [first, onPage, pageCount, spread])

  // 페달: 짧게 = 넘김, 길게 = 마킹
  useEffect(() => {
    let timer = 0
    let held = false
    const down = (e: KeyboardEvent) => {
      if (![...NEXT, ...PREV, 'Enter'].includes(e.key)) return
      e.preventDefault()
      if (e.repeat) return
      if (e.key === 'Enter') return onMark()
      held = false
      timer = window.setTimeout(() => {
        held = true
        onMark()
      }, HOLD_MS)
    }
    const up = (e: KeyboardEvent) => {
      if (![...NEXT, ...PREV].includes(e.key)) return
      clearTimeout(timer)
      if (!held) go(NEXT.includes(e.key) ? 1 : -1)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [go, onMark])

  const start = useRef<{ x: number; y: number } | null>(null)
  const lastTap = useRef(0)
  const onUp = (e: React.PointerEvent) => {
    const s = start.current
    start.current = null
    if (!s) return
    const dx = e.clientX - s.x
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) return go(dx < 0 ? 1 : -1)
    const now = Date.now()
    if (now - lastTap.current < 320) {
      lastTap.current = 0
      onMark()
    } else lastTap.current = now
  }

  return (
    <div ref={boxRef} onPointerDown={e => (start.current = { x: e.clientX, y: e.clientY })} onPointerUp={onUp} style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 6, touchAction: 'pan-y' }}>
      <canvas ref={c1} style={{ background: '#fff', boxShadow: '0 2px 14px rgba(0,0,0,.18)' }} />
      <canvas ref={c2} style={{ background: '#fff', boxShadow: '0 2px 14px rgba(0,0,0,.18)', display: spread && first + 1 <= pageCount ? 'block' : 'none' }} />
    </div>
  )
}
