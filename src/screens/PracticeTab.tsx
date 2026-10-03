import { useMemo, useState } from 'react'
import { BOOK_SIZE, type Book } from '../data/exercises'
import { Icon, PlayIcon } from '../components/Icon'
import { Segmented, StatusIcon } from '../components/ui'
import { useEntries, useRoutine, useSettings } from '../lib/hooks'
import { routineLabel, routineProgress, todayKey } from '../lib/stats'
import { dateKey } from '../lib/time'
import { useNav } from '../nav'
import { targetFor } from './Today'

/** 연습 탭: 루틴 항목, 번호 직접 고르기, 자유 연습 */
export function PracticeTab() {
  const nav = useNav()
  const entries = useEntries()
  const routine = useRoutine()
  const settings = useSettings()
  const [book, setBook] = useState<Book>('hanon')
  const [free, setFree] = useState('')
  const key = todayKey(settings.todayKeyMode, entries)
  const today = dateKey()
  const todayEntries = useMemo(() => entries.filter(e => e.date === today), [entries, today])
  const done = new Set(todayEntries.filter(e => e.refType === book).map(e => e.refNo))

  // 최근에 쓴 자유 연습 제목
  const recentFree = useMemo(() => {
    const out: string[] = []
    for (let i = entries.length - 1; i >= 0 && out.length < 8; i--) {
      const e = entries[i]
      if (e.refType === 'free' && !out.includes(e.title)) out.push(e.title)
    }
    return out
  }, [entries])

  const startFree = (title: string) => title.trim() && nav.startPractice({ refType: 'free', title: title.trim() })

  return (
    <div className="screen">
      <div className="screen-inner">
        <h1 className="page-title" style={{ paddingTop: 4 }}>연습</h1>

        {routine.length > 0 && (
          <div className="card" style={{ padding: '18px 12px 12px' }}>
            <div className="card-head" style={{ padding: '0 12px' }}>
              <span className="t">오늘의 루틴</span>
            </div>
            {routine.map(r => {
              const p = routineProgress(r, todayEntries)
              return (
                <button key={r.id} onClick={() => nav.startPractice(targetFor(p, key))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, minHeight: 60, padding: '0 14px', textAlign: 'left' }}>
                  <StatusIcon status={p.status} />
                  <span style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{routineLabel(r, key)}</span>
                  <span style={{ color: 'var(--ink2)' }}>{r.minutes}분</span>
                  <Icon name="right" size={20} style={{ color: 'var(--ink3)' }} />
                </button>
              )
            })}
          </div>
        )}

        <div className="card">
          <div className="card-head" style={{ marginBottom: 14 }}>
            <span className="t">번호 골라서 연습</span>
            <Segmented value={book} onChange={setBook} options={[{ value: 'hanon', label: '하농' }, { value: 'pischna', label: '피쉬나' }]} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 6 }}>
            {Array.from({ length: BOOK_SIZE }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                className="tap"
                onClick={() => nav.startPractice({ refType: book, queue: [n], key: book === 'hanon' ? key : undefined })}
                style={{ height: 52, borderRadius: 10, background: done.has(n) ? 'color-mix(in oklch, var(--ok) 22%, var(--s1))' : 'var(--s2)', fontSize: 17, fontWeight: 600 }}
              >
                {n}
              </button>
            ))}
          </div>
          {book === 'hanon' && <div className="caption" style={{ marginTop: 12 }}>오늘의 조 <span className="serif" style={{ fontWeight: 600, color: 'var(--accentText)' }}>{key}</span>로 시작해요. 조는 항목을 끝낼 때 바꿀 수 있어요.</div>}
        </div>

        <div className="card">
          <div className="card-head" style={{ marginBottom: 14 }}>
            <span className="t">자유 연습<span className="sub">곡·스케일·초견 등</span></span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="field" placeholder="예) 베토벤 Op.110 1악장 m.33–48" value={free} onChange={e => setFree(e.target.value)} onKeyDown={e => e.key === 'Enter' && startFree(free)} />
            <button className="btn primary" onClick={() => startFree(free)} disabled={!free.trim()}>
              <PlayIcon size={20} /> 시작
            </button>
          </div>
          {recentFree.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {recentFree.map(t => (
                <button key={t} className="pick" onClick={() => startFree(t)}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
