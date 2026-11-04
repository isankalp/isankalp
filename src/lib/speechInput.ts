interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function speechRecognitionSupported(): boolean {
  return !!getRecognitionCtor()
}

/** Records one utterance and resolves with the transcript, or rejects if nothing was recognized (QA-5). */
export function recognizeSpeech(): Promise<string> {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return Promise.reject(new Error('Speech recognition is not supported in this browser.'))

  return new Promise((resolve, reject) => {
    const recognition = new Ctor()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) resolve(transcript)
      else reject(new Error("Didn't catch that — try again or type instead"))
    }
    recognition.onerror = () => reject(new Error("Didn't catch that — try again or type instead"))
    recognition.onend = () => reject(new Error("Didn't catch that — try again or type instead"))

    recognition.start()
  })
}
