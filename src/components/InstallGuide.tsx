import { Sheet, SheetHead } from './ui'

// 홈 화면 앱이 아니라 Safari 탭에서 열었을 때 설치 방법을 안내한다.

const HIDE_KEY = 'installGuide:hide'

/** 홈 화면 아이콘으로 연 앱인지 */
export function isStandalone() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
}

/** 처음 열 때 안내를 띄울지: 홈 화면 앱이 아니고, [다시 보지 않기]를 누르지 않았을 때 */
export function shouldShowInstallGuide() {
  if (isStandalone()) return false
  try {
    return localStorage.getItem(HIDE_KEY) !== '1'
  } catch {
    return true
  }
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-4px', margin: '0 2px' }} aria-label="공유">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" />
    </svg>
  )
}

export function InstallGuide({ onClose, fromSettings }: { onClose: () => void; fromSettings?: boolean }) {
  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, '1')
    } catch {
      /* 저장 못 해도 닫기만 */
    }
    onClose()
  }
  const step = (n: number, body: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span style={{ width: 32, height: 32, borderRadius: 16, flex: 'none', background: 'var(--accent)', color: 'var(--accentInk)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{n}</span>
      <div style={{ fontSize: 17, lineHeight: 1.55, paddingTop: 3 }}>{body}</div>
    </div>
  )
  const standalone = isStandalone()
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="홈 화면에 설치하기" sub={standalone ? '이미 홈 화면 앱으로 쓰고 있어요.' : '앱처럼 전체 화면으로 쓰고, 기록도 오래 안전하게 남아요.'} onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24 }}>
        {step(1, <>지금처럼 iPad <b>Safari</b>에서 이 주소를 열어 두세요.</>)}
        {step(2, <>주소창 오른쪽의 <b>공유</b> 버튼<ShareIcon />을 누르고 <b>홈 화면에 추가</b> → <b>추가</b>를 누르세요.</>)}
        {step(3, <>이제부터는 Safari 대신 <b>홈 화면의 "연습 기록" 아이콘</b>으로 여세요.</>)}
      </div>
      <div style={{ marginTop: 22, background: 'var(--bg)', borderRadius: 14, padding: '14px 16px', fontSize: 14, lineHeight: 1.6, color: 'var(--ink2)' }}>
        기록은 이 iPad 안, 연 곳(Safari 탭과 홈 화면 앱)마다 따로 저장돼요. 다른 주소나 Safari 탭에서 쓰던 기록이 있으면, 거기서 설정 → <b>기록 내보내기</b>를 한 뒤 홈 화면 앱에서 <b>가져오기</b>를 하세요.
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
        {!fromSettings && (
          <button className="btn" style={{ height: 60 }} onClick={hide}>
            다시 보지 않기
          </button>
        )}
        <button className="btn primary" style={{ flex: 1, height: 60 }} onClick={onClose}>
          {fromSettings ? '닫기' : '다음에'}
        </button>
      </div>
    </Sheet>
  )
}
