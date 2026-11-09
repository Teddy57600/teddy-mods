import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'context-weather',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: { hasSurvey: false },
} as const

const usage = {
  value: { startedAt: 0, context: { window: 200_000, tokens: 36_000, percent: 18 }, rateLimits: [] },
}

test('dans le terminal, la bande est une ligne de texte', async ($, on) => {
  on('session.usage', () => usage)
  // Ce hook tient le rôle du moteur, qui dessine ce qu'il y a sous la bande.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>moteur</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /Météo du contexte/ }))?.text).toContain('Grand soleil')
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

test('avec le style anneaux, la carte montre l’occupé et le disponible', { options: { style: 'anneaux' } }, async ($, on) => {
  on('session.usage', () => usage)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>moteur</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())

  expect(drawn).toContain('CONTEXTE')
  expect(drawn).toContain('18%')
  expect(drawn).toContain('82%')
  expect(drawn).toContain('164k jetons')
  await ui.unmount()
})

test('par défaut, la carte garde le style classique', async ($, on) => {
  on('session.usage', () => usage)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>moteur</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect(JSON.stringify(await ui.drawn())).toContain('MÉTÉO DU CONTEXTE')
  await ui.unmount()
})
