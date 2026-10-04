// 클래식 피아노 곡 목록 (Open Opus · scripts/build-catalog.py로 만든 src/data/catalog.json)
// 앱 안에 들어 있어서 인터넷 없이 검색되고, 없으면 Open Opus에서 온라인으로 찾는다.

export interface CatalogWork {
  composer: string // 영어 전체 이름
  ko?: string // 한글 이름
  title: string // 영어 곡명 (Open Opus 그대로)
  online?: boolean
}

interface CatalogFile {
  composers: { id: string; name: string; ko: string }[]
  works: [number, string][]
}

let cache: Promise<{ list: CatalogWork[]; hay: string[] }> | null = null

/** 곡 목록은 처음 검색할 때만 불러온다 (첫 화면을 가볍게) */
export function loadCatalog() {
  cache ??= import('../data/catalog.json').then(m => {
    const data = m.default as unknown as CatalogFile
    const list = data.works.map(([ci, title]) => ({ composer: data.composers[ci].name, ko: data.composers[ci].ko, title }))
    return { list, hay: list.map(w => norm(`${w.composer} ${w.ko} ${w.title}`)) }
  })
  return cache
}

/** 소문자 · 악센트 제거 · 기호를 띄어쓰기로 · 글자와 숫자 사이 띄우기 */
export function norm(s: string) {
  return ` ${s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC') // 한글은 다시 붙인다 (NFD는 한글을 자모로 쪼갠다)
    .toLowerCase()
    .replace(/♭/g, ' flat ')
    .replace(/♯/g, ' sharp ')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([가-힣])([a-z\d])/g, '$1 $2')
    .replace(/([a-z\d])([가-힣])/g, '$1 $2')
    .replace(/[^a-z\d가-힣]+/g, ' ')
    .trim()} `
}

// 한글 검색어 → 영어 곡명에 들어 있는 말
const KO: Record<string, string[]> = {
  소나타: ['sonata'],
  소나티네: ['sonatina'],
  발라드: ['ballade'],
  에튀드: ['etude', 'stud'],
  에뛰드: ['etude', 'stud'],
  연습곡: ['etude', 'stud'],
  전주곡: ['prelude'],
  프렐류드: ['prelude'],
  프렐루드: ['prelude'],
  녹턴: ['nocturne'],
  야상곡: ['nocturne'],
  스케르초: ['scherzo'],
  왈츠: ['waltz', 'valse'],
  마주르카: ['mazurka'],
  폴로네즈: ['polonaise'],
  즉흥곡: ['impromptu'],
  환상곡: ['fantas'],
  판타지: ['fantas'],
  변주곡: ['variation'],
  변주: ['variation'],
  협주곡: ['concerto'],
  콘체르토: ['concerto'],
  푸가: ['fugue'],
  평균율: ['well tempered'],
  파르티타: ['partita'],
  모음곡: ['suite'],
  론도: ['rondo'],
  바가텔: ['bagatelle'],
  무언가: ['songs without words'],
  랩소디: ['rhapsod'],
  광시곡: ['rhapsod'],
  토카타: ['toccata'],
  인벤션: ['invention'],
  신포니아: ['sinfonia'],
  영국: ['english'],
  프랑스: ['french'],
  이탈리아: ['italian'],
  골드베르크: ['goldberg'],
  전람회: ['pictures'],
  사계: ['seasons'],
  크라이슬레리아나: ['kreisleriana'],
  카니발: ['carnaval', 'carnival'],
  사육제: ['carnaval', 'carnival'],
  어린이: ['kinder', 'children'],
  자장가: ['berceuse'],
  뱃노래: ['barcarolle'],
  초절기교: ['transcendental'],
  헝가리: ['hungarian'],
  스페인: ['spanish', 'espan'],
  이베리아: ['iberia'],
  고예스카스: ['goyescas'],
  베르가마스크: ['bergamasque'],
  판화: ['estampes'],
  영상: ['images'],
  거울: ['miroirs'],
  순례: ['pelerinage'],
  위로: ['consolation'],
  사랑의꿈: ['liebestraum'],
  트리오: ['trio'],
  삼중주: ['trio'],
  사중주: ['quartet'],
  오중주: ['quintet'],
  장조: ['major'],
  단조: ['minor'],
  내림: ['flat'],
  올림: ['sharp'],
  악흥의: ['moments musicaux'],
  피아노: ['piano'],
  인터메초: ['intermezz'],
  간주곡: ['intermezz'],
  카프리치오: ['capricc'],
  기상곡: ['capricc'],
  아라베스크: ['arabesque'],
  미뉴에트: ['minuet', 'menuet'],
  소품: ['piece', 'stuck'],
  클라비어: ['clavier'],
  노벨레테: ['novellette'],
  유모레스크: ['humoresk'],
  성: ['part'],
  밤의: ['nuit'],
  가스파르: ['gaspard'],
  권: ['book']
}

