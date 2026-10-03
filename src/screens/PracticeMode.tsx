import { useEffect, useMemo, useRef, useState } from 'react'
import { exerciseTitle, variationsFor, type Hand, type Key } from '../data/exercises'
import { Icon, PauseIcon, PlayIcon } from '../components/Icon'
import { Sheet, SheetHead, useToast } from '../components/ui'
import { db, type Entry } from '../lib/db'
import { useEntries, useNow, useSettings, useWakeLock } from '../lib/hooks'
import { metronome, useMetronome, type Subdivision } from '../lib/metronome'
import { todayKey } from '../lib/stats'
import { clock, dateKey } from '../lib/time'
import { useNav, type BasicTarget, type PracticeTarget } from '../nav'
import { nextRoutineTarget, targetLabel } from '../lib/flow'
import { FinishSheet, type FinishData } from './FinishSheet'
import { ScoreScreen } from './ScoreScreen'
import { ScorePicker } from './ScorePicker'

interface Ladder {
  start: number
  target: number
}

const ladderKey = (t: BasicTarget, no: number) => (t.refType === 'free' ? `ladder:free:${t.title}` : `ladder:${t.refType}:${no}`)
const DEFAULT_LADDER: Ladder = { start: 60, target: 104 }

export function PracticeMode({ target: initialTarget, onClose }: { target: BasicTarget; onClose: () => void }) {
  const nav = useNav()
  const toast = useToast()
  const settings = useSettings()
  const entries = useEntries()
  const m = useMetronome()
  const [target, setTarget] = useState(initialTarget)
  const [idx, setIdx] = useState(0)
  const [key, setKey] = useState<Key | undefined>(initialTarget.refType === 'hanon' ? initialTarget.key : undefined)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStart] = useState(() => Date.now())
  const [itemStart, setItemStart] = useState(() => Date.now())
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [pausedTotal, setPausedTotal] = useState(0)
  const [maxBpm, setMaxBpm] = useState(0)
  const [ladder, setLadder] = useState<Ladder>(DEFAULT_LADDER)
  const [finishing, setFinishing] = useState(false)
  const [editLadder, setEditLadder] = useState(false)
  const [score, setScore] = useState<{ id: number; page: number } | null>(null)
  const [picking, setPicking] = useState(false)
  const lastHands = useRef<Hand>('양손')
  const lastVars = useRef<string[]>([])
  const now = useNow()
  useWakeLock(true)

  const no = target.refType === 'free' ? 0 : target.queue[idx]
  const title = target.refType === 'free' ? target.title : exerciseTitle(target.refType, no)
  const itemSec = ((pausedAt ?? now) - itemStart - pausedTotal) / 1000
  const sessionSec = (now - sessionStart) / 1000

  // 세션 시작 — 저장된 항목이 없으면 닫을 때 지운다
  useEffect(() => {
    let id: number | null = null
    void db.sessions.add({ date: dateKey(), startedAt: sessionStart, endedAt: sessionStart }).then(v => {
      id = v as number
      setSessionId(id)
    })
    return () => {
      metronome.stop()
      if (id === null) return
      const sid = id
      void db.entries.where('sessionId').equals(sid).count().then(async n => {
        if (n) await db.sessions.update(sid, { endedAt: Date.now() })
        else await db.sessions.delete(sid)
      })
    }
  }, [sessionStart])

  // 항목이 바뀌면: 사다리·시작 BPM 불러오기, 타이머 초기화
  const itemId = `${target.refType}:${no}:${target.refType === 'free' ? target.title : ''}`
  useEffect(() => {
    let alive = true
    void db.settings.get(ladderKey(target, no)).then(r => {
      if (!alive) return
      const l = (r?.value as Ladder) ?? DEFAULT_LADDER
      setLadder(l)
      const prev = [...entries].reverse().find(e => e.refType === target.refType && (target.refType === 'free' ? e.title === target.title : e.refNo === no) && (!key || !e.key || e.key === key))
      metronome.setBpm(prev?.cleanBpm ?? l.start)
    })
    setItemStart(Date.now())
    setPausedAt(null)
    setPausedTotal(0)
    setMaxBpm(0)
    return () => {
      alive = false
    }
    // entries는 시작 BPM을 정할 때만 쓰므로 일부러 의존성에서 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  useEffect(() => {
    if (m.playing) setMaxBpm(x => Math.max(x, m.bpm))
  }, [m.playing, m.bpm])

  const steps = useMemo(() => {
    const out: number[] = []
    const s = settings.ladderStep || 4
    for (let v = ladder.start; v <= ladder.target; v += s) out.push(v)
    if (out[out.length - 1] !== ladder.target) out.push(ladder.target)
    return out
  }, [ladder, settings.ladderStep])
  const nextStep = steps.find(v => v > m.bpm)

  const togglePause = () => {
    if (pausedAt) {
      setPausedTotal(t => t + Date.now() - pausedAt)
      setPausedAt(null)
    } else setPausedAt(Date.now())
  }

  // 다음 항목 이름 (번호 큐 → 루틴의 다음 항목)
  const [nextRoutine, setNextRoutine] = useState<PracticeTarget | null>(null)
  useEffect(() => {
    if (!target.routineId) return setNextRoutine(null)
    let alive = true
    void nextRoutineTarget(target.routineId).then(t => alive && setNextRoutine(t))
    return () => {
      alive = false
    }
  }, [target, finishing])

  const queueNext = target.refType !== 'free' && idx + 1 < target.queue.length ? target.queue[idx + 1] : null
  const nextLabel =
    queueNext !== null && target.refType !== 'free'
      ? `${exerciseTitle(target.refType, queueNext)}${target.refType === 'hanon' && key ? ` · ${key} major` : ''}`
      : nextRoutine
        ? targetLabel(nextRoutine)
        : null
  const varList = variationsFor(target.refType, no)

  const save = async (d: FinishData, goNext: boolean) => {
    if (!sessionId) return
    const entry: Entry = {
      sessionId,
      date: dateKey(),
      createdAt: Date.now(),
      refType: target.refType,
      refNo: no,
      title,
      key: target.refType === 'free' ? undefined : d.key,
      seconds: Math.round(Math.max(1, itemSec)),
      bpm: d.bpm,
      cleanBpm: d.cleanBpm,
      hands: d.hands,
      variations: d.variations,
      rating: d.rating,
      memo: d.memo.trim()
    }
    await db.entries.add(entry)
    await db.sessions.update(sessionId, { endedAt: Date.now() })
    lastHands.current = d.hands
    lastVars.current = d.variations
    if (d.key) setKey(d.key)
    setFinishing(false)
    autoPaused.current = false
    toast(`${title} 저장됨`)
    if (!goNext) return onClose()
    if (queueNext) setIdx(i => i + 1)
    else if (nextRoutine?.refType === 'section') nav.startPractice(nextRoutine)
    else if (nextRoutine) {
      setTarget(nextRoutine)
      setIdx(0)
      setKey(nextRoutine.refType === 'hanon' ? nextRoutine.key : undefined)
    } else onClose()
  }

  // 시트를 여는 동안은 항목 타이머를 멈춘다
  const autoPaused = useRef(false)
  const startFinish = () => {
    metronome.stop()
    if (!pausedAt) {
      autoPaused.current = true
      setPausedAt(Date.now())
    }
    setFinishing(true)
  }
  const cancelFinish = () => {
    setFinishing(false)
    if (autoPaused.current && pausedAt) {
      setPausedTotal(t => t + Date.now() - pausedAt)
      setPausedAt(null)
    }
    autoPaused.current = false
  }

  const close = () => {
    if (itemSec > 60 && !window.confirm('지금 항목을 기록하지 않고 나갈까요?')) return
    onClose()
  }

  // 자유 연습은 제목별, 스케일은 한 권으로 악보를 기억한다
  const pickKey = target.refType === 'free' ? `score:free:${target.title}` : target.refType === 'scale' ? 'score:scale' : null
  const openScore = async () => {
    if (pickKey) {
      const r = await db.settings.get(pickKey)
      const v = r?.value as { id: number; page: number } | undefined
      if (v && (await db.scores.get(v.id))) return setScore(v)
      return setPicking(true)
    }
    const map = target.refType === 'hanon' ? settings.hanonBook : settings.pischnaBook
    if (!map.scoreId) return toast(`설정에서 ${target.refType === 'hanon' ? '하농' : '피쉬나'} 악보 PDF를 연결하세요`)
    setScore({ id: map.scoreId, page: map.pages[no] ?? 1 })
  }

  const queueText = target.refType !== 'free' && target.queue.length > 1 ? `${idx + 1} / ${target.queue.length}` : null
  const beatsArr = Array.from({ length: m.beats }, (_, i) => i)
  const big = { width: 84, height: 84, borderRadius: 22, background: 'var(--s1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 600 } as const

  return (
    <div className="full">
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px var(--pad) calc(24px + var(--safe-b))', maxWidth: 980, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 80 }}>
          <button className="btn icon s1" style={{ color: 'var(--ink2)' }} onClick={close} aria-label="연습 끝내기">
            <Icon name="close" width={1.8} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
              {key && target.refType !== 'free' ? ` · ${key} major` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {queueText && <span className="chip">{queueText}</span>}
              {lastHands.current && <span className="chip">{lastHands.current}</span>}
              {lastVars.current.map(v => <span key={v} className="chip">{v}</span>)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, marginTop: 20 }}>
          <button onClick={togglePause} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: pausedAt ? 'var(--accentText)' : 'var(--ink3)' }}>{pausedAt ? '항목 · 일시정지' : '항목'}</span>
            <span style={{ fontSize: 44, fontWeight: 600, lineHeight: 1, opacity: pausedAt ? 0.5 : 1 }}>{clock(itemSec)}</span>
          </button>
          <div style={{ width: 1, height: 48, background: 'var(--line)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink3)' }}>세션</span>
            <span style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.2, color: 'var(--ink2)' }}>{clock(sessionSec)}</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 36, height: 30 }}>
            {beatsArr.map(i => {
              const on = m.playing && m.beat === i
              const first = i === 0
              const s = first ? 28 : 16
              return <span key={i} style={{ width: s, height: s, borderRadius: '50%', boxSizing: 'border-box', background: on || (!m.playing && first) ? 'var(--accent)' : 'transparent', border: on || (!m.playing && first) ? 'none' : '2px solid var(--line)', transform: on ? 'scale(1.15)' : 'none', transition: 'transform 60ms' }} />
            })}
          </div>
          <div style={{ fontSize: 'min(300px, 26vh)', fontWeight: 300, lineHeight: 0.95, letterSpacing: '-0.04em' }}>{m.bpm}</div>
          <button onClick={() => setEditLadder(true)} style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink2)' }}>
            {m.beats}/4 · 목표 {ladder.target}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <button className="tap" style={big} onClick={() => metronome.nudge(-5)}>−5</button>
          <button className="tap" style={big} onClick={() => metronome.nudge(-1)}>−1</button>
          <button className="tap" onClick={() => metronome.toggle()} style={{ width: 124, height: 124, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 12px' }} aria-label={m.playing ? '정지' : '재생'}>
            {m.playing ? <PauseIcon size={46} /> : <PlayIcon size={48} />}
          </button>
          <button className="tap" style={big} onClick={() => metronome.nudge(1)}>+1</button>
          <button className="tap" style={big} onClick={() => metronome.nudge(5)}>+5</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
          <button className="btn s1" onClick={() => { metronome.unlock(); metronome.tap() }}>
            <Icon name="tap" /> 탭 템포
          </button>
          <button className="btn s1" onClick={() => metronome.setBeats(({ 2: 3, 3: 4, 4: 6, 6: 2 } as Record<number, number>)[m.beats] ?? 4)}>
            <span style={{ color: 'var(--ink3)', fontWeight: 500 }}>박자</span>
            {m.beats}/4
          </button>
          <div className="seg" style={{ height: 56, borderRadius: 14 }}>
            {([[1, '♩'], [2, '8분'], [3, '셋잇단'], [4, '16분']] as [Subdivision, string][]).map(([v, l]) => (
              <button key={v} className={m.subdivision === v ? 'on' : ''} style={{ padding: '0 18px', fontSize: 16 }} onClick={() => metronome.setSubdivision(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 24, padding: '16px 16px 16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setEditLadder(true)} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>템포 사다리</span>
              <span className="caption">{ladder.start} → {ladder.target} · +{settings.ladderStep}</span>
            </button>
            <button className="btn sm" style={{ height: 48, color: 'var(--accentText)', fontWeight: 700 }} onClick={() => nextStep && metronome.setBpm(nextStep)} disabled={!nextStep}>
              {nextStep ? `통과 +${nextStep - m.bpm}` : '목표 도달'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {steps.map(v => {
              const cur = v === m.bpm || (v < m.bpm && (steps.find(x => x > v) ?? 999) > m.bpm)
              const passed = v < m.bpm && !cur
              return (
                <button key={v} onClick={() => metronome.setBpm(v)} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center' }}>
                  <div style={{ width: '100%', height: 6, borderRadius: 3, background: passed ? 'var(--ink3)' : cur ? 'var(--accent)' : 'var(--line)' }} />
                  <span style={{ fontSize: 14, fontWeight: cur ? 700 : 500, color: cur ? 'var(--accentText)' : passed ? 'var(--ink2)' : 'var(--ink3)' }}>{v}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, height: 64, borderRadius: 16, background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: 'var(--ink3)' }}>다음</span>
              <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nextLabel ?? '없음 — 이 항목이 마지막'}</span>
            </div>
          </div>
          <button className="btn" style={{ height: 64, padding: '0 22px', borderRadius: 16, fontSize: 17 }} onClick={openScore}>
            <Icon name="book" width={1.6} /> 악보
          </button>
          <button className="btn dark" style={{ height: 64, padding: '0 26px', borderRadius: 16, fontSize: 17 }} onClick={startFinish}>
            항목 끝내기
          </button>
        </div>
      </div>

      {finishing && (
        <FinishSheet
          title={title}
          refType={target.refType}
          seconds={itemSec}
          todayKey={target.refType === 'hanon' ? todayKey(settings.todayKeyMode, entries) : undefined}
          variations={varList}
          initial={{ bpm: Math.max(maxBpm, m.bpm), cleanBpm: m.bpm, key: target.refType === 'scale' ? undefined : key, hands: lastHands.current, variations: lastVars.current.filter(v => varList.includes(v)), rating: 0, memo: '' }}
          nextLabel={nextLabel}
          onSave={save}
          onClose={cancelFinish}
        />
      )}

      {editLadder && <LadderSheet value={ladder} onClose={() => setEditLadder(false)} onSave={l => { setLadder(l); void db.settings.put({ key: ladderKey(target, no), value: l }); setEditLadder(false) }} />}

      {picking && pickKey && (
        <ScorePicker
          title={`${target.refType === 'free' ? target.title : '스케일·아르페지오'} 악보`}
          onClose={() => setPicking(false)}
          onPick={(id, page) => {
            void db.settings.put({ key: pickKey, value: { id, page } })
            setPicking(false)
            setScore({ id, page })
          }}
        />
      )}

      {score && (
        <ScoreScreen
          scoreId={score.id}
          initialPage={score.page}
          title={title}
          closeLabel="메트로놈 크게"
          onClose={() => setScore(null)}
          extra={<span style={{ fontSize: 26, fontWeight: 600, padding: '0 8px' }}>{clock(itemSec)}</span>}
        />
      )}
    </div>
  )
}

function LadderSheet({ value, onSave, onClose }: { value: Ladder; onSave: (l: Ladder) => void; onClose: () => void }) {
  const [l, setL] = useState(value)
  const num = (k: keyof Ladder, d: number) => setL(x => ({ ...x, [k]: Math.max(30, Math.min(300, x[k] + d)) }))
  const row = (k: keyof Ladder, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span className="sec-label" style={{ width: 80 }}>{label}</span>
      <button className="btn" onClick={() => num(k, -4)}>−4</button>
      <button className="btn" onClick={() => num(k, -1)}>−1</button>
      <span style={{ fontSize: 40, fontWeight: 600, width: 90, textAlign: 'center' }}>{l[k]}</span>
      <button className="btn" onClick={() => num(k, 1)}>+1</button>
      <button className="btn" onClick={() => num(k, 4)}>+4</button>
    </div>
  )
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="템포 사다리" sub="이 항목의 시작 BPM과 목표 BPM. 한 칸 간격은 설정에서 바꿔요." onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        {row('start', '시작')}
        {row('target', '목표')}
      </div>
      <button className="btn primary" style={{ marginTop: 26, height: 64 }} disabled={l.target <= l.start} onClick={() => onSave(l)}>
        저장
      </button>
    </Sheet>
  )
}
