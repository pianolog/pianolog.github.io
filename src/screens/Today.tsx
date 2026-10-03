import { useMemo, useState } from 'react'
import { RELATIVE_MINOR, exerciseTitle } from '../data/exercises'
import { Icon, PlayIcon } from '../components/Icon'
import { StatusIcon } from '../components/ui'
import { useEntries, useRoutine, useSettings } from '../lib/hooks'
import { nextKeyLabel, routineLabel, routineNumbers, routineProgress, secondsOn, streak, todayKey, type RoutineProgress } from '../lib/stats'
import { dateKey, duration, longDate, clock } from '../lib/time'
import { useNav, type PracticeTarget } from '../nav'
import { RoutineEditor } from './RoutineEditor'
import type { Key } from '../data/exercises'

export function targetFor(p: RoutineProgress, key: Key): PracticeTarget {
  const { item } = p
  if (item.refType === 'free') return { refType: 'free', title: item.title, routineId: item.id }
  const nums = routineNumbers(item)
  const from = p.nextNo ?? nums[0]
  return { refType: item.refType, queue: nums.slice(nums.indexOf(from)), key: item.refType === 'hanon' ? key : undefined, routineId: item.id }
}

export function Today() {
  const nav = useNav()
  const settings = useSettings()
  const entries = useEntries()
  const routine = useRoutine()
  const [editing, setEditing] = useState(false)

  const today = dateKey()
  const todayEntries = useMemo(() => entries.filter(e => e.date === today), [entries, today])
  const sec = secondsOn(entries, today)
  const goal = settings.dailyGoalMin * 60
  const st = streak(entries)
  const key = todayKey(settings.todayKeyMode, entries)
  const progress = routine.map(r => routineProgress(r, todayEntries))
  const plannedMin = routine.reduce((a, r) => a + r.minutes, 0)
  const next = progress.find(p => p.status !== 'done')

  const start = () => {
    if (next) nav.startPractice(targetFor(next, key))
    else nav.setTab('practice')
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
          <div style={{ width: 150, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="label">오늘의 조</div>
            <div className="serif" style={{ fontSize: 44, fontWeight: 600, lineHeight: 1 }}>{key}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 'auto' }}>{key} major · {RELATIVE_MINOR[key]} minor</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{nextKeyLabel(settings.todayKeyMode)}</div>
          </div>
        </div>

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
              <button key={p.item.id} onClick={() => nav.startPractice(targetFor(p, key))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, minHeight: 66, padding: '0 14px', borderRadius: 12, background: p === next && p.status === 'prog' ? 'var(--s2)' : 'transparent', textAlign: 'left' }}>
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

        {todayEntries.length > 0 && (
          <div className="card">
            <div className="card-head">
              <span className="t">오늘 기록<span className="sub">{todayEntries.length}개</span></span>
            </div>
            {[...todayEntries].reverse().map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line)', fontSize: 15 }}>
                <span style={{ fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.refType === 'free' ? e.title : exerciseTitle(e.refType, e.refNo)}
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
    </div>
  )
}
