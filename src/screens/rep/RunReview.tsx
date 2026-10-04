import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon, PauseIcon, PlayIcon } from '../../components/Icon'
import { useToast } from '../../components/ui'
import { db } from '../../lib/db'
import { waveformPeaks } from '../../lib/recorder'
import { clock, dateKey, parseDateKey, shortDate } from '../../lib/time'
import { useNav } from '../../nav'

const BARS = 146
const NONE = -1

/** 런스루 정리: 마킹 지점 듣고 → 구간 고르기 → 취약 표시 */
export function RunReview({ runId }: { runId: number }) {
  const nav = useNav()
  const toast = useToast()
  const data = useLiveQuery(async () => {
    const run = await db.runs.get(runId)
    if (!run) return null
    const [piece, sections, recording] = await Promise.all([db.pieces.get(run.pieceId), db.sections.where('pieceId').equals(run.pieceId).sortBy('order'), run.recordingId ? db.recordings.get(run.recordingId) : undefined])
    return { run, piece, sections, recording }
  }, [runId])
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [picked, setPicked] = useState<Record<number, number>>({})
  const audio = useRef<HTMLAudioElement>(null)
  const stopAt = useRef<number | null>(null)

  const blob = data?.recording?.blob
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    void waveformPeaks(blob, BARS).then(r => setPeaks(r.peaks)).catch(() => setPeaks(null))
    return () => URL.revokeObjectURL(u)
  }, [blob])

  useEffect(() => {
    if (!data?.run) return
    const init: Record<number, number> = {}
    data.run.marks.forEach((m, i) => {
      if (m.sectionId !== undefined) init[i] = m.sectionId ?? NONE
    })
    setPicked(init)
  }, [data?.run])

  if (data === undefined) return <div className="screen" />
  if (!data) return <div className="screen"><div className="screen-inner"><button className="back" onClick={nav.closePage}><Icon name="left" size={20} />돌아가기</button><div className="empty">런스루를 찾을 수 없어요.</div></div></div>
  const { run, piece, sections } = data
  const total = run.durationSec || 1

  const play = (from?: number, dur?: number) => {
    const a = audio.current
    if (!a) return
    if (from !== undefined) a.currentTime = Math.max(0, from)
    stopAt.current = dur ? a.currentTime + dur : null
    void a.play()
  }
  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) play()
    else a.pause()
  }

  const candidates = (page?: number) => {
    const onPage = page ? sections.filter(s => s.page === page) : []
    return onPage.length ? onPage : sections
  }

  const chosen = [...new Set(Object.values(picked).filter(v => v !== NONE))]
  const unpicked = run.marks.filter((_, i) => picked[i] === undefined).length

  const save = async () => {
    const today = dateKey()
    await db.transaction('rw', db.runs, db.sections, async () => {
      await db.runs.update(runId, { reviewed: true, marks: run.marks.map((m, i) => ({ ...m, sectionId: picked[i] === undefined ? undefined : picked[i] === NONE ? null : picked[i] })) })
      for (const id of chosen) {
        const s = await db.sections.get(id)
        if (s) await db.sections.update(id, { weak: true, srs: { ...s.srs, due: today } })
      }
    })
    toast(chosen.length ? `${chosen.length}개 구간을 취약으로 표시했어요` : '저장됨')
    nav.openPage({ kind: 'piece', pieceId: run.pieceId })
  }

  const remove = async () => {
    if (!window.confirm('이 런스루와 녹음을 지울까요?')) return
    await db.runs.delete(runId)
    if (run.recordingId) await db.recordings.delete(run.recordingId)
    nav.openPage({ kind: 'piece', pieceId: run.pieceId })
  }

  return (
    <div className="screen">
      <div className="screen-inner">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="back" onClick={() => nav.openPage({ kind: 'piece', pieceId: run.pieceId })}>
            <Icon name="left" size={20} width={1.8} />
            {piece?.title ?? '곡'}
          </button>
          <h1 className="page-title">런스루 정리</h1>
          <span style={{ fontSize: 15, color: 'var(--ink3)' }}>{[piece?.title, shortDate(parseDateKey(run.date)), clock(run.durationSec), `마킹 ${run.marks.length}`].filter(Boolean).join(' · ')}</span>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="card-head">
            <span style={{ fontSize: 17, fontWeight: 600 }}>녹음</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{clock(t)} <span style={{ color: 'var(--ink3)', fontWeight: 500 }}>/ {clock(total)}</span></span>
          </div>
          {!blob ? (
            <div className="empty" style={{ padding: 20 }}>녹음이 없는 런스루예요. 마킹 시간과 페이지로 구간을 고르세요.</div>
          ) : (
            <>
              <audio ref={audio} src={url ?? undefined} preload="auto" onTimeUpdate={e => { const a = e.currentTarget; setT(a.currentTime); if (stopAt.current && a.currentTime >= stopAt.current) { a.pause(); stopAt.current = null } }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
              <div
                onClick={e => { const r = e.currentTarget.getBoundingClientRect(); play(((e.clientX - r.left) / r.width) * total) }}
                style={{ position: 'relative', height: 150, marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                {(peaks ?? Array.from({ length: BARS }, () => 0.05)).map((p, i) => (
                  <span key={i} style={{ width: 3, height: Math.max(4, p * 144), borderRadius: 2, flex: 'none', background: i / BARS < t / total ? 'var(--ink2)' : 'var(--line)' }} />
                ))}
                <div style={{ position: 'absolute', left: `${(t / total) * 100}%`, top: -6, bottom: -6, width: 2, background: 'var(--ink)', borderRadius: 1 }} />
                {run.marks.map((m, i) => (
                  <button key={i} onClick={e => { e.stopPropagation(); play(m.atSec - 10, 20) }} style={{ position: 'absolute', left: `calc(${(m.atSec / total) * 100}% - 12px)`, top: -34, bottom: 0, width: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{i + 1}</span>
                    <span style={{ flex: 1, width: 2, background: 'var(--accent)' }} />
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative', height: 16, marginTop: 10 }}>
                {Array.from({ length: Math.floor(total / 60) + 1 }, (_, i) => i * 60).filter(sec => sec < total).map(sec => (
                  <span key={sec} style={{ position: 'absolute', left: `${(sec / total) * 100}%`, transform: sec ? 'translateX(-50%)' : 'none', fontSize: 12, color: 'var(--ink3)' }}>{sec / 60}:00</span>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 14 }}>
                <button className="btn" onClick={() => audio.current && (audio.current.currentTime = Math.max(0, audio.current.currentTime - 5))}>−5초</button>
                <button className="tap" onClick={toggle} style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--ink)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label={playing ? '정지' : '재생'}>
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button className="btn" onClick={() => audio.current && (audio.current.currentTime = Math.min(total, audio.current.currentTime + 5))}>+5초</button>
              </div>
            </>
          )}
        </div>

        {run.marks.length === 0 && <div className="card empty">이번 런스루에는 마킹이 없어요.</div>}
        {run.marks.map((m, i) => {
          const cur = picked[i]
          const opts = candidates(m.page)
          return (
            <div key={i} className="card" style={{ padding: '14px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12, border: `1.5px solid ${cur === undefined ? 'var(--accent)' : 'transparent'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flex: 'none' }}>{i + 1}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 17, fontWeight: 600 }}>{clock(m.atSec)}{m.page ? ` · p.${m.page}` : ''}</span>
                  <span style={{ fontSize: 13, fontWeight: cur === undefined ? 600 : 500, color: cur === undefined ? 'var(--accentText)' : 'var(--ink3)' }}>
                    {cur === undefined ? '구간을 골라 주세요' : cur === NONE ? '무시 — 취약 표시 안 함' : `${sections.find(s => s.id === cur)?.label} 취약으로 표시`}
                  </span>
                </div>
                {blob && (
                  <button className="btn sm" style={{ marginLeft: 'auto', height: 48 }} onClick={() => play(m.atSec - 10, 20)}>
                    <PlayIcon size={16} /> 앞뒤 10초
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 44 }}>
                {opts.length === 0 && <span className="caption">곡 상세에서 구간을 먼저 만들어 주세요.</span>}
                {opts.map(s => (
                  <button key={s.id} className={`pick serif${cur === s.id ? ' on' : ''}`} style={{ height: 44 }} onClick={() => setPicked(p => ({ ...p, [i]: s.id! }))}>
                    {s.label}
                  </button>
                ))}
                <button className={`pick${cur === NONE ? ' on' : ''}`} style={{ height: 44, color: cur === NONE ? undefined : 'var(--ink3)' }} onClick={() => setPicked(p => ({ ...p, [i]: NONE }))}>
                  해당 없음
                </button>
              </div>
            </div>
          )
        })}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
          <span className="caption" style={{ fontSize: 14, padding: '0 4px' }}>
            {chosen.length ? `취약으로 표시할 구간 · ${chosen.map(id => sections.find(s => s.id === id)?.label).join(', ')} → 복습일 오늘` : unpicked ? `아직 고르지 않은 마킹 ${unpicked}개` : '선택한 구간 없음'}
          </span>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" style={{ height: 68, color: 'var(--alert)' }} onClick={remove}><Icon name="trash" /></button>
            <button className="btn primary" style={{ flex: 1, height: 68, fontSize: 19, borderRadius: 16 }} onClick={save}>
              {chosen.length ? `취약으로 표시 · ${chosen.length}개 구간` : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
