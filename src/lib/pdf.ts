import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { db } from './db'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

type Task = ReturnType<typeof pdfjs.getDocument>
type Doc = Awaited<Task['promise']>

const cache = new Map<number, { task: Promise<Task>; doc: Promise<Doc> }>()

export function openScore(scoreId: number): Promise<Doc> {
  let c = cache.get(scoreId)
  if (!c) {
    const task = db.scores.get(scoreId).then(async s => {
      if (!s) throw new Error('악보를 찾을 수 없어요.')
      return pdfjs.getDocument({ data: new Uint8Array(await s.blob.arrayBuffer()) })
    })
    const doc = task.then(t => t.promise)
    doc.catch(() => cache.delete(scoreId))
    c = { task, doc }
    cache.set(scoreId, c)
  }
  return c.doc
}

export function forgetScore(scoreId: number) {
  const c = cache.get(scoreId)
  cache.delete(scoreId)
  void c?.task.then(t => t.destroy()).catch(() => {})
}

/** 파일 앱에서 고른 PDF를 저장하고 페이지 수를 센다 */
export async function addScore(file: File) {
  const buf = await file.arrayBuffer()
  const task = pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) })
  const pageCount = (await task.promise).numPages
  void task.destroy()
  const name = file.name.replace(/\.pdf$/i, '')
  return db.scores.add({ name, blob: new Blob([buf], { type: 'application/pdf' }), pageCount, createdAt: Date.now(), bookmarks: [] })
}

/** 한 페이지를 주어진 박스에 맞춰 캔버스에 그린다 */
export async function renderPage(doc: Doc, pageNo: number, canvas: HTMLCanvasElement, boxW: number, boxH: number) {
  const page = await doc.getPage(pageNo)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(boxW / base.width, boxH / base.height)
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
  const vp = page.getViewport({ scale: scale * dpr })
  canvas.width = Math.floor(vp.width)
  canvas.height = Math.floor(vp.height)
  canvas.style.width = `${Math.floor(vp.width / dpr)}px`
  canvas.style.height = `${Math.floor(vp.height / dpr)}px`
  const task = page.render({ canvas, viewport: vp })
  await task.promise
  return task
}
