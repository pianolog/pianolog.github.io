import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, StarIcon } from './Icon'

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="sheet-inner">
          <div className="grab" />
          {children}
        </div>
      </div>
    </>
  )
}

export function SheetHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginTop: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span className="sheet-title">{title}</span>
        {sub && <span style={{ fontSize: 14, color: 'var(--ink3)' }}>{sub}</span>}
      </div>
      <button className="btn icon" style={{ marginLeft: 'auto', color: 'var(--ink2)' }} onClick={onClose} aria-label="닫기">
        <Icon name="close" width={1.8} />
      </button>
    </div>
  )
}

export function StatusIcon({ status }: { status: 'done' | 'prog' | 'pend' }) {
  return (
    <div className={`st ${status}`}>
      {status === 'done' && <Icon name="check" size={16} width={3} />}
    </div>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, large }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; large?: boolean }) {
  return (
    <div className={`seg${large ? ' lg' : ''}`}>
      {options.map(o => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2, marginLeft: -6 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} onClick={() => onChange(i === value ? 0 : i)} style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', color: i <= value ? 'var(--accent)' : 'var(--ink3)' }} aria-label={`${i}점`}>
          <StarIcon filled={i <= value} />
        </button>
      ))}
    </div>
  )
}

export function BpmStepper({ label, hint, value, onChange, accent }: { label: string; hint?: string; value: number; onChange: (v: number) => void; accent?: boolean }) {
  const btn = { width: 60, height: 60, borderRadius: 14, background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 } as const
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 16, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="sec-label">{label}</span>
        {hint && <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="tap" style={btn} onClick={() => onChange(Math.max(20, value - 1))}>−</button>
        <span style={{ fontSize: 48, fontWeight: 600, color: accent ? 'var(--accentText)' : undefined }}>{value}</span>
        <button className="tap" style={btn} onClick={() => onChange(Math.min(300, value + 1))}>+</button>
      </div>
    </div>
  )
}

// ── 토스트 ──

export interface ToastAction {
  label: string
  run: () => void
}

const ToastCtx = createContext<(msg: string, action?: ToastAction) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; action?: ToastAction } | null>(null)
  const timer = useRef<number>(0)
  const show = useCallback((text: string, action?: ToastAction) => {
    setMsg({ text, action })
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), action ? 5000 : 2200)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast">
          {msg.text}
          {msg.action && (
            <button
              className="toast-action"
              onClick={() => {
                msg.action!.run()
                setMsg(null)
              }}
            >
              {msg.action.label}
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
