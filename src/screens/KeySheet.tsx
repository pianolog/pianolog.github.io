import { useState } from 'react'
import { KEYS, relativeMinor, type Key } from '../data/exercises'
import { Sheet, SheetHead, useToast } from '../components/ui'
import { saveSetting } from '../lib/db'
import { useEntries, useSettings } from '../lib/hooks'
import { keyOverridden, todayKey } from '../lib/stats'
import { dateKey } from '../lib/time'

/** 오늘의 조 고르기: 오늘만 / 계속 / 자동으로 되돌리기 */
export function KeySheet({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const entries = useEntries()
  const toast = useToast()
  const current = todayKey(settings, entries)
  const [key, setKey] = useState<Key>(current)
  const auto = todayKey({ ...settings, keyOverride: null, todayKeyMode: settings.todayKeyMode === 'fixed' ? 'cycle' : settings.todayKeyMode }, entries)
  const custom = keyOverridden(settings) || settings.todayKeyMode === 'fixed'

  const today = async () => {
    await saveSetting('keyOverride', { date: dateKey(), key })
    toast(`오늘의 조: ${key} — 내일은 자동으로 돌아가요`)
    onClose()
  }
  const always = async () => {
    await saveSetting('todayKeyMode', 'fixed')
    await saveSetting('fixedKey', key)
    await saveSetting('keyOverride', null)
    toast(`앞으로 계속 ${key}로 연습해요`)
    onClose()
  }
  const reset = async () => {
    await saveSetting('keyOverride', null)
    if (settings.todayKeyMode === 'fixed') await saveSetting('todayKeyMode', 'cycle')
    toast('오늘의 조를 자동으로 되돌렸어요')
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <SheetHead title="오늘의 조" sub="하농 조옮김과 스케일·아르페지오에 쓰는 조예요." onClose={onClose} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8, marginTop: 22 }}>
        {KEYS.map(k => (
          <button key={k} className={`keychip tap${key === k ? ' on' : k === current ? ' today' : ''}`} style={{ height: 72, flexDirection: 'column', gap: 2 }} onClick={() => setKey(k)}>
            <span>{k}</span>
            <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.7 }}>{relativeMinor(k)}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button className="btn" style={{ flex: 1, height: 64 }} onClick={always}>
          계속 {key}로
        </button>
        <button className="btn primary" style={{ flex: 1.4, height: 64, fontSize: 18 }} onClick={today}>
          오늘만 {key}로
        </button>
      </div>
      {custom && (
        <button className="btn" style={{ marginTop: 10, height: 56, background: 'transparent', color: 'var(--ink2)' }} onClick={reset}>
          자동으로 되돌리기 (오늘이면 {auto})
        </button>
      )}
    </Sheet>
  )
}
