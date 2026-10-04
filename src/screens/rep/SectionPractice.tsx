import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon, PauseIcon, PlayIcon } from '../../components/Icon'
import { Sheet, SheetHead, useToast } from '../../components/ui'
import { db, type Attempt, type HandKey, type Lesson, type Section } from '../../lib/db'
import { nextRoutineTarget } from '../../lib/flow'
import { useNow, useSettings, useWakeLock } from '../../lib/hooks'
import { metronome, useMetronome } from '../../lib/metronome'
import { HAND_KEYS, HAND_LABEL, PRACTICE_WAYS, mergeReach, openLessons, parseMeasures, scheduleAfter, sectionOpts, spanText, STAGES, summarizeAttempts } from '../../lib/repertoire'
import { RATING_LABEL, ivlLabel, type Rating, type SrsOpts } from '../../lib/srs'
import { clock, dateKey, parseDateKey } from '../../lib/time'
import { RatingButtons } from '../../components/Rating'
import { useNav, type PracticeTarget } from '../../nav'
import { ScoreScreen } from '../ScoreScreen'

export function SectionPractice({ target, onClose }: { target: Extract<PracticeTarget, { refType: 'section' }>; onClose: () => void }) {
  const nav = useNav()
  const toast = useToast()
  const settings = useSettings()
  const m = useMetronome()
  const [idx, setIdx] = useState(0)
  // '다시'를 누른 구간은 오늘 큐 끝에 다시 붙는다
  const [queue, setQueue] = useState(target.queue)
  const sectionId = queue[idx]
  const data = useLiveQuery(async () => {
    const section = await db.sections.get(sectionId)
    const piece = section ? await db.pieces.get(section.pieceId) : undefined
    const [lessons, ddays] = await Promise.all([db.lessons.toArray(), db.ddays.toArray()])
    return { section, piece, lessons, ddays }
  }, [sectionId])
  const section = data?.section
  const piece = data?.piece

  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStart] = useState(() => Date.now())
  const [itemStart, setItemStart] = useState(() => Date.now())
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [misses, setMisses] = useState(0)
  const [reached, setReached] = useState(0)
  // 한 번 칠 때마다 손·마디·방법을 남긴다
  const [log, setLog] = useState<Attempt[]>([])
  const [hand, setHand] = useState<HandKey>('B')
  const [span, setSpan] = useState<{ a: number; b: number } | null>(null) // null = 구간 전체
  const [pickFrom, setPickFrom] = useState<number | null>(null)
  const [stripOpen, setStripOpen] = useState(false) // 마디 칸 펼치기
  const [ways, setWays] = useState<string[]>([])
  const bpmByHand = useRef<Partial<Record<HandKey, number>>>({})
  const [bothBpm, setBothBpm] = useState(0) // 양손으로 친 템포 — 구간 BPM으로 저장
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
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!section || loadedFor.current === `${idx}:${section.id}`) return
    loadedFor.current = `${idx}:${section.id}`
    metronome.setBpm(section.bpm)
    setItemStart(Date.now())
    setPausedAt(null)
    setStreak(0)
    setMisses(0)
    setReached(section.bpm)
    setFlash('')
    setLog([])
    setHand('B')
    setSpan(null)
    setPickFrom(null)
    setStripOpen(false)
    setWays([])
    bpmByHand.current = {}
    setBothBpm(section.bpm)
  }, [section, idx])

  useEffect(() => {
    if (hand === 'B') setBothBpm(m.bpm)
  }, [hand, m.bpm])

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
  const whole = parseMeasures(section.label)
  const cur = span ?? whole
  const tries = log.length
  const oks = log.filter(x => x.ok).length
  const mine = log.filter(x => x.h === hand && (!cur || (x.a === cur.a && x.b === cur.b)))
  const record = (ok: boolean) => setLog(l => [...l, { h: hand, a: cur?.a ?? 0, b: cur?.b ?? 0, ok, bpm: m.bpm, w: ways.length ? ways : undefined }])

  // 손이나 범위를 바꾸면 연속 성공은 처음부터, 템포는 그 손으로 마지막에 친 템포로
  const changeHand = (h: HandKey) => {
    if (h === hand) return
    bpmByHand.current[hand] = m.bpm
    const prev = bpmByHand.current[h] ?? (h === 'B' ? bothBpm : undefined)
    if (prev) metronome.setBpm(prev)
    setHand(h)
    setStreak(0)
    setMisses(0)
  }
  const tapMeasure = (n: number) => {
    setStreak(0)
    if (pickFrom === null) {
      setPickFrom(n)
      setSpan({ a: n, b: n })
    } else {
      setSpan({ a: Math.min(pickFrom, n), b: Math.max(pickFrom, n) })
      setPickFrom(null)
      setStripOpen(false)
    }
  }
  const undo = () => {
    setLog(l => l.slice(0, -1))
    setStreak(x => Math.max(0, x - 1))
    setFlash('')
  }
  // 이 손으로 통과한 마디: 이전 진도 + 오늘 성공
  const passed = new Set<number>()
  if (whole) {
    const r = mergeReach(whole.a, whole.b, section.reach?.[hand], [])
    if (r) for (let n = whole.a; n <= r; n++) passed.add(n)
    for (const x of log) if (x.ok && x.h === hand && x.a) for (let n = x.a; n <= x.b; n++) passed.add(n)
  }
  const lessonsOpen = openLessons(data!.lessons, section.id!)
  const nextStep = steps.find(v => v > m.bpm)
  const prevStep = [...steps].reverse().find(v => v < m.bpm)

  const hit = () => {
    record(true)
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
    record(false)
    setStreak(0)
    setMisses(x => x + 1)
    setFlash('')
  }
  const toastFlash = (msg: string) => setFlash(msg)

  const resolve = async (lesson: Lesson, itemId: string) => {
    await db.lessons.update(lesson.id!, { items: lesson.items.map(it => (it.id === itemId ? { ...it, resolved: true } : it)) })
    toast('해결로 표시했어요')
  }

  const opts = sectionOpts(settings, piece.id!, data!.ddays)

  const save = async (grade: Rating, memo: string, goNext: boolean) => {
    if (!sessionId) return
    const prev = section
    const entryId = await db.entries.add({
      sessionId,
      date: dateKey(),
      createdAt: Date.now(),
      refType: 'section',
      refNo: section.id!,
      pieceId: piece.id,
      title: `${piece.title} ${section.label}`,
      seconds: Math.round(Math.max(1, itemSec)),
      bpm: Math.max(reached, m.bpm),
      cleanBpm: Math.max(0, ...log.filter(x => x.ok && x.h === 'B').map(x => x.bpm)) || bothBpm,
      hands: HAND_LABEL[mainHand(log)],
      variations: [...new Set(log.flatMap(x => x.w ?? []))],
      rating: 0,
      memo: memo.trim(),
      attempts: tries,
      successes: oks,
      attemptLog: log.length ? log : undefined,
      grade,
      srsKind: section.srs.state === 'new' ? 'new' : section.srs.state === 'review' ? 'review' : 'learn'
    })
    const sched = scheduleAfter(section, grade, opts)
    const reach = { ...section.reach }
    if (whole)
      for (const h of HAND_KEYS) {
        const r = mergeReach(whole.a, whole.b, reach[h], log.filter(x => x.ok && x.h === h && x.a))
        if (r) reach[h] = r
      }
    await db.sections.update(section.id!, { bpm: Math.min(bothBpm || section.bpm, section.targetBpm), reach, ...sched })
    await db.sessions.update(sessionId, { endedAt: Date.now() })
    setFinishing(false)
    metronome.stop()
    const q = grade === 'again' ? [...queue, section.id!] : queue
    setQueue(q)
    toast(grade === 'again' ? `${section.label} · 오늘 끝에 한 번 더` : `${section.label} · ${RATING_LABEL[grade]} · 다음 ${ivlLabel(sched.srs!.ivl)}`, {
      label: '되돌리기',
      run: () => {
        void db.entries.delete(entryId as number)
        void db.sections.update(prev.id!, { bpm: prev.bpm, srs: prev.srs, weak: prev.weak, reach: prev.reach })
        if (grade === 'again') setQueue(x => x.slice(0, -1))
      }
    })
    if (!goNext) return onClose()
    if (idx + 1 < q.length) return setIdx(i => i + 1)
    const next = target.routineId ? await nextRoutineTarget(target.routineId) : null
    if (next && next.refType !== 'section') nav.startPractice(next)
    else onClose()
  }

  const close = () => {
    if (tries > 0 && !window.confirm('이 구간을 기록하지 않고 나갈까요?')) return
    onClose()
  }

  const nextLabel = idx + 1 < queue.length ? '다음 구간' : target.routineId ? '루틴 다음 항목' : null
  const rate = tries ? Math.round((oks / tries) * 100) : 0

  return (
    <div className="full">
      <div className="pm">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 80 }}>
          <button className="btn icon s1" style={{ color: 'var(--ink2)' }} onClick={close} aria-label="연습 끝내기">
            <Icon name="close" width={1.8} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {piece.title} · {section.label}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {queue.length > 1 && <span className="chip">오늘 구간 {idx + 1} / {queue.length}</span>}
              {queue.indexOf(section.id!) < idx && <span className="chip" style={{ color: 'var(--alert)' }}>오늘 다시</span>}
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

        <div className="pm-body">
        <div className="pm-main" style={{ alignItems: 'center', gap: 8, padding: '14px 0' }}>
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
          <div className="pm-bpm compact">{m.bpm}</div>
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

        <div className="pm-side">
        <div style={{ background: 'var(--s1)', borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {HAND_KEYS.map(h => {
              const on = hand === h
              const n = log.filter(x => x.h === h).length
              return (
                <button
                  key={h}
                  className="tap"
                  onClick={() => changeHand(h)}
                  style={{ height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', background: on ? 'var(--ink)' : 'var(--bg)', color: on ? 'var(--bg)' : 'var(--ink2)' }}
                >
                  {HAND_LABEL[h]}
                  <span style={{ minWidth: 26, height: 26, borderRadius: 13, padding: '0 7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: n ? 'var(--accent)' : 'transparent', color: n ? 'var(--accentInk)' : on ? 'var(--bg)' : 'var(--ink3)', opacity: n ? 1 : 0.6 }}>{n}</span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="sec-label" style={{ marginRight: 4 }}>방법</span>
            {PRACTICE_WAYS.map(w => {
              const on = ways.includes(w)
              return (
                <button key={w} className={`pick${on ? ' on' : ''}`} style={{ height: 40, padding: '0 14px', fontSize: 14 }} onClick={() => setWays(x => (on ? x.filter(v => v !== w) : [...x, w]))}>
                  {w}
                </button>
              )
            })}
            <span className="caption" style={{ marginLeft: 'auto' }}>켜 둔 방법이 칠 때마다 함께 기록돼요</span>
          </div>
          {whole && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="sec-label">마디</span>
                <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {cur ? spanText(cur.a, cur.b) : ''}
                  {!span && ' 전체'}
                </span>
                {stripOpen ? (
                  <span className="caption" style={{ flex: 1 }}>{pickFrom !== null ? '끝 마디를 누르세요' : '시작 마디 → 끝 마디 순서로 누르세요 · 초록 줄 = 통과'}</span>
                ) : (
                  <button onClick={() => setStripOpen(true)} aria-label="마디 범위 고르기" style={{ flex: 1, minWidth: 60, height: 28, display: 'flex', alignItems: 'center', gap: 1 }}>
                    {Array.from({ length: whole.b - whole.a + 1 }, (_, i) => whole.a + i).map(n => (
                      <span key={n} style={{ flex: 1, height: span && n >= span.a && n <= span.b ? 14 : 8, borderRadius: 2, background: passed.has(n) ? 'var(--ok)' : span && n >= span.a && n <= span.b ? 'var(--accent)' : 'var(--line)' }} />
                    ))}
                  </button>
                )}
                {span && (
                  <button className="link" style={{ fontSize: 14, whiteSpace: 'nowrap' }} onClick={() => { setSpan(null); setPickFrom(null); setStreak(0) }}>
                    전체로
                  </button>
                )}
                <button className="btn sm" style={{ height: 40, flex: 'none' }} onClick={() => { setStripOpen(o => !o); setPickFrom(null) }}>
                  {stripOpen ? '닫기' : '범위 고르기'}
                </button>
              </div>
              {stripOpen && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Array.from({ length: whole.b - whole.a + 1 }, (_, i) => whole.a + i).map(n => {
                    const inSpan = !!span && n >= span.a && n <= span.b
                    return (
                      <button
                        key={n}
                        onClick={() => tapMeasure(n)}
                        style={{ flex: '1 0 40px', maxWidth: 64, height: 40, borderRadius: 8, fontSize: 14, fontWeight: 600, position: 'relative', background: inSpan ? 'color-mix(in oklch, var(--accent) 35%, var(--s1))' : 'var(--bg)', border: n === pickFrom ? '2px solid var(--accent)' : '2px solid transparent', color: inSpan ? 'var(--ink)' : 'var(--ink2)' }}
                      >
                        {n}
                        {passed.has(n) && <span style={{ position: 'absolute', left: 6, right: 6, bottom: 3, height: 3, borderRadius: 2, background: 'var(--ok)' }} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
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
            <span style={{ fontSize: 14, color: 'var(--ink3)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>
                <b style={{ color: 'var(--ink)', fontSize: 16 }}>
                  {HAND_LABEL[hand]}
                  {cur ? ` ${spanText(cur.a, cur.b)}` : ''} {mine.length}번
                </b>{' '}
                · 성공 {mine.filter(x => x.ok).length} · 오늘 전체 {tries}번 · 성공률 {rate}%
              </span>
              {tries > 0 && (
                <button className="link" style={{ fontSize: 14 }} onClick={undo}>
                  방금 것 취소
                </button>
              )}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button className="tap pm-hit" onClick={miss} style={{ borderRadius: 24, background: 'var(--s1)', color: 'var(--alert)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontSize: 28, fontWeight: 700 }}>
            <Icon name="close" size={30} width={2.4} /> 실수
          </button>
          <button className="tap pm-hit" onClick={hit} style={{ borderRadius: 24, background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontSize: 28, fontWeight: 700 }}>
            <Icon name="check" size={32} width={2.6} /> 성공
          </button>
        </div>
        <button className="btn dark" style={{ marginTop: 12, height: 60, borderRadius: 16, fontSize: 17 }} onClick={() => { metronome.stop(); setPausedAt(p => p ?? Date.now()); setFinishing(true) }}>
          구간 끝내기
        </button>
        </div>
        </div>
      </div>

      {finishing && (
        <SectionFinishSheet
          section={section}
          pieceTitle={piece.title}
          stats={{ tries, rate, reached: Math.max(reached, m.bpm), start: section.bpm, seconds: itemSec }}
          log={log}
          queueText={queue.length > 1 ? `오늘 구간 ${idx + 1} / ${queue.length}` : ''}
          opts={opts}
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

function SectionFinishSheet({
  section,
  pieceTitle,
  stats,
  queueText,
  log,
  opts,
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
  log: Attempt[]
  opts: SrsOpts
  lessons: ReturnType<typeof openLessons>
  onResolve: (l: Lesson, id: string) => void
  nextLabel: string | null
  onSave: (g: Rating, memo: string, next: boolean) => void
  onClose: () => void
}) {
  const [grade, setGrade] = useState<Rating>(stats.tries && stats.rate < 50 ? 'hard' : 'good')
  const [memo, setMemo] = useState('')
  const tile = { background: 'var(--bg)', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 } as const
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

      {log.length > 0 && <AttemptSummary section={section} log={log} />}

      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 28 }}>
        <span className="sec-label">오늘 이 구간은</span>
        <span style={{ fontSize: 12, color: 'var(--ink3)' }}>버튼 아래 숫자가 다음 복습까지의 간격이에요{opts.cap ? ` · D-day 때문에 최대 ${ivlLabel(opts.cap)}` : ''}</span>
      </div>
      <div style={{ marginTop: 10 }}>
        <RatingButtons srs={section.srs} opts={opts} value={grade} onChange={setGrade} />
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

/** 가장 많이 친 손 (양손을 한 번이라도 쳤으면 양손) */
function mainHand(log: Attempt[]): HandKey {
  if (!log.length || log.some(x => x.h === 'B')) return 'B'
  return log.filter(x => x.h === 'R').length >= log.filter(x => x.h === 'L').length ? 'R' : 'L'
}

/** 구간 끝내기: 손마다 친 횟수·마디, 방법, 처음부터 이어서 통과한 마디 */
function AttemptSummary({ section, log }: { section: Section; log: Attempt[] }) {
  const whole = parseMeasures(section.label)
  const ways = new Map<string, number>()
  for (const x of log) for (const w of x.w ?? []) ways.set(w, (ways.get(w) ?? 0) + 1)
  return (
    <div style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 16, padding: '6px 18px 10px', display: 'flex', flexDirection: 'column' }}>
      {summarizeAttempts(log).map(x => {
        const before = section.reach?.[x.h]
        const after = whole ? mergeReach(whole.a, whole.b, before, log.filter(l => l.ok && l.h === x.h && l.a)) : undefined
        return (
          <div key={x.h} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 12, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontWeight: 700 }}>{HAND_LABEL[x.h]}</span>
            <span style={{ fontSize: 14, color: 'var(--ink2)' }}>
              {x.spans.join(', ')}
              {whole && after && (
                <span style={{ marginLeft: 8, color: after !== before ? 'var(--ok)' : 'var(--ink3)', fontWeight: after !== before ? 600 : 400 }}>
                  {after >= whole.b ? '끝까지 통과' : `m.${after}까지 통과`}
                </span>
              )}
            </span>
            <span style={{ fontSize: 15 }}>
              <b>{x.n}번</b> <span style={{ color: 'var(--ink3)' }}>· 성공 {x.ok}</span>
            </span>
          </div>
        )
      })}
      {ways.size > 0 && <span style={{ fontSize: 14, color: 'var(--ink2)', paddingTop: 8 }}>{[...ways].map(([w, n]) => `${w} ${n}번`).join(' · ')}</span>}
    </div>
  )
}
