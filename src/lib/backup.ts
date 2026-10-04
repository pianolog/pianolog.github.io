import { db, migrateSection } from './db'
import { migrateGrade } from './srs'
import { dateKey } from './time'

// 기록 백업 (JSON). 악보 PDF와 런스루 녹음은 용량이 커서 제외한다.

const VERSION = 3
const REP_TABLES = ['lists', 'pieces', 'sections', 'runs', 'ddays', 'lessons', 'cards'] as const

export async function exportBackup() {
  const [sessions, entries, routine, settings, scores, ...rep] = await Promise.all([
    db.sessions.toArray(),
    db.entries.toArray(),
    db.routine.toArray(),
    db.settings.toArray(),
    db.scores.toArray(),
    ...REP_TABLES.map(t => db.table(t).toArray())
  ])
  const data = {
    app: 'piano-practice',
    version: VERSION,
    exportedAt: new Date().toISOString(),
    sessions,
    entries,
    routine,
    settings,
    scoreNames: scores.map(s => ({ id: s.id, name: s.name, pageCount: s.pageCount })),
    ...Object.fromEntries(REP_TABLES.map((t, i) => [t, t === 'runs' ? rep[i].map(r => ({ ...r, recordingId: undefined })) : rep[i]]))
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const name = `피아노연습-백업-${dateKey()}.json`
  const file = new File([blob], name, { type: 'application/json' })

  // iPad: 공유 시트 → "파일에 저장"으로 iCloud Drive에 바로 저장
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text())
  if (data?.app !== 'piano-practice') throw new Error('이 앱의 백업 파일이 아니에요.')
  await db.transaction('rw', [db.sessions, db.entries, db.routine, db.settings, ...REP_TABLES.map(t => db.table(t))], async () => {
    await Promise.all([db.sessions.clear(), db.entries.clear(), db.routine.clear()])
    await db.sessions.bulkAdd(data.sessions ?? [])
    // 옛 백업(v2)의 3단계 평가와 구간 복습 필드를 새 형식으로
    await db.entries.bulkAdd((data.entries ?? []).map((e: { grade?: unknown }) => (e.grade ? { ...e, grade: migrateGrade(e.grade) } : e)))
    for (const s of data.sections ?? []) migrateSection(s)
    await db.routine.bulkAdd(data.routine ?? [])
    for (const t of REP_TABLES) {
      if (!data[t]) continue
      await db.table(t).clear()
      // 곡의 악보 연결은 이 기기의 PDF id라서 지운다
      await db.table(t).bulkAdd(t === 'pieces' ? data[t].map((p: { scoreId?: number }) => ({ ...p, scoreId: null })) : data[t])
    }
    // 악보 연결은 이 기기의 PDF id에 묶여 있어서 가져오지 않는다
    const settings = (data.settings ?? []).filter((s: { key: string }) => s.key !== 'hanonBook' && s.key !== 'pischnaBook')
    await db.settings.bulkPut(settings)
  })
  return { entries: data.entries?.length ?? 0 }
}

/** 브라우저가 저장 공간을 임의로 비우지 않도록 요청 */
export async function requestPersist() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* 지원 안 하는 환경 */
  }
}