// 검색어에서 버리는 말
const SKIP = new Set(['번', '곡', '악장', '의', 'no', 'op', 'in'])

function terms(token: string, composers: Map<string, string>) {
  if (KO[token]) return KO[token]
  const c = composers.get(token)
  return c ? [c] : [token]
}

/** 앱 안 곡 목록에서 찾기. 단어마다 곡명·작곡가에 들어 있어야 한다 */
export async function searchCatalog(query: string, limit = 40): Promise<CatalogWork[]> {
  const { list, hay } = await loadCatalog()
  const composers = new Map(list.map(w => [w.ko ?? '', norm(w.composer).trim()]))
  const tokens = norm(query).trim().split(' ').filter(t => t && !SKIP.has(t))
  if (!tokens.length) return []
  // 숫자와 한 글자(조 이름 c, g …)는 낱말 그대로만 맞춘다
  const groups = tokens.map(t => terms(t, composers).map(x => (/^(\d+|[a-z])$/.test(x) ? ` ${x} ` : x)))
  const out: { w: CatalogWork; score: number }[] = []
  for (let i = 0; i < list.length; i++) {
    const h = hay[i]
    if (!groups.every(g => g.some(x => h.includes(x)))) continue
    // 짧은 곡명·피아노 독주곡을 앞으로
    out.push({ w: list[i], score: list[i].title.length + (/concerto|trio|quartet|quintet/i.test(list[i].title) ? 15 : 0) })
  }
  return out
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(x => x.w)
}

/** 앱에 없는 곡: Open Opus 온라인 검색 (피아노 곡만) */
export async function searchOnline(query: string): Promise<CatalogWork[]> {
  // 한글 단어는 영어로 바꿔서 보낸다
  const { list } = await loadCatalog()
  const composers = new Map(list.map(w => [w.ko ?? '', w.composer]))
  const q = norm(query)
    .trim()
    .split(' ')
    .filter(t => t && !SKIP.has(t))
    .map(t => composers.get(t) ?? KO[t]?.[0] ?? t)
    .join(' ')
  const r = await fetch(`https://api.openopus.org/omnisearch/${encodeURIComponent(q)}/0.json`)
  const d = (await r.json()) as { results?: { composer: { complete_name: string }; work: { title: string; genre: string } | null }[] }
  return (d.results ?? [])
    .filter(x => x.work && (x.work.genre === 'Keyboard' || /piano/i.test(x.work.title)))
    .map(x => ({ composer: x.composer.complete_name, title: x.work!.title, online: true }))
}

// ── 영어 곡명 → 한글 ──

