import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon } from '../components/Icon'
import { Sheet, SheetHead, useToast } from '../components/ui'
import { db } from '../lib/db'
import { addScore } from '../lib/pdf'

export function PdfUploadButton({ onAdded, label = 'PDF 추가' }: { onAdded?: (id: number) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        hidden
        onChange={async e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setBusy(true)
          try {
            const id = (await addScore(f)) as number
            toast(`${f.name} 추가됨`)
            onAdded?.(id)
          } catch {
            toast('PDF를 읽지 못했어요')
          } finally {
            setBusy(false)
          }
        }}
      />
      <button className="btn" onClick={() => ref.current?.click()} disabled={busy}>
        <Icon name="upload" /> {busy ? '불러오는 중…' : label}
      </button>
    </>
  )
}

/** 악보 PDF 고르기 (+ 시작 페이지) */
export function ScorePicker({ title, onPick, onClose }: { title: string; onPick: (id: number, page: number) => void; onClose: () => void }) {
  const scores = useLiveQuery(() => db.scores.orderBy('createdAt').reverse().toArray(), [], [])
  const [sel, setSel] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const chosen = scores.find(s => s.id === sel)
  return (
    <Sheet onClose={onClose}>
      <SheetHead title={title} sub="iPad에 저장된 악보에서 고르거나 파일 앱에서 새로 추가하세요." onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
        {scores.length === 0 && <div className="empty">아직 저장된 악보가 없어요.</div>}
        {scores.map(s => (
          <button key={s.id} onClick={() => { setSel(s.id!); setPage(1) }} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 56, borderBottom: '1px solid var(--line)', textAlign: 'left', color: sel === s.id ? 'var(--accentText)' : undefined }}>
            <Icon name="book" />
            <span style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{s.name}</span>
            <span className="caption">{s.pageCount}쪽</span>
          </button>
        ))}
      </div>
      {chosen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <span className="sec-label">시작 페이지</span>
          <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))}>−</button>
          <span style={{ fontSize: 28, fontWeight: 600, width: 60, textAlign: 'center' }}>{page}</span>
          <button className="btn" onClick={() => setPage(p => Math.min(chosen.pageCount, p + 1))}>+</button>
          <span className="caption">/ {chosen.pageCount}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
        <PdfUploadButton onAdded={id => { setSel(id); setPage(1) }} />
        <button className="btn primary" style={{ flex: 1 }} disabled={!chosen} onClick={() => chosen && onPick(chosen.id!, page)}>
          이 악보 열기
        </button>
      </div>
    </Sheet>
  )
}
