import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

type Level = { label: string; accent: string; light: string; color: string }

const BRAND = 'TeddyIA'

// Plus la limite la plus entamée approche 100 %, plus le ton se durcit.
const level = (percent: number | undefined): Level => {
  if (percent === undefined) return { label: 'Pas de mesure', accent: '#B8A99F', light: '#E0D4CB', color: 'gray' }
  if (percent < 25) return { label: 'Large marge', accent: '#FF7A2F', light: '#FFB27A', color: 'green' }
  if (percent < 50) return { label: 'Confortable', accent: '#FF9A3D', light: '#FFC98A', color: 'green' }
  if (percent < 70) return { label: 'À surveiller', accent: '#E8A84A', light: '#F5D394', color: 'yellow' }
  if (percent < 100) return { label: 'Serré', accent: '#F06A3A', light: '#FFA27E', color: 'yellow' }
  return { label: 'Limite atteinte', accent: '#FF3B3B', light: '#FF8A7A', color: 'red' }
}

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

const two = (n: number): string => String(n).padStart(2, '0')

// « 14h30 » pour la fenêtre de 5 h, « lun. 09h00 » pour la semaine.
const resetLabel = (resetsAt: string | undefined, withDay: boolean): string => {
  if (resetsAt === undefined) return ''
  const d = new Date(resetsAt)
  if (Number.isNaN(d.getTime())) return ''
  const time = `${two(d.getHours())}h${two(d.getMinutes())}`
  return `↻ ${withDay ? `${DAYS[d.getDay()]} ` : ''}${time}`
}

// Une décimale au plus : 42,857 → « 42,9 », 40 → « 40 ».
const pct = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',')

type Window = { title: string; limit: SessionRateLimit | undefined; withDay: boolean }

const gauge = (x: number, w: Window, font: string, id: string): string => {
  const p = w.limit?.percentUsed
  const l = level(p)
  const clamped = Math.max(0, Math.min(100, p ?? 0))
  const trackW = 200
  const fillW = Math.max(8, (trackW * clamped) / 100)
  const value = p === undefined ? '—' : pct(p)
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="${l.light}"/><stop offset="1" stop-color="${l.accent}"/>
</linearGradient>
<text x="${x}" y="20" ${font} font-size="9.5" font-weight="700" letter-spacing="2" fill="#D9C8BD">${w.title}</text>
<text x="${x + trackW}" y="20" ${font} font-size="10" fill="#B8A99F" text-anchor="end">${resetLabel(w.limit?.resetsAt, w.withDay)}</text>
<rect x="${x}" y="28" width="${trackW}" height="8" rx="4" fill="url(#ul-track)"/>
<rect x="${x}" y="28" width="${fillW}" height="8" rx="4" fill="url(#${id})"/>
<line x1="${x + trackW * 0.85}" y1="24" x2="${x + trackW * 0.85}" y2="40" stroke="#FF4D4D" stroke-width="1.2" stroke-dasharray="3 3"/>
<circle cx="${x + fillW}" cy="32" r="7.5" fill="#E8D5C8" fill-opacity="0.35" stroke="#E8D5C8" stroke-opacity="0.5"/>
<text x="${x + trackW + 16}" y="40" ${font} font-size="22" font-weight="800" fill="#FFFFFF">${value}<tspan font-size="13" font-weight="600" dx="4">%</tspan></text>`
}

// Sablier dans le cercle, dont le sable baisse en haut à mesure que la limite se remplit.
const hourglass = (accent: string, percent: number): string => {
  const top = 1 - Math.max(0, Math.min(100, percent)) / 100
  const topH = 6 * top
  const botH = 6 * (1 - top)
  return `<g fill="none" stroke="#EDE2DA" stroke-width="1.6" stroke-linejoin="round">` +
    `<path d="M26 16 H42 M26 40 H42 M28 16 C28 24 34 25 34 28 C34 31 28 32 28 40 M40 16 C40 24 34 25 34 28 C34 31 40 32 40 40"/></g>` +
    `<rect x="30" y="${26 - topH}" width="8" height="${topH}" fill="${accent}" opacity="0.9"/>` +
    `<rect x="29" y="${39 - botH}" width="10" height="${botH}" fill="${accent}"/>`
}

const card = (session: Window, week: Window, stale: boolean): string => {
  const worst = [session.limit?.percentUsed, week.limit?.percentUsed].filter((n): n is number => n !== undefined)
  const peak = worst.length ? Math.max(...worst) : undefined
  const l = level(peak)
  // Signal : 5 barres, d'autant plus allumées qu'il reste de la marge.
  const lit = peak === undefined ? 0 : Math.max(peak >= 100 ? 0 : 1, Math.ceil(((100 - Math.min(100, peak)) / 100) * 5))
  const bars = Array.from({ length: 5 }, (_, i) => {
    const h = 5 + i * 3
    const isOn = i < lit
    return `<rect x="${968 + i * 7}" y="${38 - h}" width="4" height="${h}" rx="1" fill="${isOn ? l.accent : '#4A3A32'}" opacity="${isOn ? 0.6 + i * 0.1 : 1}"/>`
  }).join('')
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6 + Math.PI / 12
    const r1 = 19
    const r2 = i % 2 ? 21.5 : 23
    return `<line x1="${34 + Math.cos(a) * r1}" y1="${28 + Math.sin(a) * r1}" x2="${34 + Math.cos(a) * r2}" y2="${28 + Math.sin(a) * r2}"/>`
  }).join('')
  const font = `font-family="Segoe UI, system-ui, -apple-system, sans-serif"`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="56" viewBox="0 0 1100 56">
<defs>
  <linearGradient id="ul-bg" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3A2216"/><stop offset="0.35" stop-color="#24170F"/><stop offset="1" stop-color="#1A120D"/>
  </linearGradient>
  <radialGradient id="ul-glow" cx="0.03" cy="0.5" r="0.15">
    <stop offset="0" stop-color="${l.accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${l.accent}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="ul-title" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${l.light}"/><stop offset="1" stop-color="${l.accent}"/>
  </linearGradient>
  <linearGradient id="ul-track" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3B2A22"/><stop offset="1" stop-color="#2A1E19"/>
  </linearGradient>
</defs>
<rect x="1" y="1" width="1098" height="54" rx="12" fill="url(#ul-bg)" stroke="${l.accent}" stroke-opacity="0.35"/>
<rect x="1" y="1" width="1098" height="54" rx="12" fill="url(#ul-glow)"/>
<g stroke="${l.accent}" stroke-width="1.8" stroke-linecap="round" opacity="0.85">${rays}</g>
<circle cx="34" cy="28" r="16" fill="#1E1410" stroke="${l.accent}" stroke-width="1.5"/>
<g transform="translate(34 28) scale(0.75) translate(-34 -28)">${hourglass(l.accent, peak ?? 0)}</g>
<text x="68" y="22" ${font} font-size="9.5" font-weight="700" letter-spacing="2" fill="#D9C8BD">${stale ? 'DERNIÈRE MESURE' : "LIMITES D'USAGE"}</text>
<text x="67" y="43" ${font} font-size="19" font-weight="800" font-style="italic" fill="url(#ul-title)">${l.label}</text>
${gauge(290, session, font, 'ul-fill5h')}
${gauge(620, week, font, 'ul-fill7d')}
<text x="1080" y="34" ${font} font-size="14" font-weight="800" font-style="italic" fill="${l.accent}" text-anchor="end">${BRAND}</text>
${bars}
</svg>`
}

