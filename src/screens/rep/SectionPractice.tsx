import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon, PauseIcon, PlayIcon } from '../../components/Icon'
import { Sheet, SheetHead, useToast } from '../../components/ui'
import { db, type Grade, type Lesson, type Section } from '../../lib/db'
import { nextRoutineTarget } from '../../lib/flow'
import { useNow, useSettings, useWakeLock } from '../../lib/hooks'
import { metronome, useMetronome } from '../../lib/metronome'
import { nextInterval, openLessons, scheduleAfter, STAGES } from '../../lib/repertoire'
import { addDays, clock, dateKey, parseDateKey } from '../../lib/time'
import { useNav, type PracticeTarget } from '../../nav'
import { ScoreScreen } from '../ScoreScreen'

export function SectionPractice({ target, onClose }: { target: Extract<PracticeTarget, { refType: 'section' }>; onClose: () => void }) {
  const nav = useNav()
  const toast = useToast()
  const settings = useSettings()
  const m = useMetronome()
  const [idx, setIdx] = useState(0)
  const sectionId = target.queue[idx]
  const data = useLiveQuery(async () => {
    const section = await db.sections.get(sectionId)
    const piece = section ? await db.pieces.get(section.pieceId) : undefined
    const lessons = await db.lessons.toArray()
    return { section, piece, lessons }
  }, [sectionId])
  const section = data?.section
  const piece = data?.piece

  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStart] = useState(() => Date.now())
  const [itemStart, setItemStart] = useState(() => Date.now())
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [misses, setMisses] = useState(0)
  const [tries, setTries] = useState(0)
  const [oks, setOks] = useState(0)
  const [reached, setReached] = useState(0)
  const [flash, setFlash] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [showScore, setShowScore] = useState(false)
  const now = useNow()
  useWakeLock(true)

  const itemSec = ((pausedAt ?? now) - itemStart) / 1000

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

  // 구간이 바뀌면 사다리 BPM에서 다시 시작
  const loadedFor = useRef<number | null>(null)
  useEffect(() => {
    if (!section || loadedFor.current === section.id) return
    loadedFor.current = section.id!
    metronome.setBpm(section.bpm)
    setItemStart(Date.now())
    setPausedAt(null)
    setStreak(0)
    setMisses(0)
    setTries(0)
    setOks(0)
    setReached(section.bpm)
    setFlash('')
  }, [section])

  const steps = useMemo(() => {
    if (!section) return []
    const out: number[] = []
    const st = settings.ladderStep || 4
    for (let v = section.ladderStart; v < section.targetBpm; v += st) out.push(v)
    out.push(section.targetBpm)
    return out
  }, [section, settings.ladderStep])

  if (!section || !piece) return <div className="full" />

  const goal = section.streakGoal || 3
  const lessonsOpen = openLessons(data!.lessons, section.id!)
  const nextStep = steps.find(v => v > m.bpm)
  const prevStep = [...steps].reverse().find(v => v < m.bpm)

  const hit = () => {
    setTries(t => t + 1)
    setOks(o => o + 1)
    setMisses(0)
    const n = streak + 1
    if (n >= goal) {
      setStreak(0)
      if (nextStep) {
        toastFlash(`템포 업 ${m.bpm} → ${nextStep}`)
        metronome.setBpm(nextStep)
        setReached(r => Math.max(r, nextStep))
      } else toastFlash(`목표 템포 ${m.bpm}에서 ${goal}연속 성공`)
    } else {
      setStreak(n)
      setFlash('')
    }
  }
  const miss = () => {
    setTries(t => t + 1)
    setStreak(0)
    setMisses(x => x + 1)
    setFlash('')
  }
  const toastFlash = (msg: string) => setFlash(msg)

  const resolve = async (lesson: Lesson, itemId: string) => {
    await db.lessons.update(lesson.id!, { items: lesson.items.map(it => (it.id === itemId ? { ...it, resolved: true } : it)) })
    toast('해결로 표시했어요')
  }

  const save = async (grade: Grade, memo: string, goNext: boolean) => {
    if (!sessionId) return
    await db.entries.add({
      sessionId,
      date: dateKey(),
      createdAt: Date.now(),
      refType: 'section',
      refNo: section.id!,
      pieceId: piece.id,
      title: `${piece.title} ${section.label}`,
      seconds: Math.round(Math.max(1, itemSec)),
      bpm: Math.max(reached, m.bpm),
      cleanBpm: m.bpm,
      hands: '양손',
      variations: [],
      rating: 0,
      memo: memo.trim(),
      attempts: tries,
      successes: oks,
      grade
    })
    await db.sections.update(section.id!, { bpm: Math.min(m.bpm, section.targetBpm), ...scheduleAfter(section, grade) })
    await db.sessions.update(sessionId, { endedAt: Date.now() })
    setFinishing(false)
    metronome.stop()
    toast(`${section.label} 저장됨`)
    if (!goNext) return onClose()
    if (idx + 1 < target.queue.length) return setIdx(i => i + 1)
    const next = target.routineId ? await nextRoutineTarget(target.routineId) : null
    if (next && next.refType !== 'section') nav.startPractice(next)
    else onClose()
  }

  const close = () => {
    if (tries > 0 && !window.confirm('이 구간을 기록하지 않고 나갈까요?')) return
    onClose()
  }

  const nextLabel = idx + 1 < target.queue.length ? '다음 구간' : target.routineId ? '루틴 다음 항목' : null
  const rate = tries ? Math.round((oks / tries) * 100) : 0

  return (
    <div className="full">
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px var(--pad) calc(24px + var(--safe-b))', maxWidth: 980, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 80 }}>
          <button className="btn icon s1" style={{ color: 'var(--ink2)' }} onClick={close} aria-label="연습 끝내기">
            <Icon name="close" width={1.8} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {piece.title} · {section.label}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {target.queue.length > 1 && <span className="chip">오늘 구간 {idx + 1} / {target.queue.length}</span>}
              <span className="chip">{STAGES[section.stage]} 단계</span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
            <button onClick={() => (pausedAt ? (setItemStart(s => s + Date.now() - pausedAt), setPausedAt(null)) : setPausedAt(Date.now()))} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: pausedAt ? 'var(--accentText)' : 'var(--ink3)' }}>{pausedAt ? '일시정지' : '구간'}</span>
              <span style={{ fontSize: 34, fontWeight: 600, lineHeight: 1 }}>{clock(itemSec)}</span>
            </button>
            {piece.scoreId ? (
              <button className="btn icon s1" style={{ color: 'var(--ink2)' }} onClick={() => setShowScore(true)} aria-label="악보">
                <Icon name="book" width={1.6} />
              </button>
            ) : null}
          </div>
        </div>

        {lessonsOpen.length > 0 && (
          <div style={{ marginTop: 14, background: 'color-mix(in oklch, var(--accent) 12%, var(--s1))', borderRadius: 16, padding: '14px 14px 14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accentText)' }}>
                레슨 지적{lessonsOpen.length > 1 ? ` 1 / ${lessonsOpen.length}` : ''} · {parseDateKey(lessonsOpen[0].lesson.date).getMonth() + 1}월 {parseDateKey(lessonsOpen[0].lesson.date).getDate()}일
              </span>
              <span style={{ fontSize: 16, lineHeight: 1.4 }}>{lessonsOpen[0].text}</span>
            </div>
            <button className="btn sm" style={{ marginLeft: 'auto', height: 48 }} onClick={() => resolve(lessonsOpen[0].lesson, lessonsOpen[0].id)}>
              해결 표시
            </button>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ width: 'min(560px, 100%)', display: 'flex', gap: 4, marginBottom: 10 }}>
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
          <div style={{ fontSize: 'min(200px, 18vh)', fontWeight: 300, lineHeight: 0.95, letterSpacing: '-0.04em' }}>{m.bpm}</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink2)' }}>{m.beats}/4 · 목표 {section.targetBpm}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <button className="btn icon s1" style={{ fontSize: 24, fontWeight: 500 }} onClick={() => metronome.nudge(-1)}>−</button>
            <button className="tap" onClick={() => metronome.toggle()} style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label={m.playing ? '정지' : '재생'}>
              {m.playing ? <PauseIcon size={26} /> : <PlayIcon size={28} />}
            </button>
            <button className="btn icon s1" style={{ fontSize: 24, fontWeight: 500 }} onClick={() => metronome.nudge(1)}>+</button>
            <button className="btn s1" style={{ fontSize: 15 }} onClick={() => metronome.setBeats(({ 2: 3, 3: 4, 4: 6, 6: 2 } as Record<number, number>)[m.beats] ?? 4)}>
              <span style={{ color: 'var(--ink3)', fontWeight: 500 }}>박자</span>{m.beats}/4
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <div style={{ display: 'flex', gap: 18 }}>
            {Array.from({ length: goal }, (_, i) => (
              <span key={i} style={{ width: 34, height: 34, borderRadius: '50%', boxSizing: 'border-box', background: i < streak ? 'var(--accent)' : 'transparent', border: `2.5px solid ${i < streak ? 'var(--accent)' : 'var(--line)'}` }} />
            ))}
          </div>
          <span style={{ fontSize: 19, fontWeight: 600, color: flash ? 'var(--accentText)' : 'var(--ink)' }}>
            {flash || (nextStep ? `연속 성공 ${streak} / ${goal} · ${goal - streak}번 더 성공하면 ${nextStep}` : `연속 성공 ${streak} / ${goal} · 목표 템포`)}
          </span>
          {misses >= 4 && prevStep ? (
            <button className="btn sm" style={{ color: 'var(--alert)' }} onClick={() => { metronome.setBpm(prevStep); setMisses(0) }}>
              실수가 계속돼요 · {prevStep}로 한 칸 내리기
            </button>
          ) : (
            <span style={{ fontSize: 14, color: 'var(--ink3)' }}>시도 {tries} · 성공 {oks} · 성공률 {rate}%</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button className="tap" onClick={miss} style={{ height: 136, borderRadius: 24, background: 'var(--s1)', color: 'var(--alert)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontSize: 28, fontWeight: 700 }}>
            <Icon name="close" size={30} width={2.4} /> 실수
          </button>
          <button className="tap" onClick={hit} style={{ height: 136, borderRadius: 24, background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontSize: 28, fontWeight: 700 }}>
            <Icon name="check" size={32} width={2.6} /> 성공
          </button>
        </div>
        <button className="btn dark" style={{ marginTop: 12, height: 60, borderRadius: 16, fontSize: 17 }} onClick={() => { metronome.stop(); setPausedAt(p => p ?? Date.now()); setFinishing(true) }}>
          구간 끝내기
        </button>
      </div>

      {finishing && (
        <SectionFinishSheet
          section={section}
          pieceTitle={piece.title}
          stats={{ tries, rate, reached: Math.max(reached, m.bpm), start: section.bpm, seconds: itemSec }}
          queueText={target.queue.length > 1 ? `오늘 구간 ${idx + 1} / ${target.queue.length}` : ''}
          lessons={lessonsOpen}
          onResolve={resolve}
          nextLabel={nextLabel}
          onSave={save}
          onClose={() => { setFinishing(false); if (pausedAt) { setItemStart(s => s + Date.now() - pausedAt); setPausedAt(null) } }}
        />
      )}
      {showScore && piece.scoreId && <ScoreScreen scoreId={piece.scoreId} initialPage={section.page ?? 1} title={`${piece.title} · ${section.label}`} closeLabel="메트로놈 크게" onClose={() => setShowScore(false)} />}
    </div>
  )
}

const GRADES: { g: Grade; label: string }[] = [
  { g: 'bad', label: '안 됨' },
  { g: 'unsure', label: '애매' },
  { g: 'good', label: '됨' }
]

function SectionFinishSheet({
  section,
  pieceTitle,
  stats,
  queueText,
  lessons,
  onResolve,
  nextLabel,
  onSave,
  onClose
}: {
  section: Section
  pieceTitle: string
  stats: { tries: number; rate: number; reached: number; start: number; seconds: number }
  queueText: string
  lessons: ReturnType<typeof openLessons>
  onResolve: (l: Lesson, id: string) => void
  nextLabel: string | null
  onSave: (g: Grade, memo: string, next: boolean) => void
  onClose: () => void
}) {
  const [grade, setGrade] = useState<Grade>('good')
  const [memo, setMemo] = useState('')
  const tile = { background: 'var(--bg)', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 } as const
  const preview = (g: Grade) => {
    const days = nextInterval(g, section.intervalDays)
    const d = addDays(new Date(), days)
    const what = g === 'bad' ? '간격 1일로' : g === 'unsure' ? '간격 유지' : '간격 늘림'
    return { next: days === 1 ? '내일' : `${days}일 뒤`, date: `${d.getMonth() + 1}월 ${d.getDate()}일 · ${what}` }
  }
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="구간 끝내기" sub={[pieceTitle, section.label, queueText].filter(Boolean).join(' · ')} onClose={onClose} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginTop: 24 }}>
        <div style={tile}><span className="label" style={{ fontSize: 13 }}>시도</span><span style={{ fontSize: 30, fontWeight: 600, lineHeight: 1 }}>{stats.tries}</span></div>
        <div style={tile}><span className="label" style={{ fontSize: 13 }}>성공률</span><span style={{ fontSize: 30, fontWeight: 600, lineHeight: 1 }}>{stats.rate}%</span></div>
        <div style={tile}>
          <span className="label" style={{ fontSize: 13 }}>도달 BPM</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 600, lineHeight: 1 }}>{stats.reached}</span>
            {stats.reached > stats.start && <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accentText)' }}>+{stats.reached - stats.start}</span>}
          </div>
        </div>
        <div style={tile}><span className="label" style={{ fontSize: 13 }}>시간</span><span style={{ fontSize: 30, fontWeight: 600, lineHeight: 1 }}>{clock(stats.seconds)}</span></div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 28 }}>
        <span className="sec-label">오늘 이 구간은</span>
        <span style={{ fontSize: 12, color: 'var(--ink3)' }}>평가에 따라 다음 복습일이 정해져요</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginTop: 10 }}>
        {GRADES.map(({ g, label }) => {
          const on = grade === g
          const p = preview(g)
          return (
            <button key={g} className="tap" onClick={() => setGrade(g)} style={{ height: 132, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: on ? 'color-mix(in oklch, var(--accent) 22%, var(--s1))' : 'var(--bg)', border: `2px solid ${on ? 'var(--accent)' : 'transparent'}` }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{label}</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: on ? 'var(--accentText)' : 'var(--ink2)' }}>{p.next}</span>
              <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{p.date}</span>
            </button>
          )
        })}
      </div>

      {lessons.map(l => (
        <div key={l.id} style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 16, padding: '14px 14px 14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span className="label" style={{ fontSize: 13 }}>레슨 지적 · {parseDateKey(l.lesson.date).getMonth() + 1}월 {parseDateKey(l.lesson.date).getDate()}일</span>
            <span style={{ fontSize: 16 }}>{l.text}</span>
          </div>
          <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => onResolve(l.lesson, l.id)}>해결 표시</button>
        </div>
      ))}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        <span className="sec-label">한 줄 메모</span>
        <input className="field" style={{ height: 60 }} placeholder="예) 58에서 m.41 도약 흔들림 — 내일은 54부터" value={memo} onChange={e => setMemo(e.target.value)} />
      </div>

      <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
        <button className="btn" style={{ height: 68, padding: '0 30px', fontSize: 17, borderRadius: 16 }} onClick={() => onSave(grade, memo, false)}>
          저장
        </button>
        <button className="btn primary" style={{ flex: 1, height: 68, fontSize: 19, borderRadius: 16 }} onClick={() => onSave(grade, memo, true)}>
          {nextLabel ? `저장 후 ${nextLabel}` : '저장하고 마치기'} <Icon name="arrow" size={20} width={2.2} />
        </button>
      </div>
    </Sheet>
  )
}
