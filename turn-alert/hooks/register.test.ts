import { expect, test } from 'claude-code/testing'

const TURN = { answer: 'ok', isAborted: false, turnId: 't1', reason: 'answer' } as const

test('un tour long déclenche toast, son et notification', async ($, on) => {
  const seen: string[] = []
  on('turn.complete', () => ({ text: 'ok' }))
  on('store.get', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    seen.push(`toast ${JSON.stringify(e)}`)
    return { value: undefined }
  })
  on('audio.play', (_, e) => {
    seen.push(`play ${JSON.stringify(e).slice(0, 40)}`)
    return { value: undefined }
  })
  on('ui.notify', () => {
    seen.push('notify')
    return { value: { isSent: true, channel: 'terminal_bell' } }
  })

  await $.turn.complete({ ...TURN, durationMs: 134_000 })
  await new Promise(resolve => setTimeout(resolve, 50))

  expect(seen.some(s => s.startsWith('toast') && s.includes('2 min 14 s'))).toBe(true)
  expect(seen.some(s => s.startsWith('play') && s.includes('UklGR'))).toBe(true)
  expect(seen).toContain('notify')
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
