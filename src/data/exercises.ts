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
// 속7화음·감7화음은 하농 42·43번으로 따로 친다
const ARPEGGIO_VARIATIONS = ['기본 위치', '1전위', '2전위', '부점']

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

/** 하농 책 PDF에서 페이지를 지정할 수 있는 스케일·아르페지오 번호 */
export const HANON_SCALE_ITEMS: BookItem[] = [
  { no: 39, label: '39 스케일' },
  { no: 40, label: '40 반음계' },
  { no: 41, label: '41 아르페지오' },
  { no: 42, label: '42 속7화음' },
  { no: 43, label: '43 감7화음' }
]

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

// ── 스케일·아르페지오 (하농 3부) ──
// 하농 39 스케일 24조 · 40 반음계 · 41 아르페지오 24조 · 42 속7화음 아르페지오 12조 · 43 감7화음 아르페지오 12조
// 번호 = 종류 × 100 + 조
//   0xx 스케일, 1xx 아르페지오 — 조 0–11 장조(KEYS 순서), 12–23 관계 단조
//   200 반음계 · 3xx 속7화음 · 4xx 감7화음 — 조 0–11 (KEYS 순서)

export const CHROMATIC = 200
export const scaleNo = (kind: 0 | 1 | 3 | 4, keyIdx: number) => kind * 100 + keyIdx
export const scaleKind = (no: number) => Math.floor(no / 100)
export const isArpeggio = (no: number) => [1, 3, 4].includes(scaleKind(no))
export const isMinor = (no: number) => scaleKind(no) <= 1 && no % 100 >= 12

/** 이 스케일·아르페지오가 실린 하농 번호 */
export const HANON_OF_KIND: Record<number, number> = { 0: 39, 1: 41, 2: 40, 3: 42, 4: 43 }
export const hanonNoOf = (no: number) => HANON_OF_KIND[scaleKind(no)]

/** 하농 39·41 순서: C, a, G, e, D, b … (장조 다음 관계 단조) */
export const HANON_KEY_ORDER = KEYS.flatMap((_, i) => [i, i + 12])

/** 장조의 딸림음 (F♯ 장조는 C♯) */
export const dominantOf = (i: number) => (i === 6 ? 'C♯' : KEYS[(i + 1) % 12])

export function keyName(idx: number) {
  return idx < 12 ? `${KEYS[idx]} major` : `${MINORS[idx - 12]} minor`
}

export function scaleTitle(no: number) {
  const k = scaleKind(no)
  if (k === 2) return '반음계 스케일'
  if (k === 3) return `속7화음 아르페지오 ${KEYS[no % 100]} (${dominantOf(no % 100)}7)`
  if (k === 4) return `감7화음 아르페지오 ${KEYS[no % 100]}`
  return `${k === 1 ? '아르페지오' : '스케일'} ${keyName(no % 100)}`
}

/** 오늘의 조: 장조·관계 단조의 스케일과 아르페지오 4개 */
export function scaleQueue(key: Key) {
  const i = KEYS.indexOf(key)
  return [scaleNo(0, i), scaleNo(0, i + 12), scaleNo(1, i), scaleNo(1, i + 12)]
}

// ── 5도권 묶음 ──

/** ms·ns 장조·단조 스케일(하농 39) · ma·na 장조·단조 아르페지오(41) · d7 속7화음(42) · dim 감7화음(43) */
export type ScaleKind = 'ms' | 'ns' | 'ma' | 'na' | 'd7' | 'dim'
export type CircleMode = 'scale' | 'arpeggio'
// 하농처럼 한 조 안에서 장조 다음 관계 단조
export const SCALE_KINDS: { id: ScaleKind; label: string; mode: CircleMode }[] = [
  { id: 'ms', label: '장조 스케일', mode: 'scale' },
  { id: 'ns', label: '단조 스케일', mode: 'scale' },
  { id: 'ma', label: '장조 아르페지오', mode: 'arpeggio' },
  { id: 'na', label: '단조 아르페지오', mode: 'arpeggio' },
  { id: 'd7', label: '속7화음', mode: 'arpeggio' },
  { id: 'dim', label: '감7화음', mode: 'arpeggio' }
]

export interface ScaleSet {
  keys: number[] // 고른 조 (KEYS 위치 0–11)
  start: number // 시작 조
  dir: 'cw' | 'ccw' // 5도씩 / 4도씩
  kinds: ScaleKind[]
}

const KIND_NO: Record<ScaleKind, (k: number) => number> = {
  ms: k => scaleNo(0, k),
  ns: k => scaleNo(0, k + 12),
  ma: k => scaleNo(1, k),
  na: k => scaleNo(1, k + 12),
  d7: k => scaleNo(3, k),
  dim: k => scaleNo(4, k)
}

/** 시작 조부터 5도권 방향으로 돌며, 조마다 고른 종류를 묶어 차례로 */
export function circleQueue(set: ScaleSet) {
  const out: number[] = []
  for (let i = 0; i < 12; i++) {
    const k = (set.start + (set.dir === 'cw' ? i : -i) + 12) % 12
    if (!set.keys.includes(k)) continue
    for (const { id } of SCALE_KINDS) if (set.kinds.includes(id)) out.push(KIND_NO[id](k))
  }
  return out
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
