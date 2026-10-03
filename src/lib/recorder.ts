// 런스루 녹음 (MediaRecorder). iPad Safari는 audio/mp4, 크롬은 audio/webm.

export interface ActiveRecording {
  stop: () => Promise<Blob>
  cancel: () => void
}

export async function startRecording(): Promise<ActiveRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t))
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = e => e.data.size && chunks.push(e.data)
  rec.start(1000)
  const release = () => stream.getTracks().forEach(t => t.stop())
  return {
    stop: () =>
      new Promise(resolve => {
        rec.onstop = () => {
          release()
          resolve(new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' }))
        }
        rec.stop()
      }),
    cancel: () => {
      rec.onstop = release
      if (rec.state !== 'inactive') rec.stop()
      else release()
    }
  }
}

/** 파형 막대 높이 (0–1) */
export async function waveformPeaks(blob: Blob, bars: number) {
  const ctx = new AudioContext()
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
    const data = buf.getChannelData(0)
    const size = Math.floor(data.length / bars) || 1
    const out: number[] = []
    for (let i = 0; i < bars; i++) {
      let max = 0
      for (let j = i * size; j < Math.min(data.length, (i + 1) * size); j += 16) max = Math.max(max, Math.abs(data[j]))
      out.push(max)
    }
    const top = Math.max(...out, 0.001)
    return { peaks: out.map(v => v / top), duration: buf.duration }
  } finally {
    void ctx.close()
  }
}