const GENRE: [RegExp, string][] = [
  [/\bSuite bergamasque\b/gi, '베르가마스크 모음곡'],
  [/\bPictures at an Exhibition\b/g, '전람회의 그림'],
  [/\bThe Seasons\b/g, '사계'],
  [/\bEnglish Suite\b/g, '영국 모음곡'],
  [/\bFrench Suite\b/g, '프랑스 모음곡'],
  [/\bGoldberg Variations\b/g, '골드베르크 변주곡'],
  [/\bItalian Concerto\b/g, '이탈리아 협주곡'],
  [/\bWell-tempered Clavier\b/gi, '평균율 클라비어'],
  [/\bKinderszenen\b/g, '어린이 정경'],
  [/\bAnn[ée]es de p[èe]lerinage\b/g, '순례의 해'],
  [/\bLiebestr[äa]ume?\b/g, '사랑의 꿈'],
  [/\bTranscendental\b/g, '초절기교'],
  [/\bBook (\d+)\b/g, '$1권'],
  [/\b(\d)-Part\b/g, '$1성'],
  [/\bPiano Sonatas?\b/g, '피아노 소나타'],
  [/\bPiano Concertos?\b/g, '피아노 협주곡'],
  [/\bPiano Trios?\b/g, '피아노 3중주'],
  [/\bPiano Quartets?\b/g, '피아노 4중주'],
  [/\bPiano Quintets?\b/g, '피아노 5중주'],
  [/\bSonatinas?\b/g, '소나티네'],
  [/\bSonatas?\b/g, '소나타'],
  [/\bBallades?\b/g, '발라드'],
  [/\b[EÉ]tudes?(?: d'exécution transcendante)?\b/g, '에튀드'],
  [/\bStud(?:y|ies)\b/g, '연습곡'],
  [/\bPr[eé]ludes?\b/g, '전주곡'],
  [/\bNocturnes?\b/g, '녹턴'],
  [/\bScherz(?:o|i)\b/g, '스케르초'],
  [/\bWaltz(?:es)?\b/g, '왈츠'],
  [/\bMazurkas?\b/g, '마주르카'],
  [/\bPolonaises?\b/g, '폴로네즈'],
  [/\bImpromptus?\b/g, '즉흥곡'],
  [/\b(?:Fantasy|Fantasia|Fantaisie)\b/g, '환상곡'],
  [/\bVariations\b/g, '변주곡'],
  [/\bFugues?\b/g, '푸가'],
  [/\bPartitas?\b/g, '파르티타'],
  [/\bSuites?\b/g, '모음곡'],
  [/\bRondos?\b/g, '론도'],
  [/\bBagatelles?\b/g, '바가텔'],
  [/\bRhapsod(?:y|ies)\b/g, '랩소디'],
  [/\bToccatas?\b/g, '토카타'],
  [/\bBarcarolle\b/g, '뱃노래'],
  [/\bBerceuse\b/g, '자장가'],
  [/\bSongs without Words\b/g, '무언가'],
  [/\bMoments musicaux\b/g, '악흥의 순간'],
  [/\bHungarian\b/g, '헝가리'],
  [/\bConsolations?\b/g, '위안'],
  [/\bPieces?\b/g, '소품'],
  [/\bInventions?\b/g, '인벤션'],
  [/\bSinfonias?\b/g, '신포니아'],
  [/\bMinuets?\b/g, '미뉴에트'],
  [/\bArabesques?\b/g, '아라베스크'],
  [/\bIntermezz(?:os|o|i)\b/g, '인터메초'],
  [/\bCapriccio\b/g, '카프리치오'],
  [/\bLullaby\b/g, '자장가']
]

const ACC: Record<string, string> = { flat: '♭', sharp: '♯' }

/** 작품번호(Op. 23, BWV 846, K. 331 …)를 뗀다 */
const CAT_RE = /,?\s*\b(op\.\s*posth\.?\s*\d*|op\.\s*\d+[a-z]?(?:\s*no\.\s*\d+)?|BWV\.?\s*\d+[a-z]?(?:-\d+)?|K\.\s*\d+[a-z]?|Hob\.\s*[\w:./]+|D\.?\s*\d+|S\.\s*\d+[a-z]?(?:-\d+)?|L\.\s*\d+|WoO\s*\d+|B\.\s*\d+|Sz\.?\s*\d+|BB\s*\d+|TN\s*[\w/]+|FP\s*\d+|M\.\s*\d+|R\.\s*\d+[a-z]?(?:-[a-z\d]+)?|CD\s*\d+|Kk\.\s*\d+)/i

export function koreanize(title: string) {
  let t = title
  let opus = ''
  const quote = t.match(/,?\s*"([^"]+)"/)
  if (quote) t = t.replace(quote[0], '')
  // 작품번호가 여럿이면(S.139, R.2b) Op. → 처음 것 하나만 남긴다
  const cats: string[] = []
  for (let m = t.match(CAT_RE); m; m = t.match(CAT_RE)) {
    cats.push(m[1].replace(/^op\.\s*/i, 'Op. ').replace(/^BWV\.?\s*/i, 'BWV ').replace(/\s+/g, ' '))
    t = t.replace(m[0], '')
  }
  opus = cats.find(c => c.startsWith('Op.')) ?? cats[0] ?? ''
  t = t.replace(/\bin ([A-G])(?: (flat|sharp))? (major|minor)\b/, (_, l: string, acc: string | undefined, mode: string) => `${mode === 'minor' ? l.toLowerCase() : l}${acc ? ACC[acc] : ''}${mode === 'minor' ? '단조' : '장조'}`)
  for (const [re, ko] of GENRE) t = t.replace(re, ko)
  t = t.replace(/\bno\.\s*(\d+)/gi, '$1번')
  t = t.replace(/^(\d+) (\S+)/, '$1개의 $2')
  t = t.replace(/\s*,\s*$/, '').replace(/\s{2,}/g, ' ').trim()
  if (quote) t += ` “${quote[1]}”`
  return { title: t, opus }
}

/** 곡이 소나타·협주곡이면 악장, 곡집(24 Preludes, Etudes op. 10 …)이면 번호를 붙일 수 있게 */
export function partHint(title: string): '악장' | '번' | null {
  if (/sonata|sonatina|concerto|suite|partita|trio|quartet|quintet/i.test(title) && !/^\d+ /.test(title)) return '악장'
  if (/^\d+ |s,\s*op\.|s$|s,|book|well-tempered|songs without words/i.test(title)) return '번'
  return null
}

/** IMSLP에서 이 곡 찾기 */
export function imslpUrl(composer: string, title: string) {
  return `https://imslp.org/index.php?title=Special:Search&search=${encodeURIComponent(`${title} ${composer}`.trim())}`
}
