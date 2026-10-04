import { PlayIcon } from '../components/Icon'
import { countStatus, type CardItem } from '../lib/cards'
import type { Book } from '../data/exercises'
import { useNav } from '../nav'

export const BOOK_LABEL: Record<Book, string> = { hanon: '하농', pischna: '피쉬나', scale: '스케일·아르페지오' }

/** 오늘 할 기초 카드 수 + 시작 버튼 */
export function SrsBar({ book, items, plain }: { book: Book; items: CardItem[]; plain?: boolean }) {
  const nav = useNav()
  const n = countStatus(items)
  const pending = items.filter(c => c.status !== 'done')
  const start = () => nav.startPractice({ refType: book, queue: pending.map(c => c.no), keys: pending.map(c => c.key) })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: plain ? '8px 14px' : '12px 14px 12px 20px', borderRadius: 16, background: plain ? 'transparent' : 'var(--s1)', minHeight: 64 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{plain ? BOOK_LABEL[book] : '오늘의 간격 복습'}</span>
        <span style={{ fontSize: 13, color: 'var(--ink2)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>복습 <b style={{ color: 'var(--accentText)' }}>{n.review}</b></span>
          <span>새 카드 <b>{n.new}</b></span>
          {n.again > 0 && <span style={{ color: 'var(--alert)' }}>다시 <b>{n.again}</b></span>}
          {n.done > 0 && <span style={{ color: 'var(--ink3)' }}>끝냄 {n.done}</span>}
        </span>
      </div>
      <button className={`btn sm${pending.length ? ' primary' : ''}`} style={{ marginLeft: 'auto', height: 48, flex: 'none' }} disabled={!pending.length} onClick={start}>
        {pending.length ? (
          <>
            <PlayIcon size={16} /> {pending.length}개 시작
          </>
        ) : (
          '오늘 끝'
        )}
      </button>
    </div>
  )
}
