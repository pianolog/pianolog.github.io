// 5도권 순서 — 하농 12조, 조 칩, 오늘의 조 순환 모두 이 순서를 쓴다.
export const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'] as const
export type Key = (typeof KEYS)[number]

// 관계 단조 (오늘의 조 표시용)
export const RELATIVE_MINOR: Record<Key, string> = {
  C: 'a', G: 'e', D: 'b', A: 'f♯', E: 'c♯', B: 'g♯',
  'F♯': 'd♯', 'D♭': 'b♭', 'A♭': 'f', 'E♭': 'c', 'B♭': 'g', F: 'd'
}

export type Book = 'hanon' | 'pischna'

export const BOOK_NAME: Record<Book, string> = { hanon: '하농', pischna: '피쉬나' }
export const BOOK_SIZE = 60

// 하농은 번호 범위로만 구분한다 (부 이름은 쓰지 않음).
export const HANON_PARTS = [
  { label: '1부', from: 1, to: 20 },
  { label: '2부', from: 21, to: 43 },
  { label: '3부', from: 44, to: 60 }
]

export const HANDS = ['오른손', '왼손', '양손'] as const
export type Hand = (typeof HANDS)[number]

export const VARIATIONS = ['레가토', '스타카토', '부점', '역부점', '셋잇단', '악센트 이동'] as const

export function exerciseTitle(book: Book, no: number) {
  return `${BOOK_NAME[book]} ${no}번`
}
