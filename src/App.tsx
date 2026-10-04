import { useEffect, useMemo, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { ToastProvider } from './components/ui'
import { requestPersist } from './lib/backup'
import { useSettings, useThemeAttr } from './lib/hooks'
import { metronome } from './lib/metronome'
import { NavCtx, type Nav, type Page, type PracticeTarget, type Tab } from './nav'
import { Basics } from './screens/Basics'
import { ExerciseDetail } from './screens/ExerciseDetail'
import { PracticeMode } from './screens/PracticeMode'
import { Records } from './screens/Records'
import { Repertoire } from './screens/Repertoire'
import { ScoreScreen } from './screens/ScoreScreen'
import { SettingsPage } from './screens/Settings'
import { Today } from './screens/Today'
import { PieceDetail } from './screens/rep/PieceDetail'
import { RunReview } from './screens/rep/RunReview'
import { RunThrough } from './screens/rep/RunThrough'
import { SectionPractice } from './screens/rep/SectionPractice'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: '오늘', icon: 'today' },
  { id: 'basics', label: '기초', icon: 'basics' },
  { id: 'repertoire', label: '레퍼토리', icon: 'repertoire' },
  { id: 'records', label: '기록', icon: 'records' }
]

export function App() {
  const settings = useSettings()
  useThemeAttr(settings.theme)
  const [tab, setTabState] = useState<Tab>('today')
  const [page, setPage] = useState<Page | null>(null)
  const [practice, setPractice] = useState<PracticeTarget | null>(null)
  const [score, setScore] = useState<{ id: number; page: number } | null>(null)
  const [run, setRun] = useState<number | null>(null)
  const [practiceKey, setPracticeKey] = useState(0)

  useEffect(() => {
    void requestPersist()
  }, [])

  const nav = useMemo<Nav>(
    () => ({
      tab,
      setTab: t => {
        setPage(null)
        setTabState(t)
      },
      page,
      openPage: setPage,
      closePage: () => setPage(null),
      startPractice: t => {
        metronome.unlock() // iOS: 터치 안에서 오디오 깨우기
        setPractice(t)
        setPracticeKey(k => k + 1)
      },
      openScore: (id, p = 1) => setScore({ id, page: p }),
      startRun: pieceId => {
        metronome.stop()
        setRun(pieceId)
      }
    }),
    [tab, page]
  )

  let body
  if (page?.kind === 'detail') body = <ExerciseDetail key={`${page.book}${page.no}`} book={page.book} no={page.no} />
  else if (page?.kind === 'settings') body = <SettingsPage />
  else if (page?.kind === 'piece') body = <PieceDetail key={page.pieceId} pieceId={page.pieceId} />
  else if (page?.kind === 'run') body = <RunReview key={page.runId} runId={page.runId} />
  else if (tab === 'today') body = <Today />
  else if (tab === 'basics') body = <Basics />
  else if (tab === 'repertoire') body = <Repertoire />
  else body = <Records />

  const activeTab = page?.kind === 'detail' ? 'basics' : page?.kind === 'settings' ? 'today' : page?.kind === 'piece' || page?.kind === 'run' ? 'repertoire' : tab

  return (
    <NavCtx.Provider value={nav}>
      <ToastProvider>
        <div className="app">
          {body}
          <nav className="tabbar">
            {TABS.map(t => (
              <button key={t.id} className={activeTab === t.id ? 'on' : ''} onClick={() => nav.setTab(t.id)}>
                <Icon name={t.icon} size={26} width={1.6} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
        {practice && (practice.refType === 'section' ? <SectionPractice key={practiceKey} target={practice} onClose={() => setPractice(null)} /> : <PracticeMode key={practiceKey} target={practice} onClose={() => setPractice(null)} />)}
        {run !== null && (
          <RunThrough
            pieceId={run}
            onCancel={() => setRun(null)}
            onDone={id => {
              setRun(null)
              setPage({ kind: 'run', runId: id })
            }}
          />
        )}
        {score && <ScoreScreen scoreId={score.id} initialPage={score.page} closeLabel="닫기" onClose={() => setScore(null)} />}
      </ToastProvider>
    </NavCtx.Provider>
  )
}