// Les limites sont celles du compte, pas de la session : la dernière mesure reste
// valable d'une session à l'autre, jusqu'à la réinitialisation de chaque fenêtre.
const LAST = 'lastRateLimits'

const remembered = async ($: EngineInterface): Promise<SessionRateLimit[]> => {
  const saved = await $.store.get(LAST)
  if (!Array.isArray(saved)) return []
  const now = await $.clock.now()
  return (saved as SessionRateLimit[]).filter(r => r.resetsAt !== undefined && Date.parse(r.resetsAt) > now)
}

export const register: Register = on => {
  // Le moteur publie ici chaque nouvelle mesure : après une réponse, et dès qu'une
  // fenêtre bouge d'un point entier.
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      if (e.rateLimits.length) await $.store.set(LAST, e.rateLimits)
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    // Pas encore de mesure dans cette session : on reprend la dernière connue.
    const live = (await $.session.usage()).rateLimits
    const rateLimits = live.length ? live : await remembered($)
    const stale = live.length === 0 && rateLimits.length > 0
    const session: Window = { title: 'SESSION · 5 H', limit: rateLimits.find(r => r.kind === 'five_hour'), withDay: false }
    const week: Window = { title: 'HEBDO · 7 J', limit: rateLimits.find(r => r.kind === 'seven_day'), withDay: true }
    const describe = (w: Window, name: string): string =>
      w.limit === undefined ? `${name} : pas de mesure` : `${name} : ${pct(w.limit.percentUsed)} % ${resetLabel(w.limit.resetsAt, w.withDay)}`
    const alt = `Limites d'usage${stale ? ' (dernière mesure)' : ''}. ${describe(session, '5 heures')}. ${describe(week, '7 jours')}.`
    const table = $.ui.resolve(e)
    // Les autres bandes (un autre mod) restent au-dessus de la nôtre.
    const below = await next(e)

    // Desktop, VS Code, mobile : la carte en SVG.
    if ('Svg' in table) {
      const { Box, Svg } = table
      return (
        <Box flexDirection="column" gap="xs">
          {below}
          <Svg source={card(session, week, stale)} alt={alt} />
        </Box>
      )
    }

    // Terminal : pas de SVG, une ligne de texte.
    const { Box, Text } = table
    const line = (w: Window, name: string) => {
      const p = w.limit?.percentUsed
      const filled = Math.round((Math.max(0, Math.min(100, p ?? 0)) / 100) * 10)
      const l = level(p)
      return (
        <Text>
          <Text weight="bold">{name}</Text>{' '}
          <Text color={l.color}>{'█'.repeat(filled) + '░'.repeat(10 - filled)}</Text>{' '}
          <Text>{p === undefined ? '—' : `${pct(p)}%`}</Text>{' '}
          <Text dimColor>{resetLabel(w.limit?.resetsAt, w.withDay)}</Text>
        </Text>
      )
    }
    return (
      <Box flexDirection="column">
        {below}
        <Text>
          {line(session, '5 h')}
          {'   '}
          {line(week, '7 j')}
          {stale ? <Text dimColor>{'   (dernière mesure)'}</Text> : null}
        </Text>
      </Box>
    )
  })
}
