/**
 * Client-side video prep for portfolio uploads, using ffmpeg.wasm —
 * there's no server transcoding pipeline (see lib/media.ts), so this
 * has to happen in the browser before the file ever reaches
 * /api/upload/portfolio.
 *
 * Every uploaded video gets its audio track stripped (cover/gallery
 * videos autoplay muted, so shipping audio is wasted bandwidth), and
 * anything still over MAX_VIDEO_SIZE_BYTES afterward gets re-encoded
 * at a calculated bitrate so it lands under the cap instead of being
 * rejected outright.
 */

import { MAX_VIDEO_SIZE_BYTES } from "@/lib/media"

export type VideoProcessingStage = "loading" | "muting" | "compressing"

const FFMPEG_CORE_VERSION = "0.12.10"
const FFMPEG_CORE_BASE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`

// A single ffmpeg.wasm instance (and its ~31MB core) is loaded once
// per session and reused across every subsequent cover/gallery video.
let ffmpegPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null

async function getFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg")
      const { toBlobURL } = await import("@ffmpeg/util")
      const ffmpeg = new FFmpeg()
      await ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      })
      return ffmpeg
    })().catch((error) => {
      // Let the next call retry instead of permanently caching a failed load.
      ffmpegPromise = null
      throw error
    })
  }
  return ffmpegPromise
}

function extensionForMime(mime: string): string {
  if (mime === "video/webm") return "webm"
  if (mime === "video/quicktime") return "mov"
  return "mp4"
}

function describeStage(stage: VideoProcessingStage): string {
  switch (stage) {
    case "loading":
      return "Preparing video processor…"
    case "muting":
      return "Removing audio…"
    case "compressing":
      return "Compressing video…"
  }
}

/** Reads a File's duration via a throwaway <video> element — no ffmpeg needed for this. */
function getVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const videoEl = document.createElement("video")
    videoEl.preload = "metadata"
    videoEl.onloadedmetadata = () => {
      const duration = videoEl.duration
      URL.revokeObjectURL(url)
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Couldn't read the video's duration."))
        return
      }
      resolve(duration)
    }
    videoEl.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Couldn't read the video's metadata."))
    }
    videoEl.src = url
  })
}

/** Bounds a re-encode bitrate so `durationSeconds` of video lands under `targetBytes`. */
function targetBitrateKbps(durationSeconds: number, targetBytes: number): number {
  const safetyFactor = 0.88 // headroom for container/muxing overhead
  const bits = targetBytes * 8 * safetyFactor
  const kbps = Math.floor(bits / durationSeconds / 1000)
  return Math.max(250, Math.min(kbps, 8000))
}

async function runEncodePass(
  ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg,
  inputName: string,
  outputName: string,
  bitrateKbps: number,
  maxWidth: number,
) {
  await ffmpeg.exec([
    "-i",
    inputName,
    "-vf",
    `scale='min(${maxWidth},iw)':-2`,
    "-c:v",
    "libx264",
    "-b:v",
    `${bitrateKbps}k`,
    "-maxrate",
    `${bitrateKbps}k`,
    "-bufsize",
    `${bitrateKbps * 2}k`,
    "-preset",
    "veryfast",
    "-movflags",
    "+faststart",
    "-an",
    outputName,
  ])
  return (await ffmpeg.readFile(outputName)) as Uint8Array
}

/**
 * Mutes (always) and, if still needed, compresses a video file so it
 * fits within `maxBytes`. Returns a new File — the original is left
 * untouched.
 */
export async function prepareVideoForUpload(
  file: File,
  maxBytes: number = MAX_VIDEO_SIZE_BYTES,
  onProgress?: (stage: VideoProcessingStage, label: string) => void,
): Promise<File> {
  const report = (stage: VideoProcessingStage) => onProgress?.(stage, describeStage(stage))

  report("loading")
  const ffmpeg = await getFFmpeg()

  const runId = Math.random().toString(36).slice(2)
  const inputExt = extensionForMime(file.type)
  const inputName = `${runId}-input.${inputExt}`
  const mutedName = `${runId}-muted.${inputExt}`

  await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()))

  // Stream-copy the video track and drop audio — no re-encoding, so
  // this is fast regardless of file size. Some containers/codecs
  // reject a bare stream copy; fall back to a real (but still
  // audio-less) encode in that case.
  report("muting")
  let mutedData: Uint8Array
  let mutedType = file.type
  try {
    await ffmpeg.exec(["-i", inputName, "-c:v", "copy", "-an", mutedName])
    mutedData = (await ffmpeg.readFile(mutedName)) as Uint8Array
  } catch {
    await ffmpeg.deleteFile(mutedName).catch(() => {})
    const fallbackName = `${runId}-muted-fallback.mp4`
    await ffmpeg.exec([
      "-i",
      inputName,
      "-c:v",
      "libx264",
      "-crf",
      "23",
      "-preset",
      "veryfast",
      "-an",
      fallbackName,
    ])
    mutedData = (await ffmpeg.readFile(fallbackName)) as Uint8Array
    mutedType = "video/mp4"
    await ffmpeg.deleteFile(fallbackName).catch(() => {})
  }
  await ffmpeg.deleteFile(inputName).catch(() => {})

  let finalData: Uint8Array = mutedData
  let finalType = mutedType

  if (finalData.byteLength > maxBytes) {
    report("compressing")
    const duration = await getVideoDurationSeconds(file)
    await ffmpeg.writeFile(mutedName, mutedData)

    // Two passes: a calculated bitrate at full-ish resolution, then —
    // if muxing overhead still pushed it over the cap — a smaller,
    // more aggressively bitrated fallback.
    const attempts: Array<{ bitrate: number; maxWidth: number }> = [
      { bitrate: targetBitrateKbps(duration, maxBytes), maxWidth: 1920 },
      { bitrate: Math.max(200, Math.floor(targetBitrateKbps(duration, maxBytes) * 0.6)), maxWidth: 1280 },
    ]

    for (const [i, attempt] of attempts.entries()) {
      const outputName = `${runId}-compressed-${i}.mp4`
      const data = await runEncodePass(ffmpeg, mutedName, outputName, attempt.bitrate, attempt.maxWidth)
      await ffmpeg.deleteFile(outputName).catch(() => {})
      if (data.byteLength <= maxBytes || i === attempts.length - 1) {
        finalData = data
        finalType = "video/mp4"
        break
      }
    }

    await ffmpeg.deleteFile(mutedName).catch(() => {})
  } else {
    await ffmpeg.deleteFile(mutedName).catch(() => {})
  }

  if (finalData.byteLength > maxBytes) {
    throw new Error(
      `Even after compression this video is too large (${Math.round(finalData.byteLength / (1024 * 1024))}MB). Try a shorter clip.`,
    )
  }

  const extension = finalType === "video/mp4" ? "mp4" : inputExt
  const baseName = file.name.replace(/\.[^./]+$/, "") || "video"

  return new File([finalData], `${baseName}.${extension}`, { type: finalType })
}
