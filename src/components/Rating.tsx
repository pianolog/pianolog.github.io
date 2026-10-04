import { RATINGS, previewAll, schedule, type Rating, type Srs, type SrsOpts } from '../lib/srs'
import { dateKey } from '../lib/time'

const TONE: Record<Rating, string> = { again: 'var(--alert)', hard: 'var(--ink2)', good: 'var(--accentText)', easy: 'var(--ok)' }

/** Anki식 4단계 평가 — 버튼마다 다음 복습까지의 간격을 미리 보여준다 */
export function RatingButtons({ srs, opts, value, onChange, compact }: { srs: Srs; opts: SrsOpts; value: Rating | null; onChange: (r: Rating) => void; compact?: boolean }) {
  const today = dateKey()
  const pv = previewAll(srs, today, opts)
  const becomesLeech = !srs.leech && schedule(srs, 'again', today, opts).leech
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
        {RATINGS.map(({ r, label }) => {
          const on = value === r
          return (
            <button
              key={r}
              className="tap"
              onClick={() => onChange(r)}
              style={{ height: compact ? 84 : 108, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: on ? 'color-mix(in oklch, var(--accent) 22%, var(--s1))' : 'var(--bg)', border: `2px solid ${on ? 'var(--accent)' : 'transparent'}` }}
            >
              <span style={{ fontSize: compact ? 19 : 22, fontWeight: 700, color: on ? 'var(--ink)' : TONE[r] }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: on ? 'var(--accentText)' : 'var(--ink3)' }}>{pv[r]}</span>
            </button>
          )
        })}
      </div>
      {value === 'again' && becomesLeech && (
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--alert)', padding: '0 4px' }}>
          이번까지 '다시' {opts.leechAt}번 — 어려운 곳으로 표시돼요. 템포를 낮추거나 더 잘게 나눠 보세요.
        </span>
      )}
    </div>
  )
}
