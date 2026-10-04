import { useState } from 'react'
import { HANDS, KEYS, type Hand, type Key } from '../data/exercises'
import { Icon } from '../components/Icon'
import { BpmStepper, Segmented, Sheet, SheetHead, Stars } from '../components/ui'
import type { RefType } from '../lib/db'
import { RatingButtons } from '../components/Rating'
import type { Rating, Srs, SrsOpts } from '../lib/srs'
import { clock } from '../lib/time'

export interface FinishData {
  bpm: number
  cleanBpm: number
  key?: Key
  hands: Hand
  variations: string[]
  rating: number
  memo: string
  grade: Rating | null // 기초 카드 간격 복습 평가
}

export function FinishSheet({
  title,
  refType,
  seconds,
  initial,
  todayKey,
  nextLabel,
  variations,
  srsFor,
  srsOpts,
  extra,
  onSave,
  onClose
}: {
  title: string
  refType: RefType
  seconds: number
  initial: FinishData
  todayKey?: Key
  nextLabel: string | null
  variations: readonly string[]
  srsFor?: (key?: Key) => Srs // 기초 카드: 지금 고른 조의 카드
  srsOpts?: SrsOpts
  extra?: React.ReactNode // 자유 연습: 손·마디별 횟수 요약
  onSave: (d: FinishData, next: boolean) => void
  onClose: () => void
}) {
  const [d, setD] = useState<FinishData>(initial)
  const [err, setErr] = useState('')
  const set = (p: Partial<FinishData>) => {
    setErr('')
    setD(x => ({ ...x, ...p }))
  }
  const needKey = refType === 'hanon'

  const save = (next: boolean) => {
    if (needKey && !d.key) return setErr('하농은 조를 골라야 저장돼요.')
    onSave(d, next)
  }

  const toggleVar = (v: string) => set({ variations: d.variations.includes(v) ? d.variations.filter(x => x !== v) : [...d.variations, v] })
  const summary = [title, d.key && `${d.key} major`, clock(seconds), d.hands, ...d.variations].filter(Boolean).join(' · ')

  return (
    <Sheet onClose={onClose}>
      <SheetHead title="항목 끝내기" sub={summary} onClose={onClose} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginTop: 26 }}>
        {extra}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <BpmStepper label="도달 BPM" hint={`자동 ${initial.bpm}`} value={d.bpm} onChange={bpm => set({ bpm })} />
          <BpmStepper label="클린 BPM" hint={`자동 ${initial.cleanBpm}`} value={d.cleanBpm} onChange={cleanBpm => set({ cleanBpm })} accent />
        </div>

        {(refType === 'hanon' || refType === 'pischna') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span className="sec-label">조</span>
              {needKey ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--alert)' }}>하농 필수</span> : <span style={{ fontSize: 12, color: 'var(--ink3)' }}>선택</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
              {KEYS.map(k => (
                <button key={k} className={`keychip tap${d.key === k ? ' on' : k === todayKey ? ' today' : ''}`} onClick={() => set({ key: d.key === k && !needKey ? undefined : k })}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {srsFor && srsOpts && (!needKey || d.key) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span className="sec-label">간격 복습</span>
              <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{needKey ? `${d.key} major 카드 · ` : ''}숫자는 다음 복습까지의 간격</span>
            </div>
            <RatingButtons compact srs={srsFor(d.key)} opts={srsOpts} value={d.grade} onChange={grade => set({ grade: d.grade === grade ? null : grade })} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: srsFor ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="sec-label">손</span>
            <Segmented large value={d.hands} onChange={hands => set({ hands })} options={HANDS.map(h => ({ value: h, label: h }))} />
          </div>
          {!srsFor && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="sec-label">자기평가</span>
              <Stars value={d.rating} onChange={rating => set({ rating })} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="sec-label">변형</span>
            <span style={{ fontSize: 12, color: 'var(--ink3)' }}>여러 개 선택</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {variations.map(v => (
              <button key={v} className={`pick tap${d.variations.includes(v) ? ' on' : ''}`} style={{ height: 52, padding: '0 20px' }} onClick={() => toggleVar(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="sec-label">한 줄 메모</span>
          <input className="field" style={{ height: 60 }} placeholder="예) 왼손 4–5 연결 불안, 마디 끝에서 템포 밀림" value={d.memo} onChange={e => set({ memo: e.target.value })} />
        </div>
      </div>

      <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {err ? <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--alert)', padding: '0 4px' }}>{err}</span> : <span className="caption" style={{ fontSize: 14, padding: '0 4px' }}>{nextLabel ? `다음 항목 · ${nextLabel}` : '마지막 항목이에요'}</span>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn" style={{ height: 68, padding: '0 30px', fontSize: 17, borderRadius: 16 }} onClick={() => save(false)}>
            저장
          </button>
          <button className="btn primary" style={{ flex: 1, height: 68, fontSize: 19, borderRadius: 16 }} onClick={() => save(true)}>
            {nextLabel ? '저장 후 다음 항목' : '저장하고 마치기'}
            <Icon name="arrow" size={20} width={2.2} />
          </button>
        </div>
      </div>
    </Sheet>
  )
}
