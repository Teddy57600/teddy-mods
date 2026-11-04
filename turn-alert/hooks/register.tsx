import type { EngineInterface, Register } from 'claude-code'

type Settings = { thresholdSeconds: number; hasSound: boolean; hasNotification: boolean }

const DEFAULTS: Settings = { thresholdSeconds: 60, hasSound: true, hasNotification: true }
const STORE_KEY = 'settings'

const loadSettings = async ($: EngineInterface): Promise<Settings> => {
  const stored = (await $.store.get(STORE_KEY)) as Partial<Settings> | undefined
  return { ...DEFAULTS, ...stored }
}

// « 45 s », « 2 min 14 s », « 1 h 05 min ».
const duration = (ms: number): string => {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  if (m > 0) return `${m} min ${String(s).padStart(2, '0')} s`
  return `${s} s`
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const toBase64 = (bytes: Uint8Array): string => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[n & 63]! : '='
  }
  return out
}

// Carillon de trois notes montantes (mi, la, do dièse), en WAV 16 bits mono, fabriqué une fois.
// Les harmoniques de cloche et le volume poussé près du maximum le font entendre
// même sur les petits haut-parleurs d'un portable.
let chime: string | undefined
const chimeBase64 = (): string => {
  if (chime !== undefined) return chime
  const rate = 22050
  const notes = [
    { freq: 659.25, start: 0, length: 0.5 },
    { freq: 880, start: 0.14, length: 0.6 },
    { freq: 1108.73, start: 0.28, length: 1.1 },
  ]
  const samples = Math.ceil(rate * 1.4)
  const pcm = new Float32Array(samples)
  for (const note of notes) {
    const from = Math.floor(note.start * rate)
    const count = Math.floor(note.length * rate)
    for (let i = 0; i < count && from + i < samples; i++) {
      const t = i / rate
      const attack = Math.min(1, t / 0.005)
      const decay = Math.exp(-t * 3.5)
      const w = 2 * Math.PI * note.freq * t
      const tone = Math.sin(w) + 0.5 * Math.sin(2 * w) + 0.25 * Math.exp(-t * 8) * Math.sin(3 * w)
      pcm[from + i]! += attack * decay * tone
    }
  }
  // Ramène le pic au maximum, puis arrondit les crêtes : plus fort à l'oreille, sans grésiller.
  const peak = pcm.reduce((m, x) => Math.max(m, Math.abs(x)), 0) || 1
  const drive = 1.8
  for (let i = 0; i < samples; i++) {
    pcm[i] = (0.95 * Math.tanh((drive * pcm[i]!) / peak)) / Math.tanh(drive)
  }
  const bytes = new Uint8Array(44 + samples * 2)
  const view = new DataView(bytes.buffer)
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]!))
    view.setInt16(44 + i * 2, Math.round(v * 32767), true)
  }
  chime = toBase64(bytes)
  return chime
}

// Lit le WAV reçu en base64 sur l'entrée standard, sans fichier temporaire.
const POWERSHELL_PLAY =
  '$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());' +
  '$p=New-Object System.Media.SoundPlayer (New-Object IO.MemoryStream(,$b));$p.PlaySync()'

// Sous Windows, $.audio.play ne trouve aucun lecteur et se tait : PowerShell
// joue le carillon. Ailleurs (pas de PowerShell), c'est $.audio.play (afplay sur macOS).
const playChime = async ($: EngineInterface): Promise<void> => {
  const base64 = chimeBase64()
  try {
    const { exitCode } = await $.process.run(
      ['powershell', '-NoProfile', '-NonInteractive', '-Command', POWERSHELL_PLAY],
      { stdin: base64, timeoutMs: 10_000 },
    )
    if (exitCode === 0) return
  } catch {
    // PowerShell absent : on passe au lecteur du moteur.
  }
  await $.audio.play({ base64, mime: 'audio/wav' })
}

// Chaque canal est tenté seul : l'échec de l'un n'empêche pas les autres.
const alert = async ($: EngineInterface, text: string, settings: Settings): Promise<void> => {
  $.ui.toast(text, { timeoutMs: 8000 })
  const tries: Promise<unknown>[] = []
  if (settings.hasSound) {
    tries.push(playChime($))
  }
  if (settings.hasNotification) {
    tries.push($.ui.notify(text, { title: 'Claude Code' }))
  }
  await Promise.allSettled(tries)
}

const describe = (s: Settings): string =>
  `Alerte après ${s.thresholdSeconds} s · son ${s.hasSound ? 'activé' : 'coupé'} · notification ${s.hasNotification ? 'activée' : 'coupée'}`

const HELP = [
  'Usage :',
  '  /turn-alert            affiche les réglages',
  '  /turn-alert 30         alerte pour les tours de 30 s et plus',
  '  /turn-alert son off    coupe le son (on pour le remettre)',
  '  /turn-alert notif off  coupe la notification système',
  '  /turn-alert test       déclenche une alerte d\'essai',
].join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'turn-alert',
      description: 'Régler l\'alerte de fin de tour long (seuil, son, notification)',
      argumentHint: '[secondes | son on|off | notif on|off | test]',
    })
    return next(e)
  })

  on('command.run', { command: 'turn-alert' }, async ($, e) => {
    const settings = await loadSettings($)
    const [first = '', second = ''] = e.args.trim().toLowerCase().split(/\s+/)

    if (first === '') {
      return { text: `${describe(settings)}\n\n${HELP}` }
    }
    if (first === 'test') {
      await alert($, '🔔 Alerte d\'essai : tour terminé en 1 min 23 s', settings)
      return { text: 'Alerte d\'essai envoyée.' }
    }
    if (/^\d+$/.test(first)) {
      const next = { ...settings, thresholdSeconds: Number(first) }
      await $.store.set(STORE_KEY, next)
      return { text: describe(next) }
    }
    if ((first === 'son' || first === 'notif') && (second === 'on' || second === 'off')) {
      const next = first === 'son'
        ? { ...settings, hasSound: second === 'on' }
        : { ...settings, hasNotification: second === 'on' }
      await $.store.set(STORE_KEY, next)
      return { text: describe(next) }
    }
    return { text: HELP }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Seulement le fil principal, et pas quand c'est vous qui avez interrompu.
    if (e.agentId !== undefined || e.isAborted) {
      return result
    }
    const settings = await loadSettings($)
    if (e.durationMs < settings.thresholdSeconds * 1000) {
      return result
    }
    const took = duration(e.durationMs)
    const text = e.reason === 'answer'
      ? `✅ Claude a terminé (${took})`
      : `⚠️ Tour arrêté par une erreur après ${took}`
    void alert($, text, settings)
    return result
  })
}
