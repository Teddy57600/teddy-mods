import type { PluginOptions, Register } from 'claude-code'

import * as A from './anneaux'

type Mode = 'sombre' | 'clair'
type Theme = 'auto' | Mode
type Tone = { accent: string; soft: string }
type Sky = 'sun' | 'partly' | 'cloud' | 'rain' | 'storm' | 'fog'
type Forecast = { sky: Sky; label: string; color: string } & Record<Mode, Tone>

const BRAND = 'TeddyIA'

// Le réglage `theme` du plugin.json : auto (par défaut), sombre ou clair.
const themeOf = (options: PluginOptions): Theme =>
  options.theme === 'sombre' || options.theme === 'clair' ? options.theme : 'auto'

// Du ciel dégagé à l'orage : plus le contexte se remplit, plus le temps se gâte.
// En clair, les mêmes teintes un peu plus foncées pour rester lisibles sur le fond crème.
const forecast = (percent: number | undefined): Forecast => {
  if (percent === undefined) return { sky: 'fog', label: 'Brume matinale', color: 'gray', sombre: { accent: '#B8A99F', soft: '#E0D4CB' }, clair: { accent: '#8A7A70', soft: '#B0A196' } }
  if (percent < 25) return { sky: 'sun', label: 'Grand soleil', color: 'green', sombre: { accent: '#FF7A2F', soft: '#FFB27A' }, clair: { accent: '#E0601A', soft: '#F59A5C' } }
  if (percent < 50) return { sky: 'partly', label: 'Éclaircies', color: 'green', sombre: { accent: '#FF9A3D', soft: '#FFC98A' }, clair: { accent: '#D9781F', soft: '#F0A860' } }
  if (percent < 70) return { sky: 'cloud', label: 'Nuageux', color: 'yellow', sombre: { accent: '#E8A84A', soft: '#F5D394' }, clair: { accent: '#B8801F', soft: '#D9AE5C' } }
  if (percent < 85) return { sky: 'rain', label: 'Averses', color: 'yellow', sombre: { accent: '#F06A3A', soft: '#FFA27E' }, clair: { accent: '#D4501F', soft: '#EB8460' } }
  return { sky: 'storm', label: 'Orage', color: 'red', sombre: { accent: '#FF3B3B', soft: '#FF8A7A' }, clair: { accent: '#D62828', soft: '#EB6A5A' } }
}

// Les couleurs fixes de la carte, dans chaque mode.
const SURFACE: Record<Mode, Record<string, string>> = {
  sombre: {
    bg0: '#3A2216', bg1: '#24170F', bg2: '#1A120D', title: '#D9C8BD', muted: '#B8A99F', value: '#FFFFFF',
    track0: '#3B2A22', track1: '#2A1E19', disc: '#1E1410', cloud: '#EDE2DA', cloud2: '#BFB2A8', knob: '#E8D5C8',
    off: '#4A3A32', mark: '#FFFFFF', limit: '#FF4D4D',
  },
  clair: {
    bg0: '#FFE4D1', bg1: '#FFF1E7', bg2: '#FFF7F1', title: '#7A5A48', muted: '#8A6E5E', value: '#2A1A12',
    track0: '#EAD6C8', track1: '#F2E3D8', disc: '#FFFFFF', cloud: '#C9B8AC', cloud2: '#A8968A', knob: '#7A5A48',
    off: '#E6D5C9', mark: '#2A1A12', limit: '#D93030',
  },
}

// Les couleurs passent par des variables CSS : en auto, la carte reste sombre et
// bascule sur le clair quand l'affichage demande un thème clair.
const palette = (theme: Theme, tones: (mode: Mode) => Record<string, string>): string => {
  const block = (mode: Mode): string =>
    `svg{${Object.entries({ ...SURFACE[mode], ...tones(mode) }).map(([k, c]) => `--${k}:${c}`).join(';')}}`
  return theme === 'auto' ? `${block('sombre')}@media (prefers-color-scheme: light){${block('clair')}}` : block(theme)
}

