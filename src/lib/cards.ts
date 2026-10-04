import { useLiveQuery } from 'dexie-react-hooks'
import { CHROMATIC, KEYS, bookItems, scaleNo, type Book, type Key } from '../data/exercises'
import { cardId, db, type Card, type Settings } from './db'
import { againToday, doneToday, isDue, newSrs, schedule, type Rating, type Srs } from './srs'
import { dateKey } from './time'

// 기초 카드: 하농 번호×조, 피쉬나 번호, 스케일·아르페지오 조. 한 번도 평가 안 한 카드는 표에 없고 '새 카드'로 본다.

export type CardStatus = 'done' | 'review' | 'new' | 'again'

export interface CardItem {
  id: string
  book: Book
  no: number
  key?: Key
  srs?: Srs
  status: CardStatus
}

const EMPTY = new Map<string, Card>()

export function useCards(): Map<string, Card> {
  return useLiveQuery(async () => new Map((await db.cards.toArray()).map(c => [c.id, c])), [], EMPTY)
}

export async function loadCards() {
  return new Map((await db.cards.toArray()).map(c => [c.id, c]))
}

/** 오늘의 조부터 5도권을 한 바퀴 */
const keysFrom = (key: Key) => KEYS.map((_, i) => KEYS[(KEYS.indexOf(key) + i) % 12])

/** 이 책의 모든 카드 (새 카드를 꺼낼 순서). 스케일 책은 [스케일 묶음, 아르페지오 묶음] 두 갈래 */
export function bookCards(book: Book, splits: number[], key: Key): { no: number; key?: Key }[][] {
  if (book === 'hanon') return [keysFrom(key).flatMap(k => bookItems('hanon', splits).map(it => ({ no: it.no, key: k })))]
  if (book === 'pischna') return [bookItems('pischna', splits).map(it => ({ no: it.no }))]
  const ks = keysFrom(key).map(k => KEYS.indexOf(k))
  // 스케일: 조마다 장조 → 관계 단조 (하농 39), 반음계(40)는 첫 조 다음에
  const scales = ks.flatMap(i => [{ no: scaleNo(0, i) }, { no: scaleNo(0, i + 12) }])
  scales.splice(2, 0, { no: CHROMATIC })
  // 아르페지오: 조마다 장조 → 단조 (41) → 속7화음 (42) → 감7화음 (43)
  const arps = ks.flatMap(i => [{ no: scaleNo(1, i) }, { no: scaleNo(1, i + 12) }, { no: scaleNo(3, i) }, { no: scaleNo(4, i) }])
  return [scales, arps]
}

/**
 * 오늘 할 카드 (Anki 순서): 오늘 이미 한 것 → 복습(하루 상한) → 새 카드(하루 한도) → 오늘 다시
 * 한도는 갈래마다 따로 — 스케일과 아르페지오는 각각 하루 한도를 쓴다
 */
export function cardQueue(book: Book, cards: Map<string, Card>, o: { splits: number[]; key: Key; settings: Settings; today?: string }): CardItem[] {
  return bookCards(book, o.splits, o.key).flatMap(group => pickCards(book, group, cards, o.settings, o.today ?? dateKey()))
}

function pickCards(book: Book, all: { no: number; key?: Key }[], cards: Map<string, Card>, settings: Settings, today: string): CardItem[] {
  const order = new Map(all.map((c, i) => [cardId(book, c.no, c.key), i]))
  const done: CardItem[] = []
  const reviews: CardItem[] = []
  const fresh: CardItem[] = []
  const again: CardItem[] = []
  let newUsed = 0
  let reviewsUsed = 0
  for (const c of all) {
    const id = cardId(book, c.no, c.key)
    const srs = cards.get(id)?.srs
    const item = { id, book, no: c.no, key: c.key, srs }
    if (!srs) {
      fresh.push({ ...item, status: 'new' })
      continue
    }
    if (srs.introduced === today) newUsed++
    if (srs.suspended) continue
    if (againToday(srs, today)) again.push({ ...item, status: 'again' })
    else if (doneToday(srs, today)) {
      done.push({ ...item, status: 'done' })
      if (srs.introduced !== today) reviewsUsed++
    } else if (isDue(srs, today)) reviews.push({ ...item, status: 'review' })
    else if (srs.state === 'new') fresh.push({ ...item, status: 'new' })
  }
  // 많이 밀린 것부터 고르고, 고른 뒤에는 조끼리 모이게 원래 순서로
  reviews.sort((a, b) => (a.srs!.due < b.srs!.due ? -1 : a.srs!.due > b.srs!.due ? 1 : 0))
  const pickedReviews = reviews.slice(0, Math.max(0, settings.cardReviewMax - reviewsUsed)).sort((a, b) => order.get(a.id)! - order.get(b.id)!)
  return [...done, ...pickedReviews, ...fresh.slice(0, Math.max(0, settings.cardNewPerDay - newUsed)), ...again]
}

export function cardSrs(cards: Map<string, Card>, book: Book, no: number, key?: Key) {
  return cards.get(cardId(book, no, key))?.srs ?? newSrs()
}

export const srsKind = (c: Srs): 'new' | 'learn' | 'review' => (c.state === 'new' ? 'new' : c.state === 'review' ? 'review' : 'learn')

/** 카드 평가. 되돌리기에 쓸 이전 카드를 돌려준다 */
export async function gradeCard(book: Book, no: number, key: Key | undefined, rating: Rating, settings: Settings) {
  const id = cardId(book, no, key)
  const prev = await db.cards.get(id)
  const srs = schedule(prev?.srs ?? newSrs(), rating, dateKey(), { maxIvl: settings.maxIvl, leechAt: settings.leechAt })
  await db.cards.put({ id, book, no, key: book === 'hanon' ? key : undefined, srs })
  return { id, prev, srs, kind: srsKind(prev?.srs ?? newSrs()) }
}

export async function restoreCard(id: string, prev: Card | undefined) {
  if (prev) await db.cards.put(prev)
  else await db.cards.delete(id)
}

export function countStatus(items: CardItem[]) {
  const n = { done: 0, review: 0, new: 0, again: 0 }
  for (const it of items) n[it.status]++
  return n
}
