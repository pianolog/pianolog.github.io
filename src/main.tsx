import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './styles.css'

registerSW({ immediate: true })

async function start() {
  // 개발 서버에서 ?demo 로 열면 캡처용 예시 기록을 채운다 (배포 빌드에는 빠진다)
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    const { seedDemo } = await import('./lib/demo')
    await seedDemo()
    history.replaceState(null, '', location.pathname)
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
void start()
