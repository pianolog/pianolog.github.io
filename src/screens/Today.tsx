import { useMemo, useState } from 'react'
import { relativeMinor } from '../data/exercises'
import { Icon, PlayIcon } from '../components/Icon'
import { StatusIcon } from '../components/ui'
import { useEntries, useRoutine, useSettings } from '../lib/hooks'
import { nextKeyLabel, routineLabel, routineProgress, secondsOn, streak } from '../lib/stats'
import { targetFor, useRoutineCtx } from '../lib/flow'
import { ddayLabel, entryTitle, recommendToday, useRepData } from '../lib/repertoire'
import { TAG_STYLE } from './rep/PieceDetail'
import { clock, dateKey, duration, longDate, parseDateKey, shortDate } from '../lib/time'
import { useNav } from '../nav'
import { RoutineEditor } from './RoutineEditor'
import { KeySheet } from './KeySheet'
import { SrsBar } from './SrsBar'
import { FreeStart } from './FreeStart'
import { isArpeggio, type Book } from '../data/exercises'

export function Today() {
  const nav = useNav()
  const settings = useSettings()
  const entries = useEntries()
  const routine = useRoutine()
  const [editing, setEditing] = useState(false)
  const [pickKey, setPickKey] = useState(false)

  const today = dateKey()
  const todayEntries = useMemo(() => entries.filter(e => e.date === today), [entries, today])
  const sec = secondsOn(entries, today)
  const goal = settings.dailyGoalMin * 60
  const st = streak(entries)
  const ctx = useRoutineCtx(settings, entries)
  const key = ctx.key
  const progress = routine.map(r => routineProgress(r, todayEntries, ctx))
  const plannedMin = routine.reduce((a, r) => a + r.minutes, 0)
  const next = progress.find(p => p.status !== 'done' && targetFor(p, key))
  const rep = useRepData()
  const picks = useMemo(() => recommendToday(rep, settings), [rep, settings])
  const pinned = rep.ddays.filter(d => d.pinned && d.date >= today).slice(0, 3)
  const lastLesson = rep.lessons[0]
  const lessonOpen = lastLesson?.items.filter(i => !i.resolved) ?? []
  const hasRepRoutine = routine.some(r => r.refType === 'rep')
  const srsBooks = (['hanon', 'pischna', 'scale'] as Book[]).filter(b => !routine.some(r => r.srs && r.refType === b) && ctx.cards[b].some(c => c.srs || c.status === 'new'))
  const anyCards = (['hanon', 'pischna', 'scale'] as Book[]).some(b => ctx.cards[b].some(c => c.srs))

  const start = () => {
    const t = next && targetFor(next, key)
    if (t) nav.startPractice(t)
    else nav.setTab('basics')
  }

  return (
    <div className="screen">
      <div className="screen-inner">
        <div className="page-head">
          <div>
            <div className="eyebrow">{longDate()}</div>
            <h1 className="page-title">오늘</h1>
          </div>
          <button className="btn icon s1" style={{ width: 48, height: 48, color: 'var(--ink2)' }} onClick={() => nav.openPage({ kind: 'settings' })} aria-label="설정">
            <Icon name="settings" size={24} width={1.6} />
          </button>
        </div>

        <div className="card" style={{ display: 'flex', gap: 24, padding: '20px 24px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <div className="label">오늘 연습</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>{duration(sec)}</span>
              <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink3)' }}>/ {duration(goal)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--s2)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (sec / goal) * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
            </div>
            <div className="caption">{sec >= goal ? '오늘 목표 달성' : `남은 시간 ${duration(goal - sec)}`}</div>
          </div>
          <div style={{ width: 1, background: 'var(--line)' }} />
          <div style={{ width: 96, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="label">연속 연습</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 48, fontWeight: 600, lineHeight: 1 }}>{st.days}</span>
              <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink2)' }}>일</span>
            </div>
            <div className="caption" style={{ marginTop: 'auto' }}>{st.since ? `${st.since.getMonth() + 1}월 ${st.since.getDate()}일부터` : '오늘 시작해요'}</div>
          </div>
          <div style={{ width: 1, background: 'var(--line)' }} />
          <button onClick={() => setPickKey(true)} style={{ width: 150, display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            <div className="label">오늘의 조 ›</div>
            <div className="serif" style={{ fontSize: 44, fontWeight: 600, lineHeight: 1 }}>{key}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 'auto' }}>{key} major · {relativeMinor(key)} minor</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{nextKeyLabel(settings)}</div>
          </button>
        </div>

        {pinned.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
              <span className="label">고정한 D-day</span>
              <button className="link" style={{ fontSize: 14 }} onClick={() => nav.setTab('repertoire')}>관리</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(pinned.length, 2)}, minmax(0,1fr))`, gap: 10 }}>
              {pinned.map((d, i) => (
                <div key={d.id} className="card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 14 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: i === 0 ? 'var(--accentText)' : undefined }}>{ddayLabel(d.date)}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{d.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{shortDate(parseDateKey(d.date))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: '18px 12px 12px' }}>
          <div className="card-head" style={{ padding: '0 12px 2px' }}>
            <span className="t">오늘의 루틴<span className="sub">{routine.length ? `${routine.length}개 · ${duration(plannedMin * 60)}` : ''}</span></span>
            <button className="link" onClick={() => setEditing(true)}>{routine.length ? '편집' : '만들기'}</button>
          </div>
          {progress.length === 0 && (
            <div className="empty">
              매일 하는 연습을 루틴으로 만들어 두면
              <br />
              여기서 바로 시작하고 진행 상황을 볼 수 있어요.
            </div>
          )}
          {progress.map(p => {
            const sub =
              p.status === 'done' ? `완료 · ${duration(p.seconds)}` : p.status === 'prog' ? `진행 중 · ${p.item.refType === 'free' ? duration(p.seconds) : `${p.done} / ${p.total}`}` : '대기'
            return (
              <button key={p.item.id} onClick={() => { const t = targetFor(p, key); if (t) nav.startPractice(t) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, minHeight: 66, padding: '0 14px', borderRadius: 12, background: p === next && p.status === 'prog' ? 'var(--s2)' : 'transparent', textAlign: 'left' }}>
                <StatusIcon status={p.status} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className={p.item.refType === 'free' ? 'serif' : ''} style={{ fontSize: 17, fontWeight: 600, color: p.status === 'done' ? 'var(--ink2)' : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {routineLabel(p.item, key)}
                  </span>
                  <span style={{ fontSize: 13, color: p.status === 'prog' ? 'var(--accentText)' : 'var(--ink3)', fontWeight: p.status === 'prog' ? 600 : 400 }}>{sub}</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink2)' }}>{p.item.minutes}분</span>
                <Icon name="right" size={20} width={1.8} style={{ color: 'var(--ink3)' }} />
              </button>
            )
          })}
        </div>

        {picks.length > 0 && !hasRepRoutine && (
          <div className="card" style={{ padding: '18px 12px 12px' }}>
            <div className="card-head" style={{ padding: '0 12px' }}>
              <span className="t">오늘의 레퍼토리<span className="sub">{picks.length}개 구간 · 자동 추천</span></span>
            </div>
            {picks.map(p => (
              <button key={p.section.id} onClick={() => nav.startPractice({ refType: 'section', queue: [p.section.id!] })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, minHeight: 60, padding: '4px 14px', textAlign: 'left' }}>
                <StatusIcon status={p.doneToday ? 'done' : 'pend'} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span className="serif" style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.piece.title} · {p.section.label}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{p.tags.map(t => <span key={t.text} style={TAG_STYLE[t.kind]}>{t.text}</span>)}</div>
                </div>
                <Icon name="right" size={20} width={1.8} style={{ color: 'var(--ink3)' }} />
              </button>
            ))}
            <button className="btn" style={{ width: '100%', marginTop: 6 }} onClick={() => nav.startPractice({ refType: 'section', queue: picks.filter(p => !p.doneToday).map(p => p.section.id!) })} disabled={picks.every(p => p.doneToday)}>
              <PlayIcon size={18} /> 차례로 연습
            </button>
          </div>
        )}

        {anyCards && srsBooks.length > 0 && (
          <div className="card" style={{ padding: '18px 12px 8px' }}>
            <div className="card-head" style={{ padding: '0 12px' }}>
              <span className="t">기초 간격 복습<span className="sub">하루 한도 · 설정에서 바꿔요</span></span>
            </div>
            {srsBooks.flatMap(b =>
              b === 'scale'
                ? [
                    <SrsBar key="scale" plain book="scale" label="스케일" items={ctx.cards.scale.filter(c => !isArpeggio(c.no))} />,
                    <SrsBar key="arpeggio" plain book="scale" label="아르페지오" items={ctx.cards.scale.filter(c => isArpeggio(c.no))} />
                  ]
                : [<SrsBar key={b} plain book={b} items={ctx.cards[b]} />]
            )}
          </div>
        )}

        <FreeStart />

        {lessonOpen.length > 0 && (
          <div className="card">
            <div className="card-head">
              <span className="label">최근 레슨 · {shortDate(parseDateKey(lastLesson.date))}</span>
              <button className="link" style={{ fontSize: 14 }} onClick={() => nav.setTab('records')}>전체</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 15, lineHeight: 1.45 }}>
              {lessonOpen.slice(0, 3).map(it => (
                <div key={it.id} style={{ display: 'flex', gap: 10 }}><span style={{ color: 'var(--ink3)' }}>·</span><span>{it.text}</span></div>
              ))}
            </div>
          </div>
        )}

        {todayEntries.length > 0 && (
          <div className="card">
            <div className="card-head">
              <span className="t">오늘 기록<span className="sub">{todayEntries.length}개</span></span>
            </div>
            {[...todayEntries].reverse().map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line)', fontSize: 15 }}>
                <span style={{ fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entryTitle(e)}
                  {e.key && <span className="serif" style={{ color: 'var(--ink2)', marginLeft: 8 }}>{e.key}</span>}
                </span>
                <span style={{ color: 'var(--ink2)' }}>클린 {e.cleanBpm}</span>
                <span style={{ color: 'var(--ink3)', width: 64, textAlign: 'right' }}>{clock(e.seconds)}</span>
              </div>
            ))}
          </div>
        )}

        <button className="tap" onClick={start} style={{ marginTop: 4, height: 76, flex: 'none', borderRadius: 18, background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', gap: 14, padding: '0 26px' }}>
          <PlayIcon />
          <span style={{ fontSize: 21, fontWeight: 700 }}>연습 시작</span>
          <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 500 }}>{next ? `${routineLabel(next.item, key)} ${next.status === 'prog' ? '이어서' : ''}` : '항목 고르기'}</span>
        </button>
      </div>
      {editing && <RoutineEditor onClose={() => setEditing(false)} />}
      {pickKey && <KeySheet onClose={() => setPickKey(false)} />}
    </div>
  )
}
