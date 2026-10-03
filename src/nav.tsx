import { createContext, useContext } from 'react'
import type { Book, Key, ScoreBook } from './data/exercises'

export type Tab = 'today' | 'practice' | 'basics' | 'repertoire' | 'records'

/** 연습 모드로 들어갈 대상 */
export type PracticeTarget =
  | { refType: Book; queue: number[]; key?: Key; routineId?: number }
  | { refType: 'free'; title: string; routineId?: number }

export type Page =
  | { kind: 'detail'; book: ScoreBook; no: number }
  | { kind: 'settings' }

export interface Nav {
  tab: Tab
  setTab: (t: Tab) => void
  page: Page | null
  openPage: (p: Page) => void
  closePage: () => void
  startPractice: (t: PracticeTarget) => void
  openScore: (scoreId: number, page?: number) => void
}

export const NavCtx = createContext<Nav>(null as unknown as Nav)
export const useNav = () => useContext(NavCtx)
