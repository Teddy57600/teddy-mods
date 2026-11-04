import { expect, test } from 'claude-code/testing'

const TURN = { answer: 'ok', isAborted: false, turnId: 't1', reason: 'answer' } as const

// Le kit de test fournit setTimeout, absent des types du module.
declare const setTimeout: (callback: () => void, ms: number) => unknown

// L'alerte part sans être attendue : on la laisse se terminer.
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 50))

test('un tour long déclenche toast, son par PowerShell et notification', async ($, on) => {
  const seen: string[] = []
  on('turn.complete', () => ({ text: 'ok' }))
  on('store.get', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    seen.push(`toast ${JSON.stringify(e)}`)
    return { value: undefined }
  })
  on('process.run', (_, e) => {
    const call = JSON.stringify(e)
    seen.push(`run ${call.includes('powershell') && call.includes('UklGR')}`)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('audio.play', () => {
    seen.push('play')
    return { value: undefined }
  })
  on('ui.notify', () => {
    seen.push('notify')
    return { value: { isSent: true, channel: 'terminal_bell' } }
  })

  await $.turn.complete({ ...TURN, durationMs: 134_000 })
  await settle()

  expect(seen.some(s => s.startsWith('toast') && s.includes('2 min 14 s'))).toBe(true)
  expect(seen).toContain('run true')
  // PowerShell a joué : pas de second carillon par le moteur.
  expect(seen).not.toContain('play')
  expect(seen).toContain('notify')
})

test('sans PowerShell, le carillon passe par $.audio.play', async ($, on) => {
  const seen: string[] = []
  on('turn.complete', () => ({ text: 'ok' }))
  on('store.get', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.notify', () => ({ value: { isSent: true, channel: 'terminal_bell' } }))
  on('process.run', () => {
    throw new Error('powershell introuvable')
  })
  on('audio.play', (_, e) => {
    seen.push(`play ${JSON.stringify(e).includes('UklGR')}`)
    return { value: undefined }
  })

  await $.turn.complete({ ...TURN, durationMs: 90_000 })
  await settle()

  expect(seen).toContain('play true')
})

test('un tour court ne déclenche rien', async ($, on) => {
  const seen: string[] = []
  on('turn.complete', () => ({ text: 'ok' }))
  on('store.get', () => ({ value: undefined }))
  on('ui.toast', () => {
    seen.push('toast')
    return { value: undefined }
  })

  await $.turn.complete({ ...TURN, durationMs: 5_000 })

  expect(seen).toEqual([])
})
