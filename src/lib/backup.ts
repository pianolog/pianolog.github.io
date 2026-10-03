import { db } from './db'
import { dateKey } from './time'

// 기록 백업 (JSON). 악보 PDF는 용량이 커서 제외 — 악보 목록 이름만 남긴다.

const VERSION = 1

export async function exportBackup() {
  const [sessions, entries, routine, settings, scores] = await Promise.all([
    db.sessions.toArray(),
    db.entries.toArray(),
    db.routine.toArray(),
    db.settings.toArray(),
    db.scores.toArray()
  ])
  const data = {
    app: 'piano-practice',
    version: VERSION,
    exportedAt: new Date().toISOString(),
    sessions,
    entries,
    routine,
    settings,
    scoreNames: scores.map(s => ({ id: s.id, name: s.name, pageCount: s.pageCount }))
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
  await db.transaction('rw', [db.sessions, db.entries, db.routine, db.settings], async () => {
    await Promise.all([db.sessions.clear(), db.entries.clear(), db.routine.clear()])
    await db.sessions.bulkAdd(data.sessions ?? [])
    await db.entries.bulkAdd(data.entries ?? [])
    await db.routine.bulkAdd(data.routine ?? [])
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
