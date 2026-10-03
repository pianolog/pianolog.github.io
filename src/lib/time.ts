const pad = (n: number) => String(n).padStart(2, '0')

/** 로컬 날짜 키 YYYY-MM-DD */
export function dateKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDateKey(k: string) {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** 1970-01-01 로컬 기준 경과 일수 — 오늘의 조 순환에 사용 */
export function dayIndex(d: Date = new Date()) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
}

/** 08:24 / 1:02:05 */
export function clock(sec: number) {
  sec = Math.max(0, Math.floor(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** 1h 42m / 18m */
export function duration(sec: number) {
  const m = Math.round(sec / 60)
  const h = Math.floor(m / 60)
  if (!h) return `${m}m`
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export function longDate(d: Date = new Date()) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`
}

export function shortDate(d: Date) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`
}

export function daysAgo(k: string, today = dateKey()) {
  return Math.round((parseDateKey(today).getTime() - parseDateKey(k).getTime()) / 86400000)
}

export function agoLabel(k: string | undefined) {
  if (!k) return '기록 없음'
  const d = daysAgo(k)
  return d === 0 ? '오늘' : d === 1 ? '어제' : `${d}일 전`
}
