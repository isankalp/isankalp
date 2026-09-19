export type AmbientSoundType = 'none' | 'white-noise' | 'rain'

export const AMBIENT_SOUND_OPTIONS: { value: AmbientSoundType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'white-noise', label: 'White noise' },
  { value: 'rain', label: 'Rain' },
]

let audioContext: AudioContext | null = null
let currentSource: AudioBufferSourceNode | null = null

function getContext(): AudioContext {
  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioContext = new Ctor()
  }
  return audioContext
}

/** Synthesizes a short noise buffer client-side (FE-3) — no external audio assets needed. */
function makeNoiseBuffer(ctx: AudioContext, softened: boolean): AudioBuffer {
  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  if (!softened) {
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  } else {
    let last = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.05 * white) / 1.05
      data[i] = last * 3.5
    }
  }
  return buffer
}

export function playAmbientSound(type: AmbientSoundType): void {
  stopAmbientSound()
  if (type === 'none') return
  const ctx = getContext()
  const buffer = makeNoiseBuffer(ctx, type === 'rain')
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const gain = ctx.createGain()
  gain.gain.value = 0.12
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
  currentSource = source
}

export function stopAmbientSound(): void {
  try {
    currentSource?.stop()
  } catch {
    // already stopped
  }
  currentSource = null
}