const v = (key: string): string => `var(--${key})`

// 850 → « 850 », 62 400 → « 62k », 999 600 et 1 000 000 → « 1M », 1 500 000 → « 1,5M ».
const kilo = (tokens: number): string => {
  if (tokens >= 999_500) return `${(Math.round(tokens / 100_000) / 10).toString().replace('.', ',')}M`
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`
  return String(tokens)
}

const cloud = (dx: number, dy: number, fill: string): string =>
  `<g transform="translate(${dx} ${dy})" style="fill:${fill}">` +
  `<circle cx="-8" cy="3" r="7"/><circle cx="2" cy="-3" r="10"/><circle cx="10" cy="4" r="6"/>` +
  `<rect x="-14" y="3" width="30" height="8" rx="4"/></g>`

const sun = (cx: number, cy: number, r: number): string => {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const x1 = cx + Math.cos(a) * (r + 3)
    const y1 = cy + Math.sin(a) * (r + 3)
    const x2 = cx + Math.cos(a) * (r + 7)
    const y2 = cy + Math.sin(a) * (r + 7)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`
  }).join('')
  return `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:${v('accent')}"/><g style="stroke:${v('accent')}" stroke-width="2.5" stroke-linecap="round">${rays}</g>`
}

const glyph = (f: Forecast): string => {
  switch (f.sky) {
    case 'sun':
      return sun(80, 56, 10)
    case 'partly':
      return sun(74, 50, 8) + cloud(84, 60, v('cloud'))
    case 'cloud':
      return cloud(78, 54, v('cloud')) + cloud(88, 62, v('cloud2'))
    case 'rain':
      return cloud(80, 50, v('cloud')) +
        `<g style="stroke:${v('soft')}" stroke-width="2.5" stroke-linecap="round">` +
        `<line x1="70" y1="66" x2="67" y2="73"/><line x1="80" y1="66" x2="77" y2="73"/><line x1="90" y1="66" x2="87" y2="73"/></g>`
    case 'storm':
      return cloud(80, 48, v('cloud2')) +
        `<path d="M82 60 L74 71 L80 71 L76 81 L88 67 L82 67 L86 60 Z" style="fill:${v('accent')}"/>`
    case 'fog':
      return `<g style="stroke:${v('cloud')}" stroke-width="3" stroke-linecap="round">` +
        `<line x1="66" y1="48" x2="94" y2="48"/><line x1="62" y1="56" x2="90" y2="56"/><line x1="68" y1="64" x2="96" y2="64"/></g>`
  }
}

const card = (percent: number | undefined, tokens: number | undefined, window: number, theme: Theme): string => {
  const f = forecast(percent)
  const css = palette(theme, m => ({ accent: f[m].accent, soft: f[m].soft }))
  const p = Math.max(0, Math.min(100, percent ?? 0))
  const trackX = 300
  const trackW = 420
  const fillW = Math.max(8, (trackW * p) / 100)
  const knobX = trackX + fillW
  // Signal : 5 barres, d'autant plus allumées qu'il reste de la place.
  const lit = percent === undefined ? 0 : Math.max(1, Math.ceil(((100 - p) / 100) * 5))
  const bars = Array.from({ length: 5 }, (_, i) => {
    const h = 5 + i * 3
    const isOn = i < lit
    return `<rect x="${968 + i * 7}" y="${38 - h}" width="4" height="${h}" rx="1" style="fill:${v(isOn ? 'accent' : 'off')}" opacity="${isOn ? 0.6 + i * 0.1 : 1}"/>`
  }).join('')
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6 + Math.PI / 12
    const r1 = 19
    const r2 = i % 2 ? 21.5 : 23
    return `<line x1="${34 + Math.cos(a) * r1}" y1="${28 + Math.sin(a) * r1}" x2="${34 + Math.cos(a) * r2}" y2="${28 + Math.sin(a) * r2}"/>`
  }).join('')
  const font = `font-family="Segoe UI, system-ui, -apple-system, sans-serif"`
  const value = percent === undefined ? '—' : String(percent)
  const tokenLine = tokens === undefined ? 'en attente de mesure' : `${kilo(tokens)} / ${kilo(window)} jetons`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="56" viewBox="0 0 1100 56">
