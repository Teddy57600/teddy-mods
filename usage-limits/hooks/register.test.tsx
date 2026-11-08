import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-limits',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: { hasSurvey: false },
} as const

const NOW = Date.parse('2026-11-08T21:00:00Z')
const usage = {
  value: {
    startedAt: NOW,
    context: { window: 200_000 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 14, resetsAt: new Date(NOW + 2 * 3_600_000).toISOString() },
      { kind: 'seven_day', percentUsed: 40, resetsAt: new Date(NOW + 80 * 3_600_000).toISOString() },
    ],
  },
}

test('dans le terminal, la bande est une ligne de texte', async ($, on) => {
  on('session.usage', () => usage)
  // Ce hook tient le rôle du moteur, qui dessine ce qu'il y a sous la bande.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>moteur</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /5 h/ }))?.text).toContain('14%')
  await ui.unmount()
})

test('sur le desktop, la bande est une carte SVG', async ($, on) => {
  on('session.usage', () => usage)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>moteur</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  await ui.unmount()
})
