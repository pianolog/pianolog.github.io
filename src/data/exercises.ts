// 5도권 순서 — 하농 12조, 조 칩, 오늘의 조 순환 모두 이 순서를 쓴다.
export const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'] as const
export type Key = (typeof KEYS)[number]

// KEYS 순서에 맞춘 관계 단조
export const MINORS = ['a', 'e', 'b', 'f♯', 'c♯', 'g♯', 'd♯', 'b♭', 'f', 'c', 'g', 'd'] as const

export const relativeMinor = (k: Key) => MINORS[KEYS.indexOf(k)]

/** 'hanon' | 'pischna' | 'scale' — 번호로 기록하는 기초 연습 */
export type Book = 'hanon' | 'pischna' | 'scale'
/** 악보 PDF를 책 단위로 연결하는 것 */
export type ScoreBook = 'hanon' | 'pischna'

export const BOOK_NAME: Record<Book, string> = { hanon: '하농', pischna: '피쉬나', scale: '스케일' }

export const HANDS = ['오른손', '왼손', '양손'] as const
export type Hand = (typeof HANDS)[number]

export const VARIATIONS = ['레가토', '스타카토', '부점', '역부점', '셋잇단', '악센트 이동'] as const
const SCALE_VARIATIONS = ['평행', '반진행', '3도', '6도', '10도', '부점', '스타카토']
const MINOR_FORMS = ['화성 단음계', '가락 단음계']
const ARPEGGIO_VARIATIONS = ['기본 위치', '1전위', '2전위', '속7화음', '감7화음', '부점']

// ── 하농·피쉬나 번호 ──

export interface BookItem {
  no: number // 기록에 저장되는 번호
  label: string // 화면에 보이는 번호 (예: 12a)
}

/** 하농은 21–30번만 쓴다 */
export const HANON_FROM = 21
export const HANON_TO = 30
export const PISCHNA_SIZE = 60

// 피쉬나는 a·b로 나뉜 번호가 있어서 번호×10 + (0: 없음, 1: a, 2: b)로 저장한다.
const SUB = ['', 'a', 'b']
export const pischnaLabel = (no: number) => `${Math.floor(no / 10)}${SUB[no % 10] ?? ''}`

export function bookItems(book: ScoreBook, pischnaSplits: number[]): BookItem[] {
  if (book === 'hanon') {
    return Array.from({ length: HANON_TO - HANON_FROM + 1 }, (_, i) => ({ no: HANON_FROM + i, label: String(HANON_FROM + i) }))
  }
  const out: BookItem[] = []
  for (let n = 1; n <= PISCHNA_SIZE; n++) {
    if (pischnaSplits.includes(n)) out.push({ no: n * 10 + 1, label: `${n}a` }, { no: n * 10 + 2, label: `${n}b` })
    else out.push({ no: n * 10, label: String(n) })
  }
  return out
}

// ── 스케일·아르페지오 ──
// 번호 = 종류(0 스케일, 1 아르페지오) × 100 + 조(0–11 장조 KEYS 순서, 12–23 관계 단조)

export const scaleNo = (kind: 0 | 1, keyIdx: number) => kind * 100 + keyIdx
export const isArpeggio = (no: number) => no >= 100
export const isMinor = (no: number) => no % 100 >= 12

export function keyName(idx: number) {
  return idx < 12 ? `${KEYS[idx]} major` : `${MINORS[idx - 12]} minor`
}

export function scaleTitle(no: number) {
  return `${isArpeggio(no) ? '아르페지오' : '스케일'} ${keyName(no % 100)}`
}

/** 오늘의 조: 장조·관계 단조의 스케일과 아르페지오 4개 */
export function scaleQueue(key: Key) {
  const i = KEYS.indexOf(key)
  return [scaleNo(0, i), scaleNo(0, i + 12), scaleNo(1, i), scaleNo(1, i + 12)]
}

export function variationsFor(book: Book | 'free', no: number): readonly string[] {
  if (book !== 'scale') return VARIATIONS
  if (isArpeggio(no)) return ARPEGGIO_VARIATIONS
  return isMinor(no) ? [...MINOR_FORMS, ...SCALE_VARIATIONS] : SCALE_VARIATIONS
}

export function exerciseTitle(book: Book, no: number) {
  if (book === 'hanon') return `하농 ${no}번`
  if (book === 'pischna') return `피쉬나 ${pischnaLabel(no)}번`
  return scaleTitle(no)
}