<style>${css}</style>
<defs>
  <linearGradient id="cw-bg" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" style="stop-color:${v('bg0')}"/><stop offset="0.35" style="stop-color:${v('bg1')}"/><stop offset="1" style="stop-color:${v('bg2')}"/>
  </linearGradient>
  <radialGradient id="cw-glow" cx="0.03" cy="0.5" r="0.15">
    <stop offset="0" style="stop-color:${v('accent')};stop-opacity:0.35"/><stop offset="1" style="stop-color:${v('accent')};stop-opacity:0"/>
  </radialGradient>
  <linearGradient id="cw-fill" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" style="stop-color:${v('soft')}"/><stop offset="1" style="stop-color:${v('accent')}"/>
  </linearGradient>
  <linearGradient id="cw-title" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" style="stop-color:${v('soft')}"/><stop offset="1" style="stop-color:${v('accent')}"/>
  </linearGradient>
  <linearGradient id="cw-track" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" style="stop-color:${v('track0')}"/><stop offset="1" style="stop-color:${v('track1')}"/>
  </linearGradient>
</defs>
<rect x="1" y="1" width="1098" height="54" rx="12" fill="url(#cw-bg)" style="stroke:${v('accent')}" stroke-opacity="0.35"/>
<rect x="1" y="1" width="1098" height="54" rx="12" fill="url(#cw-glow)"/>
<g style="stroke:${v('accent')}" stroke-width="1.8" stroke-linecap="round" opacity="0.85">${rays}</g>
<circle cx="34" cy="28" r="16" style="fill:${v('disc')};stroke:${v('accent')}" stroke-width="1.5"/>
<g transform="translate(34 28) scale(0.55) translate(-80 -56)">${glyph(f)}</g>
<text x="68" y="22" ${font} font-size="9.5" font-weight="700" letter-spacing="2" style="fill:${v('title')}">MÉTÉO DU CONTEXTE</text>
<text x="67" y="43" ${font} font-size="19" font-weight="800" font-style="italic" fill="url(#cw-title)">${f.label}</text>
<rect x="${trackX}" y="24" width="${trackW}" height="8" rx="4" fill="url(#cw-track)"/>
<rect x="${trackX}" y="24" width="${fillW}" height="8" rx="4" fill="url(#cw-fill)"/>
<line x1="${trackX + trackW * 0.5}" y1="19" x2="${trackX + trackW * 0.5}" y2="37" style="stroke:${v('mark')}" stroke-opacity="0.35" stroke-width="1.2"/>
<line x1="${trackX + trackW * 0.85}" y1="19" x2="${trackX + trackW * 0.85}" y2="37" style="stroke:${v('limit')}" stroke-width="1.2" stroke-dasharray="3 3"/>
<circle cx="${knobX}" cy="28" r="9" style="fill:${v('knob')};stroke:${v('knob')}" fill-opacity="0.35" stroke-opacity="0.5"/>
<text x="750" y="37" ${font} font-size="24" font-weight="800" style="fill:${v('value')}">${value}<tspan font-size="14" font-weight="600" dx="4">%</tspan></text>
<text x="830" y="35" ${font} font-size="12" style="fill:${v('muted')}">${tokenLine}</text>
<text x="1080" y="34" ${font} font-size="14" font-weight="800" font-style="italic" style="fill:${v('accent')}" text-anchor="end">${BRAND}</text>
${bars}
</svg>`
}

// Style « anneaux » : la pastille et l'anneau suivent le remplissage, aux mêmes seuils que la météo.
const dotOf = (percent: number | undefined): string => {
  if (percent === undefined) return A.HUE.gray
  if (percent < 25) return A.HUE.green
  if (percent < 50) return A.HUE.cyan
  if (percent < 70) return A.HUE.purple
  if (percent < 85) return A.HUE.orange
  return A.HUE.red
}

// Style « anneaux » : un anneau pour la place occupée, un pour la place encore libre.
const cardAnneaux = (percent: number | undefined, tokens: number | undefined, window: number, theme: Theme): string => {
  const W = 1100
  const H = 112
  const cy = H / 2
  const f = forecast(percent)
  const p = percent === undefined ? undefined : Math.max(0, Math.min(100, percent))
  const free = p === undefined ? undefined : 100 - p
  const used = p === undefined ? A.HUE.cyan : p >= 85 ? A.HUE.red : p >= 70 ? A.HUE.orange : A.HUE.cyan
  // Signal : 4 barres, d'autant plus allumées qu'il reste de la place.
  const lit = free === undefined ? 0 : Math.max(1, Math.ceil((free / 100) * 4))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${A.palette(theme)}</style>
${A.frame(W, H, 'cw-ring')}
${A.header(28, cy, 'CONTEXTE', f.label, dotOf(percent))}
${A.ring(330, cy, 38, p, p === undefined ? '—' : `${percent}%`, used)}
${A.info(392, cy, 'Occupé', `Fenêtre de ${kilo(window)} jetons`, tokens === undefined ? 'en attente' : `${kilo(tokens)} jetons`, 'tokens')}
${A.ring(615, cy, 38, free, free === undefined ? '—' : `${free}%`, A.HUE.purple)}
${A.info(677, cy, 'Disponible', 'Place encore libre', tokens === undefined ? '—' : `${kilo(Math.max(0, window - tokens))} jetons`, 'tokens')}
${A.account(W - 28, cy, BRAND, lit)}
</svg>`
}

