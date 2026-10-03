import { useSyncExternalStore } from 'react'

// Web Audio 선행 스케줄링 메트로놈.
// setInterval은 "언제 예약할지"만 정하고, 실제 소리 시각은 AudioContext 시계로 정확하게 잡는다.

export type Subdivision = 1 | 2 | 3 | 4 // ♩ / 8분 / 셋잇단 / 16분

export interface MetronomeState {
  bpm: number
  beats: number // 한 마디 박 수
  subdivision: Subdivision
  playing: boolean
  beat: number // 현재 박 (0부터), 정지 시 -1
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12

class Metronome {
  private ctx: AudioContext | null = null
  private timer: number | null = null
  private nextTime = 0
  private tick = 0 // 마디 안의 세분 위치
  private queue: { time: number; beat: number }[] = []
  private raf = 0
  private listeners = new Set<() => void>()
  private taps: number[] = []

  state: MetronomeState = { bpm: 92, beats: 4, subdivision: 1, playing: false, beat: -1 }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = () => this.state

  private set(patch: Partial<MetronomeState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach(fn => fn())
  }

  /** iOS는 사용자 터치 안에서 오디오를 깨워야 소리가 난다 */
  unlock() {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setBpm(bpm: number) {
    this.set({ bpm: Math.max(30, Math.min(300, Math.round(bpm))) })
  }

  nudge(d: number) {
    this.setBpm(this.state.bpm + d)
  }

  setBeats(beats: number) {
    this.tick = 0
    this.set({ beats })
  }

  setSubdivision(subdivision: Subdivision) {
    this.tick = 0
    this.set({ subdivision })
  }

  tap() {
    const now = performance.now()
    this.taps = this.taps.filter(t => now - t < 2500)
    this.taps.push(now)
    if (this.taps.length >= 2) {
      const gaps = this.taps.slice(1).map((t, i) => t - this.taps[i])
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
      this.setBpm(60000 / avg)
    }
  }

  toggle() {
    if (this.state.playing) this.stop()
    else this.start()
  }

  start() {
    const ctx = this.unlock()
    this.tick = 0
    this.nextTime = ctx.currentTime + 0.06
    this.queue = []
    this.set({ playing: true })
    this.timer = window.setInterval(this.schedule, LOOKAHEAD_MS)
    this.schedule()
    this.raf = requestAnimationFrame(this.draw)
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    cancelAnimationFrame(this.raf)
    this.queue = []
    this.set({ playing: false, beat: -1 })
  }

  private schedule = () => {
    const ctx = this.ctx
    if (!ctx) return
    const { bpm, beats, subdivision } = this.state
    const step = 60 / bpm / subdivision
    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const isBeat = this.tick % subdivision === 0
      const beat = Math.floor(this.tick / subdivision)
      this.click(this.nextTime, isBeat ? (beat === 0 ? 'accent' : 'beat') : 'sub')
      if (isBeat) this.queue.push({ time: this.nextTime, beat })
      this.nextTime += step
      this.tick = (this.tick + 1) % (beats * subdivision)
    }
  }

  private click(time: number, kind: 'accent' | 'beat' | 'sub') {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = kind === 'accent' ? 1760 : kind === 'beat' ? 1175 : 880
    const peak = kind === 'sub' ? 0.25 : kind === 'accent' ? 0.9 : 0.6
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045)
    osc.connect(gain).connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.06)
  }

  private draw = () => {
    const ctx = this.ctx
    if (ctx) {
      let beat = this.state.beat
      while (this.queue.length && this.queue[0].time <= ctx.currentTime) beat = this.queue.shift()!.beat
      if (beat !== this.state.beat) this.set({ beat })
    }
    if (this.state.playing) this.raf = requestAnimationFrame(this.draw)
  }
}

export const metronome = new Metronome()

export function useMetronome() {
  return useSyncExternalStore(metronome.subscribe, metronome.getSnapshot)
}
