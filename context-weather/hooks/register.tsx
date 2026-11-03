import type { Register } from 'claude-code'

type Sky = 'sun' | 'partly' | 'cloud' | 'rain' | 'storm' | 'fog'
type Forecast = { sky: Sky; label: string; accent: string; light: string; color: string }

const BRAND = 'TeddyIA'

// Du ciel dégagé à l'orage : plus le contexte se remplit, plus le temps se gâte.
const forecast = (percent: number | undefined): Forecast => {
  if (percent === undefined) return { sky: 'fog', label: 'Brume matinale', accent: '#B8A99F', light: '#E0D4CB', color: 'gray' }
  if (percent < 25) return { sky: 'sun', label: 'Grand soleil', accent: '#FF7A2F', light: '#FFB27A', color: 'green' }
  if (percent < 50) return { sky: 'partly', label: 'Éclaircies', accent: '#FF9A3D', light: '#FFC98A', color: 'green' }
  if (percent < 70) return { sky: 'cloud', label: 'Nuageux', accent: '#E8A84A', light: '#F5D394', color: 'yellow' }
  if (percent < 85) return { sky: 'rain', label: 'Averses', accent: '#F06A3A', light: '#FFA27E', color: 'yellow' }
  return { sky: 'storm', label: 'Orage', accent: '#FF3B3B', light: '#FF8A7A', color: 'red' }
}

// 850 → « 850 », 62 400 → « 62k », 999 600 et 1 000 000 → « 1M », 1 500 000 → « 1,5M ».
const kilo = (tokens: number): string => {
  if (tokens >= 999_500) return `${(Math.round(tokens / 100_000) / 10).toString().replace('.', ',')}M`
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`
  return String(tokens)
}

const cloud = (dx: number, dy: number, fill: string): string =>
  `<g transform="translate(${dx} ${dy})" fill="${fill}">` +
  `<circle cx="-8" cy="3" r="7"/><circle cx="2" cy="-3" r="10"/><circle cx="10" cy="4" r="6"/>` +
  `<rect x="-14" y="3" width="30" height="8" rx="4"/></g>`

const sun = (cx: number, cy: number, r: number, accent: string): string => {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const x1 = cx + Math.cos(a) * (r + 3)
    const y1 = cy + Math.sin(a) * (r + 3)
    const x2 = cx + Math.cos(a) * (r + 7)
    const y2 = cy + Math.sin(a) * (r + 7)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`
  }).join('')
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}"/><g stroke="${accent}" stroke-width="2.5" stroke-linecap="round">${rays}</g>`
}

const glyph = (f: Forecast): string => {
  const c = '#EDE2DA'
  switch (f.sky) {
    case 'sun':
      return sun(80, 56, 10, f.accent)
    case 'partly':
      return sun(74, 50, 8, f.accent) + cloud(84, 60, c)
    case 'cloud':
      return cloud(78, 54, c) + cloud(88, 62, '#BFB2A8')
    case 'rain':
      return cloud(80, 50, c) +
        `<g stroke="${f.light}" stroke-width="2.5" stroke-linecap="round">` +
        `<line x1="70" y1="66" x2="67" y2="73"/><line x1="80" y1="66" x2="77" y2="73"/><line x1="90" y1="66" x2="87" y2="73"/></g>`
    case 'storm':
      return cloud(80, 48, '#BFB2A8') +
        `<path d="M82 60 L74 71 L80 71 L76 81 L88 67 L82 67 L86 60 Z" fill="${f.accent}"/>`
    case 'fog':
      return `<g stroke="${c}" stroke-width="3" stroke-linecap="round">` +
        `<line x1="66" y1="48" x2="94" y2="48"/><line x1="62" y1="56" x2="90" y2="56"/><line x1="68" y1="64" x2="96" y2="64"/></g>`
  }
}

const card = (percent: number | undefined, tokens: number | undefined, window: number): string => {
  const f = forecast(percent)
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
    return `<rect x="${968 + i * 7}" y="${38 - h}" width="4" height="${h}" rx="1" fill="${isOn ? f.accent : '#4A3A32'}" opacity="${isOn ? 0.6 + i * 0.1 : 1}"/>`
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
<defs>
  <linearGradient id="cw-bg" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3A2216"/><stop offset="0.35" stop-color="#24170F"/><stop offset="1" stop-color="#1A120D"/>
  </linearGradient>
  <radialGradient id="cw-glow" cx="0.03" cy="0.5" r="0.15">
    <stop offset="0" stop-color="${f.accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${f.accent}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="cw-fill" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${f.light}"/><stop offset="1" stop-color="${f.accent}"/>
  </linearGradient>
  <linearGradient id="cw-title" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${f.light}"/><stop offset="1" stop-color="${f.accent}"/>
  </linearGradient>
  <linearGradient id="cw-track" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3B2A22"/><stop offset="1" stop-color="#2A1E19"/>
  </linearGradient>
</defs>
<rect x="1" y="1" width="1098" height="54" rx="12" fill="url(#cw-bg)" stroke="${f.accent}" stroke-opacity="0.35"/>
<rect x="1" y="1" width="1098" height="54" rx="12" fill="url(#cw-glow)"/>
<g stroke="${f.accent}" stroke-width="1.8" stroke-linecap="round" opacity="0.85">${rays}</g>
<circle cx="34" cy="28" r="16" fill="#1E1410" stroke="${f.accent}" stroke-width="1.5"/>
<g transform="translate(34 28) scale(0.55) translate(-80 -56)">${glyph(f)}</g>
<text x="68" y="22" ${font} font-size="9.5" font-weight="700" letter-spacing="2" fill="#D9C8BD">MÉTÉO DU CONTEXTE</text>
<text x="67" y="43" ${font} font-size="19" font-weight="800" font-style="italic" fill="url(#cw-title)">${f.label}</text>
<rect x="${trackX}" y="24" width="${trackW}" height="8" rx="4" fill="url(#cw-track)"/>
<rect x="${trackX}" y="24" width="${fillW}" height="8" rx="4" fill="url(#cw-fill)"/>
<line x1="${trackX + trackW * 0.5}" y1="19" x2="${trackX + trackW * 0.5}" y2="37" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="1.2"/>
<line x1="${trackX + trackW * 0.85}" y1="19" x2="${trackX + trackW * 0.85}" y2="37" stroke="#FF4D4D" stroke-width="1.2" stroke-dasharray="3 3"/>
<circle cx="${knobX}" cy="28" r="9" fill="#E8D5C8" fill-opacity="0.35" stroke="#E8D5C8" stroke-opacity="0.5"/>
<text x="750" y="37" ${font} font-size="24" font-weight="800" fill="#FFFFFF">${value}<tspan font-size="14" font-weight="600" dx="4">%</tspan></text>
<text x="830" y="35" ${font} font-size="12" fill="#B8A99F">${tokenLine}</text>
<text x="1080" y="34" ${font} font-size="14" font-weight="800" font-style="italic" fill="${f.accent}" text-anchor="end">${BRAND}</text>
${bars}
</svg>`
}

export const register: Register = on => {
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

    // Desktop, VS Code, mobile : la carte en SVG.
    if ('Svg' in table) {
      const { Box, Svg } = table
      return (
        <Box flexDirection="column" gap="xs">
          {below}
          <Svg source={card(context.percent, context.tokens, context.window)} alt={alt} />
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
