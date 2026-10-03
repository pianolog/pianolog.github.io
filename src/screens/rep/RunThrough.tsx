import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon } from '../../components/Icon'
import { ScoreCanvas } from '../../components/ScoreCanvas'
import { useToast } from '../../components/ui'
import { db, type RunMark } from '../../lib/db'
import { useNow, useWakeLock } from '../../lib/hooks'
import { metronome } from '../../lib/metronome'
import { startRecording, type ActiveRecording } from '../../lib/recorder'
import { clock, dateKey } from '../../lib/time'

/** 런스루: 녹음하며 통주, 걸린 곳 마킹 → 끝나면 정리 화면으로 */
export function RunThrough({ pieceId, onDone, onCancel }: { pieceId: number; onDone: (runId: number) => void; onCancel: () => void }) {
  const toast = useToast()
  const piece = useLiveQuery(() => db.pieces.get(pieceId), [pieceId])
  const score = useLiveQuery(() => (piece?.scoreId ? db.scores.get(piece.scoreId) : undefined), [piece?.scoreId])
  const [phase, setPhase] = useState<'ready' | 'live' | 'saving'>('ready')
  const [rec, setRec] = useState<ActiveRecording | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [marks, setMarks] = useState<RunMark[]>([])
  const [page, setPage] = useState(1)
  const [flash, setFlash] = useState<string | null>(null)
  const [noMic, setNoMic] = useState(false)
  const now = useNow(phase === 'live')
  const flashTimer = useRef(0)
  const lastTap = useRef(0)
  useWakeLock(true)

  const elapsed = phase === 'live' ? (now - startedAt) / 1000 : 0

  useEffect(() => () => rec?.cancel(), [rec])

  const begin = async () => {
    metronome.stop()
    try {
      setRec(await startRecording())
    } catch {
      setNoMic(true)
      toast('마이크를 쓸 수 없어서 녹음 없이 진행해요')
    }
    setStartedAt(Date.now())
    setPhase('live')
  }

  const mark = useCallback(() => {
    if (phase !== 'live') return
    const atSec = (Date.now() - startedAt) / 1000
    setMarks(m => {
      const next = [...m, { atSec, page: score ? page : undefined }]
      setFlash(`마킹 ${next.length} · ${clock(atSec)}${score ? ` · p.${page}` : ''}`)
      return next
    })
    clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 1400)
  }, [phase, startedAt, score, page])

  const finish = async () => {
    setPhase('saving')
    const durationSec = Math.round((Date.now() - startedAt) / 1000)
    const blob = rec ? await rec.stop() : null
    setRec(null)
    const recordingId = blob && blob.size ? ((await db.recordings.add({ blob, createdAt: Date.now() })) as number) : undefined
    const today = dateKey()
    const runId = (await db.runs.add({ pieceId, date: today, createdAt: Date.now(), durationSec, recordingId, marks, reviewed: marks.length === 0 })) as number
    const sessionId = (await db.sessions.add({ date: today, startedAt, endedAt: Date.now() })) as number
    await db.entries.add({
      sessionId,
      date: today,
      createdAt: Date.now(),
      refType: 'run',
      refNo: pieceId,
      pieceId,
      title: `${piece?.title ?? '곡'} 런스루`,
      seconds: durationSec,
      bpm: 0,
      cleanBpm: 0,
      hands: '양손',
      variations: [],
      rating: 0,
      memo: marks.length ? `마킹 ${marks.length}` : ''
    })
    onDone(runId)
  }

  const cancel = () => {
    if (phase === 'live' && !window.confirm('이 런스루를 저장하지 않고 나갈까요?')) return
    rec?.cancel()
    onCancel()
  }

  return (
    <div className="full" style={{ zIndex: 32 }}>
      <div style={{ height: 76, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: '1px solid var(--line)', background: 'var(--s1)' }}>
        {phase === 'live' ? (
          <button className="btn" onClick={finish}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--ink)' }} />
            종료
          </button>
        ) : (
          <button className="btn icon" onClick={cancel} aria-label="닫기"><Icon name="close" /></button>
        )}
        {phase === 'live' && (
          <div style={{ height: 56, borderRadius: 14, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'color-mix(in oklch, var(--alert) 16%, var(--s1))', color: 'var(--alert)', fontSize: 16, fontWeight: 600 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--alert)' }} />
            <span>{noMic ? '녹음 없음' : '녹음 중'}</span>
            <span>{clock(elapsed)}</span>
          </div>
        )}
        <span className="serif" style={{ fontSize: 17, fontWeight: 600, padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>런스루 · {piece?.title}</span>
        <div style={{ marginLeft: 'auto', height: 48, padding: '0 16px', borderRadius: 12, border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink2)' }}>마킹</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accentText)' }}>{marks.length}</span>
        </div>
        {score && <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink2)', padding: '0 6px' }}>{page} / {score.pageCount}</span>}
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', boxShadow: flash ? 'inset 0 0 0 5px color-mix(in oklch, var(--accent) 75%, transparent)' : 'none', transition: 'box-shadow 120ms' }}>
        {phase === 'ready' ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 30, textAlign: 'center' }}>
            <span className="serif" style={{ fontSize: 30, fontWeight: 600 }}>{piece?.title}</span>
            <span style={{ fontSize: 16, color: 'var(--ink2)', lineHeight: 1.7 }}>
              처음부터 끝까지 멈추지 말고 쳐 보세요.
              <br />
              걸린 곳에서 <b>악보를 두 번 탭</b>하거나 <b>페달을 길게</b> 누르면 마킹돼요.
              <br />
              {score ? '페달을 짧게 누르거나 옆으로 밀면 페이지가 넘어가요.' : '악보 PDF를 연결하면 페이지도 같이 기록돼요.'}
            </span>
            <button className="tap" onClick={begin} style={{ height: 76, padding: '0 40px', borderRadius: 18, background: 'var(--alert)', color: '#fff', display: 'flex', alignItems: 'center', gap: 14, fontSize: 21, fontWeight: 700 }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff' }} />
              녹음하며 시작
            </button>
          </div>
        ) : score ? (
          <div style={{ position: 'absolute', inset: '18px 24px 64px' }}>
            <ScoreCanvas scoreId={score.id!} page={page} pageCount={score.pageCount} onPage={setPage} onMark={mark} />
          </div>
        ) : (
          <button onPointerUp={() => { const t = Date.now(); if (t - lastTap.current < 320) { lastTap.current = 0; mark() } else lastTap.current = t }} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <span style={{ fontSize: 'min(160px, 16vh)', fontWeight: 300, letterSpacing: '-0.03em' }}>{clock(elapsed)}</span>
            <span style={{ fontSize: 18, color: 'var(--ink2)' }}>화면 아무 데나 두 번 탭 → 마킹</span>
          </button>
        )}
        {flash && (
          <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', height: 44, padding: '0 18px', borderRadius: 99, background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700, zIndex: 3, whiteSpace: 'nowrap' }}>
            {flash}
          </div>
        )}
        {phase === 'live' && score && (
          <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', height: 40, padding: '0 18px', borderRadius: 99, background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', fontSize: 14, fontWeight: 500, color: 'var(--ink2)' }}>
            걸린 곳: 악보 두 번 탭 또는 페달 길게 <span style={{ width: 1, height: 16, background: 'var(--line)' }} /> 메트로놈 꺼짐
          </div>
        )}
        {phase === 'saving' && <div className="scrim" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>저장 중…</div>}
      </div>
    </div>
  )
}