export const register: Register = (on, options) => {
  const theme = themeOf(options)
  const style = A.styleOf(options.style)

  // Redessine la bande dès qu'une réponse a fait évoluer le contexte.
  on('turn.complete', ($, e, next) => {
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { context } = await $.session.usage()
    const table = $.ui.resolve(e)
    // Les autres bandes (un autre mod) restent au-dessus de la nôtre.
    const below = await next(e)
    const f = forecast(context.percent)
    const alt = context.percent === undefined
      ? 'Météo du contexte : brume matinale, pas encore de mesure'
      : `Météo du contexte : ${f.label}, ${context.percent} % (${kilo(context.tokens ?? 0)} sur ${kilo(context.window)} jetons)`

    // Desktop, VS Code, mobile : la carte en SVG. La table du terminal connaît aussi
    // `Svg` mais ne le dessine pas : on teste la surface.
    if (e.surface !== 'terminal' && 'Svg' in table) {
      const { Box, Svg } = table
      return (
        <Box flexDirection="column" gap="xs">
          {below}
          <Svg source={(style === 'anneaux' ? cardAnneaux : card)(context.percent, context.tokens, context.window, theme)} alt={alt} />
        </Box>
      )
    }

    // Terminal : pas de SVG, une ligne de texte.
    const { Box, Text } = table
    const p = Math.max(0, Math.min(100, context.percent ?? 0))
    const filled = Math.round((p / 100) * 20)
    return (
      <Box flexDirection="column">
        {below}
        <Text>
          <Text weight="bold">Météo du contexte</Text> :{' '}
          <Text color={f.color}>{f.label}</Text>{' '}
          <Text color={f.color}>{'█'.repeat(filled) + '░'.repeat(20 - filled)}</Text>{' '}
          <Text dimColor>
            {context.percent === undefined ? '—' : `${context.percent}% (${kilo(context.tokens ?? 0)}/${kilo(context.window)})`}
          </Text>
        </Text>
      </Box>
    )
  })
}
