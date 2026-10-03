// 디자인 시안의 라인 아이콘 (24×24)
const P = {
  today: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  practice: <><path d="M9 3h6l4 18H5z" /><path d="M12 16l5-9" /></>,
  basics: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" /></>,
  repertoire: <><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  records: <path d="M4 20h16M7 16v-5M12 16V6M17 16V9" />,
  settings: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  book: <path d="M4 5.5C6.5 4 9.5 4 12 5.5v14c-2.5-1.5-5.5-1.5-8 0zM12 5.5c2.5-1.5 5.5-1.5 8 0v14c-2.5-1.5-5.5-1.5-8 0" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  check: <path d="M6 12.5l4 4 8-9" />,
  right: <path d="M9 6l6 6-6 6" />,
  left: <path d="M15 6l-6 6 6 6" />,
  up: <path d="M6 15l6-6 6 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  tap: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
  drag: <path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
} as const

export type IconName = keyof typeof P

export function Icon({ name, size = 22, width = 1.7, style }: { name: IconName; size?: number; width?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }} aria-hidden>
      {P[name]}
    </svg>
  )
}

export function PlayIcon({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>
}

export function PauseIcon({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
}

export function StarIcon({ filled, size = 34 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5l2.6 5.5 6 .7-4.5 4.1 1.2 5.9L12 16.8 6.7 19.7l1.2-5.9L3.4 9.7l6-.7z" />
    </svg>
  )
}

export function BookmarkIcon({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden><path d="M7 4h10v16l-5-4-5 4z" /></svg>
}
