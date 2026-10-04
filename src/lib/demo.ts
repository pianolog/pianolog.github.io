// 개발 서버에서 ?demo 로 열면 그럴듯한 연습 기록을 채운다 (광고·설명용 캡처). 배포 빌드에는 들어가지 않는다.
import { KEYS, type Key } from '../data/exercises'
import { db, type Entry, type Section } from './db'
import { newSection, splitMeasures } from './repertoire'
import { addDays, dateKey } from './time'

let seed = 7
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]

export async function seedDemo() {
  await db.delete()
  await db.open()
  const now = new Date()
  const day = (n: number) => dateKey(addDays(now, n))
  const at = (n: number, h: number, m = 0) => {
    const d = addDays(now, n)
    d.setHours(h, m, 0, 0)
    return d.getTime()
  }

  await db.settings.bulkPut([
    { key: 'todayKeyMode', value: 'fixed' },
    { key: 'fixedKey', value: 'D♭' },
    { key: 'dailyGoalMin', value: 180 }
  ])

  // ── 곡·구간 ──
  const [l1, l2] = (await db.lists.bulkAdd([{ name: '4학년 실기', color: '#e2a84b', order: 0 }, { name: '정기 연주회', color: '#4f8fd6', order: 1 }], { allKeys: true })) as number[]
  const pieces = [
    { title: '발라드 1번 g단조', composer: '쇼팽', opus: 'Op. 23', total: 264, size: 24, target: 72, lists: [l1] },
    { title: '피아노 소나타 31번 A♭장조 1악장', composer: '베토벤', opus: 'Op. 110', total: 116, size: 16, target: 66, lists: [l1] },
    { title: '전주곡 5번 g단조', composer: '라흐마니노프', opus: 'Op. 23', total: 86, size: 12, target: 88, lists: [l2] }
  ]
  const ids: number[] = []
  const secIds: number[][] = []
  for (const [pi, p] of pieces.entries()) {
    const id = (await db.pieces.add({ title: p.title, composer: p.composer, opus: p.opus, memo: '', listIds: p.lists, archived: 0, createdAt: at(-50 + pi, 10), scoreId: null })) as number
    ids.push(id)
    const secs: Section[] = splitMeasures(p.total, p.size).map((label, i) => {
      const s = newSection(id, i, label, p.target)
      const progress = Math.max(0, 1 - i / 14 - pi * 0.15)
      s.stage = Math.min(5, Math.round(progress * 5))
      s.bpm = Math.round(s.ladderStart + (p.target - s.ladderStart) * Math.min(1, progress + 0.15))
      const ivl = [1, 2, 4, 7, 12][i % 5]
      s.srs = { state: 'review', ease: 2.3 + (i % 3) * 0.1, ivl, due: day((i % 4) - 1), reps: 4 + i, lapses: i % 4 === 2 ? 2 : 0, last: day(-ivl), introduced: day(-40), lastRating: 'good' }
      s.reach = { B: Number(label.split('–')[1]) }
      return s
    })
    secs[5 % secs.length].weak = true
    // 발라드 앞 두 구간은 오늘 연습함
    if (pi === 0)
      for (const [i, r] of [[0, 'good'], [1, 'hard']] as const) secs[i].srs = { ...secs[i].srs, last: day(0), due: day(i ? 2 : 5), ivl: i ? 2 : 5, lastRating: r }
    secIds.push((await db.sections.bulkAdd(secs, { allKeys: true })) as number[])
  }

  await db.ddays.bulkAdd([
    { title: '4학년 전공 실기', date: day(12), pinned: true, pieceIds: [ids[0], ids[1]] },
    { title: '정기 연주회', date: day(38), pinned: true, pieceIds: [ids[2]] }
  ])
  await db.lessons.add({
    date: day(-3),
    items: [
      { id: 'a', text: 'm.68 왼손 도약 — 손목 먼저, 페달은 반만', pieceId: ids[0], sectionId: secIds[0][2], resolved: false },
      { id: 'b', text: '코다 템포 서두르지 말 것', pieceId: ids[0], resolved: false },
      { id: 'c', text: '1악장 첫 주제 노래하듯이', pieceId: ids[1], sectionId: secIds[1][0], resolved: true }
    ]
  })

  // ── 지난 기록 (오늘 포함 26일 연속, 그 전은 띄엄띄엄) ──
  const entries: Entry[] = []
  for (let n = -70; n <= 0; n++) {
    if (n < -25 && rand() < 0.3) continue
    if (n === -26) continue
    const sid = (await db.sessions.add({ date: day(n), startedAt: at(n, 9), endedAt: at(n, 12) })) as number
    const key: Key = KEYS[(n + 700) % 12]
    const growth = (n + 70) / 70
    const push = (e: Partial<Entry> & Pick<Entry, 'refType' | 'refNo' | 'title' | 'seconds'>) =>
      entries.push({ sessionId: sid, date: day(n), createdAt: at(n, 9, entries.length % 60), bpm: 0, cleanBpm: 0, hands: '양손', variations: [], rating: 0, memo: '', ...e })
    if (n === 0) {
      // 오늘: 하농 21–25 D♭, 피쉬나 15a·15b·16a, 레퍼토리 2구간
      for (const no of [21, 22, 23, 24, 25]) push({ refType: 'hanon', refNo: no, title: `하농 ${no}번`, key: 'D♭', seconds: 330, bpm: 112, cleanBpm: 108, grade: 'good' })
      for (const no of [151, 152, 161]) push({ refType: 'pischna', refNo: no, title: '피쉬나', seconds: 540, bpm: 96, cleanBpm: 92 })
      push({ refType: 'section', refNo: secIds[0][0], pieceId: ids[0], title: '발라드 1번 g단조 m.1–24', seconds: 1260, bpm: 72, cleanBpm: 72, grade: 'good' })
      push({ refType: 'section', refNo: secIds[0][1], pieceId: ids[0], title: '발라드 1번 g단조 m.25–48', seconds: 1500, bpm: 68, cleanBpm: 66, grade: 'hard' })
      continue
    }
    for (let i = 0; i < 5; i++) {
      const no = 21 + Math.floor(rand() * 10)
      const b = Math.round(76 + growth * 32 + rand() * 10)
      push({ refType: 'hanon', refNo: no, title: `하농 ${no}번`, key, seconds: 300 + Math.floor(rand() * 200), bpm: b + 4, cleanBpm: b })
    }
    for (let i = 0; i < 2; i++) {
      const no = pick([10, 20, 30, 40, 51, 52, 61, 62, 70, 80, 90, 100, 110, 120, 130, 140, 151, 152, 161, 162])
      push({ refType: 'pischna', refNo: no, title: '피쉬나', seconds: 480, bpm: Math.round(80 + growth * 20), cleanBpm: Math.round(76 + growth * 20) })
    }
    const ki = KEYS.indexOf(key)
    for (const no of [ki, ki + 12, 100 + ki, 112 + ki]) push({ refType: 'scale', refNo: no, title: '스케일', seconds: 240, bpm: Math.round(90 + growth * 30), cleanBpm: Math.round(86 + growth * 30) })
    const p = Math.floor(rand() * 3)
    push({ refType: 'section', refNo: pick(secIds[p]), pieceId: ids[p], title: pieces[p].title, seconds: 1500 + Math.floor(rand() * 2400), bpm: 64, cleanBpm: 62, grade: 'good' })
  }
  await db.entries.bulkAdd(entries)

  // ── 루틴 ──
  await db.routine.bulkAdd([
    { order: 0, refType: 'hanon', from: 21, to: 25, title: '', minutes: 30 },
    { order: 1, refType: 'pischna', from: 151, to: 180, title: '', minutes: 40 },
    { order: 2, refType: 'scale', from: 1, to: 0, title: '', minutes: 20 },
    { order: 3, refType: 'rep', from: 0, to: 0, title: '', minutes: 90 }
  ])
  await db.settings.put({ key: 'scaleSet', value: { keys: [7, 8, 9, 10], start: 7, dir: 'cw', kinds: ['ms', 'ns'] } })
  try {
    localStorage.setItem('installGuide:hide', '1')
  } catch {
    /* 무시 */
  }
}
