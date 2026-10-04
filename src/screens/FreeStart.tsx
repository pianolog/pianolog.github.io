import { useMemo, useState } from 'react'
import { PlayIcon } from '../components/Icon'
import { useEntries } from '../lib/hooks'
import { useNav } from '../nav'

/** 「오늘」의 자유 연습 카드: 곡 이름으로 바로 시작 */
export function FreeStart() {
  const nav = useNav()
  const entries = useEntries()
  const [free, setFree] = useState('')

  // 최근에 쓴 자유 연습 제목
  const recent = useMemo(() => {
    const out: string[] = []
    for (let i = entries.length - 1; i >= 0 && out.length < 8; i--) {
      const e = entries[i]
      if (e.refType === 'free' && !out.includes(e.title)) out.push(e.title)
    }
    return out
  }, [entries])

  const start = (title: string) => title.trim() && nav.startPractice({ refType: 'free', title: title.trim() })

  return (
    <div className="card">
      <div className="card-head" style={{ marginBottom: 14 }}>
        <span className="t">
          자유 연습<span className="sub">곡·초견·반주 등 · 손·마디별 횟수를 셀 수 있어요</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input className="field" placeholder="예) 쇼팽 발라드 1번" value={free} onChange={e => setFree(e.target.value)} onKeyDown={e => e.key === 'Enter' && start(free)} />
        <button className="btn primary" onClick={() => start(free)} disabled={!free.trim()}>
          <PlayIcon size={20} /> 시작
        </button>
      </div>
      {recent.length > 0 && (
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
