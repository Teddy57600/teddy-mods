import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'usage-forecast',
  component: 'Pane',
  requestId: 'usage-forecast',
  props: {
    title: 'Prévision hebdo',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

// La situation de la capture : 40 % utilisés, reset dans 80 h, donc 88 h écoulées.
const NOW = Date.parse('2026-11-08T21:00:00Z')
const week = (percentUsed: number, inHours: number) => ({
  kind: 'seven_day',
  percentUsed,
  resetsAt: new Date(NOW + inHours * 3_600_000).toISOString(),
})

const usage = (rateLimits: unknown[]) => ({
  value: { startedAt: NOW, context: { window: 200_000 }, rateLimits },
})

test('le panneau prévoit le pourcentage au reset et le rythme', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('session.usage', () => usage([week(40, 80)]))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /au reset/ }))?.text).toContain('40 % → 76 % au reset')
  expect((await ui.find({ type: 'Text', text: /Rythme/ }))?.text).toContain('11 %/j')
  expect((await ui.find({ type: 'Text', text: /marge/ }))?.text).toContain('×1,7')
  await ui.unmount()
})

test('à un rythme trop élevé, il annonce la limite avant le reset', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('session.usage', () => usage([week(70, 80)]))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /Limite avant le reset/ }))).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /limite atteinte/ }))?.text).toMatch(/limite atteinte mar\. 10\/11/)
  await ui.unmount()
})

test('sans mesure dans la session, il reprend la dernière mesure enregistrée', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('session.usage', () => usage([]))
  on('store.get', () => ({ value: week(40, 80) }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /dernière mesure/ }))).toBeDefined()
  await ui.unmount()
})

test('sur le desktop, le panneau est une carte SVG à sa largeur', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('session.usage', () => usage([week(40, 80)]))

  for (const [bodyColumns, width] of [[40, 300], [90, 640]] as const) {
    const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns }, surface: 'desktop' })
    expect(JSON.stringify(await ui.drawn())).toContain(`width=\\"${width}\\"`)
    await ui.unmount()
  }
})
