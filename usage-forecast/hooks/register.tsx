import type { EngineInterface, PluginOptions, Register, SessionRateLimit } from 'claude-code'

type Mode = 'sombre' | 'clair'
type Theme = 'auto' | Mode
type Tone = { accent: string; soft: string }
type Level = { label: string; color: string } & Record<Mode, Tone>

const BRAND = 'TeddyIA'
const PANE = 'usage-forecast'
const TITLE = 'Prévision hebdo'

// Le réglage `theme` du plugin.json : auto (par défaut), sombre ou clair.
const themeOf = (options: PluginOptions): Theme =>
  options.theme === 'sombre' || options.theme === 'clair' ? options.theme : 'auto'

// Les mêmes teintes que les bandes, en sombre et en clair.
const TONES: Record<'gray' | 't1' | 't2' | 't3' | 't4' | 't5', Record<Mode, Tone>> = {
  gray: { sombre: { accent: '#B8A99F', soft: '#E0D4CB' }, clair: { accent: '#8A7A70', soft: '#B0A196' } },
  t1: { sombre: { accent: '#FF7A2F', soft: '#FFB27A' }, clair: { accent: '#E0601A', soft: '#F59A5C' } },
  t2: { sombre: { accent: '#FF9A3D', soft: '#FFC98A' }, clair: { accent: '#D9781F', soft: '#F0A860' } },
  t3: { sombre: { accent: '#E8A84A', soft: '#F5D394' }, clair: { accent: '#B8801F', soft: '#D9AE5C' } },
  t4: { sombre: { accent: '#F06A3A', soft: '#FFA27E' }, clair: { accent: '#D4501F', soft: '#EB8460' } },
  t5: { sombre: { accent: '#FF3B3B', soft: '#FF8A7A' }, clair: { accent: '#D62828', soft: '#EB6A5A' } },
}

// Les couleurs fixes de la carte, dans chaque mode.
const SURFACE: Record<Mode, Record<string, string>> = {
  sombre: {
    bg0: '#3A2216', bg1: '#24170F', bg2: '#1A120D', title: '#D9C8BD', muted: '#B8A99F', value: '#FFFFFF',
    track0: '#3B2A22', track1: '#2A1E19', disc: '#1E1410', ink: '#EDE2DA', knob: '#E8D5C8', off: '#4A3A32',
    limit: '#FF4D4D', rule: '#4A3A32',
  },
  clair: {
    bg0: '#FFE4D1', bg1: '#FFF1E7', bg2: '#FFF7F1', title: '#7A5A48', muted: '#8A6E5E', value: '#2A1A12',
    track0: '#EAD6C8', track1: '#F2E3D8', disc: '#FFFFFF', ink: '#6B5244', knob: '#7A5A48', off: '#E6D5C9',
    limit: '#D93030', rule: '#EAD6C8',
  },
}

// Les couleurs passent par des variables CSS : en auto, la carte reste sombre et
// bascule sur le clair quand l'affichage demande un thème clair.
const palette = (theme: Theme, tone: Record<Mode, Tone>): string => {
  const block = (mode: Mode): string =>
    `svg{${Object.entries({ ...SURFACE[mode], accent: tone[mode].accent, soft: tone[mode].soft }).map(([k, c]) => `--${k}:${c}`).join(';')}}`
  return theme === 'auto' ? `${block('sombre')}@media (prefers-color-scheme: light){${block('clair')}}` : block(theme)
}

const v = (key: string): string => `var(--${key})`

const WEEK_HOURS = 168
// Sous trois heures de recul, le rythme ne veut encore rien dire.
const MIN_HOURS = 3
const HOUR = 3_600_000

type Forecast = {
  used: number
  resetsAt: number
  remainingH: number
  elapsedH: number
  // Le reste n'existe qu'avec assez de recul sur la semaine.
  ratePerH?: number
  projected?: number
  limitInH?: number
  limitAt?: number
  neededPerDay: number
  margin?: number
}

// Rythme moyen depuis le début de la fenêtre de 7 jours, prolongé jusqu'au reset.
const forecastOf = (limit: SessionRateLimit | undefined, now: number): Forecast | undefined => {
  if (limit?.resetsAt === undefined) return undefined
  const resetsAt = Date.parse(limit.resetsAt)
  if (Number.isNaN(resetsAt)) return undefined
  const used = limit.percentUsed
  const remainingH = Math.max(0, (resetsAt - now) / HOUR)
  const elapsedH = Math.max(0, WEEK_HOURS - remainingH)
  const neededPerDay = remainingH > 0 ? (Math.max(0, 100 - used) / remainingH) * 24 : 0
  const f: Forecast = { used, resetsAt, remainingH, elapsedH, neededPerDay }
  if (elapsedH < MIN_HOURS) return f
  const ratePerH = used / elapsedH
  f.ratePerH = ratePerH
  f.projected = used + ratePerH * remainingH
  if (ratePerH > 0 && used < 100) {
    f.limitInH = (100 - used) / ratePerH
    f.limitAt = now + f.limitInH * HOUR
    f.margin = neededPerDay / (ratePerH * 24)
  }
  return f
}

// Le verdict porte sur le pourcentage prévu au reset.
const levelOf = (f: Forecast | undefined): Level => {
  if (f === undefined) return { label: 'Pas de mesure', color: 'gray', ...TONES.gray }
  if (f.used >= 100) return { label: 'Limite atteinte', color: 'red', ...TONES.t5 }
  if (f.projected === undefined) return { label: 'Début de semaine', color: 'green', ...TONES.t1 }
  if (f.projected < 50) return { label: 'Large marge', color: 'green', ...TONES.t1 }
  if (f.projected < 75) return { label: 'Confortable', color: 'green', ...TONES.t2 }
  if (f.projected < 90) return { label: 'À surveiller', color: 'yellow', ...TONES.t3 }
  if (f.projected < 100) return { label: 'Juste', color: 'yellow', ...TONES.t4 }
  return { label: 'Limite avant le reset', color: 'red', ...TONES.t5 }
}

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

const two = (n: number): string => String(n).padStart(2, '0')

// « jeu. 12/11 05h00 ».
const when = (ms: number): string => {
  const d = new Date(ms)
  return `${DAYS[d.getDay()]} ${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}h${two(d.getMinutes())}`
}

// « 3 j 8 h », « 8 h 35 », « 40 min ».
const span = (hours: number): string => {
  const minutes = Math.round(hours * 60)
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  if (d > 0) return `${d} j ${h} h`
  if (h > 0) return `${h} h ${two(m)}`
  return `${m} min`
}

// Une décimale sous 10, aucune au-delà : « 4,5 », « 11 ».
const num = (n: number): string => (n < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n))).replace('.', ',')

type View = {
  f: Forecast | undefined
  l: Level
  stale: boolean
  resetLine: string
  rate: string
  rateSub: string
  resetIn: string
  resetSub: string
  margin: string
  marginSub: string
  limitIn: string
  limitSub: string
  verdict: string
}

const viewOf = (f: Forecast | undefined, stale: boolean): View => {
  const l = levelOf(f)
  if (f === undefined) {
    return {
      f, l, stale, resetLine: '', rate: '—', rateSub: '', resetIn: '—', resetSub: '', margin: '—', marginSub: '',
      limitIn: '—', limitSub: '', verdict: 'En attente de la première mesure.',
    }
  }
  const hasRate = f.ratePerH !== undefined
  const limitBefore = f.limitAt !== undefined && f.limitAt < f.resetsAt
  return {
    f, l, stale,
    resetLine: `↻ ${when(f.resetsAt)}`,
    rate: hasRate ? `${num(f.ratePerH! * 24)} %/j` : '—',
    rateSub: hasRate ? `${String(Math.round(f.ratePerH! * 100) / 100).replace('.', ',')} %/h en moyenne` : 'pas encore assez de recul',
    resetIn: span(f.remainingH),
    resetSub: `écoulé ${span(f.elapsedH)}`,
    margin: f.margin === undefined ? '—' : `×${num(f.margin)}`,
    marginSub: `limite à ${num(f.neededPerDay)} %/j`,
    limitIn: f.limitInH === undefined ? '—' : span(f.limitInH),
    limitSub: f.limitAt === undefined ? '' : limitBefore ? `le ${when(f.limitAt)}` : 'après le reset',
    verdict: f.used >= 100
      ? 'La limite des 7 jours est atteinte.'
      : !hasRate
        ? 'La semaine vient de commencer.'
        : limitBefore
          ? `À ce rythme, limite atteinte ${when(f.limitAt!)}.`
          : `À ce rythme, environ ${Math.round(f.projected!)} % au reset.`,
  }
}

// Petite courbe dans le cercle : la consommation, puis sa projection en pointillés.
const glyph = (): string =>
  `<polyline points="23,36 28,33 32,34 36,29" fill="none" style="stroke:${v('ink')}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<line x1="36" y1="29" x2="45" y2="20" style="stroke:${v('accent')}" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 3"/>` +
  `<circle cx="36" cy="29" r="2.4" style="fill:${v('accent')}"/>`

// Un texte SVG ne revient pas à la ligne : coupe aux espaces, `max` caractères par ligne.
const wrap = (text: string, max: number): string[] =>
  text.split(' ').reduce<string[]>((lines, word) => {
    const last = lines[lines.length - 1]
    if (last !== undefined && last.length + 1 + word.length <= max) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
    return lines
  }, [])

const W = 320
const H = 392

const stat = (x: number, y: number, title: string, value: string, sub: string, font: string, color = 'value'): string =>
  `<text x="${x}" y="${y}" ${font} font-size="9" font-weight="700" letter-spacing="1.6" style="fill:${v('title')}">${title}</text>` +
  `<text x="${x}" y="${y + 23}" ${font} font-size="20" font-weight="800" style="fill:${v(color)}">${value}</text>` +
  `<text x="${x}" y="${y + 39}" ${font} font-size="10" style="fill:${v('muted')}">${sub}</text>`

const card = (view: View, theme: Theme): string => {
  const { f, l } = view
  const css = palette(theme, l)
  const font = `font-family="Segoe UI, system-ui, -apple-system, sans-serif"`
  const trackX = 20
  const trackW = W - 40
  const used = Math.max(0, Math.min(100, f?.used ?? 0))
  const projected = Math.max(used, Math.min(100, f?.projected ?? used))
  const usedW = Math.max(8, (trackW * used) / 100)
  const projW = (trackW * projected) / 100
  const overflow = (f?.projected ?? 0) > 100
  const limitBefore = f?.limitAt !== undefined && f.limitAt < f.resetsAt
  // Signal : 5 barres, d'autant plus allumées qu'il restera de la marge au reset.
  const left = f === undefined ? undefined : 100 - Math.min(100, f.projected ?? f.used)
  const lit = left === undefined ? 0 : Math.max(left <= 0 ? 0 : 1, Math.ceil((left / 100) * 5))
  const bars = Array.from({ length: 5 }, (_, i) => {
    const h = 4 + i * 2.5
    const isOn = i < lit
    return `<rect x="${W - 58 + i * 6}" y="${H - 16 - h}" width="3.5" height="${h}" rx="1" style="fill:${v(isOn ? 'accent' : 'off')}" opacity="${isOn ? 0.6 + i * 0.1 : 1}"/>`
  }).join('')
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6 + Math.PI / 12
    const r2 = i % 2 ? 21.5 : 23
    return `<line x1="${34 + Math.cos(a) * 19}" y1="${32 + Math.sin(a) * 19}" x2="${34 + Math.cos(a) * r2}" y2="${32 + Math.sin(a) * r2}"/>`
  }).join('')
  const big = f?.projected === undefined ? (f === undefined ? '—' : num(f.used)) : String(Math.round(f.projected))
  const bigCaption = f?.projected === undefined ? (f === undefined ? '' : 'utilisés') : 'prévus au reset'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${css}</style>
<defs>
  <linearGradient id="uf-bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" style="stop-color:${v('bg0')}"/><stop offset="0.4" style="stop-color:${v('bg1')}"/><stop offset="1" style="stop-color:${v('bg2')}"/>
  </linearGradient>
  <radialGradient id="uf-glow" cx="0.1" cy="0.1" r="0.4">
    <stop offset="0" style="stop-color:${v('accent')};stop-opacity:0.3"/><stop offset="1" style="stop-color:${v('accent')};stop-opacity:0"/>
  </radialGradient>
  <linearGradient id="uf-title" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" style="stop-color:${v('soft')}"/><stop offset="1" style="stop-color:${v('accent')}"/>
  </linearGradient>
  <linearGradient id="uf-track" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" style="stop-color:${v('track0')}"/><stop offset="1" style="stop-color:${v('track1')}"/>
  </linearGradient>
  <linearGradient id="uf-fill" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" style="stop-color:${v('soft')}"/><stop offset="1" style="stop-color:${v('accent')}"/>
  </linearGradient>
  <pattern id="uf-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" style="fill:${v('accent')}" opacity="0.18"/><line x1="0" y1="0" x2="0" y2="6" style="stroke:${v('accent')}" stroke-width="2.5" opacity="0.55"/>
  </pattern>
</defs>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="url(#uf-bg)" style="stroke:${v('accent')}" stroke-opacity="0.35"/>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="url(#uf-glow)"/>
<g style="stroke:${v('accent')}" stroke-width="1.8" stroke-linecap="round" opacity="0.85">${rays}</g>
<circle cx="34" cy="32" r="16" style="fill:${v('disc')};stroke:${v('accent')}" stroke-width="1.5"/>
<g transform="translate(0 4)">${glyph()}</g>
<text x="66" y="26" ${font} font-size="9.5" font-weight="700" letter-spacing="2" style="fill:${v('title')}">${view.stale ? 'DERNIÈRE MESURE' : 'PRÉVISION HEBDO'}</text>
<text x="65" y="47" ${font} font-size="19" font-weight="800" font-style="italic" fill="url(#uf-title)">${l.label}</text>

<text x="${trackX}" y="88" ${font} font-size="44" font-weight="800" style="fill:${v('value')}" dominant-baseline="hanging">${big}${f === undefined ? '' : '<tspan font-size="20" font-weight="600" dx="4">%</tspan>'}</text>
<text x="${trackX + 2}" y="142" ${font} font-size="10.5" style="fill:${v('muted')}">${bigCaption}</text>
<text x="${W - 20}" y="104" ${font} font-size="9" font-weight="700" letter-spacing="1.6" style="fill:${v('title')}" text-anchor="end">UTILISÉ</text>
<text x="${W - 20}" y="126" ${font} font-size="20" font-weight="800" style="fill:${v('accent')}" text-anchor="end">${f === undefined ? '—' : `${num(f.used)} %`}</text>
<text x="${W - 20}" y="142" ${font} font-size="10.5" font-weight="700" style="fill:${v('accent')}" text-anchor="end">${view.resetLine}</text>

<rect x="${trackX}" y="154" width="${trackW}" height="10" rx="5" fill="url(#uf-track)"/>
${f?.projected === undefined ? '' : `<rect x="${trackX}" y="154" width="${projW}" height="10" rx="5" fill="url(#uf-hatch)"/>`}
<rect x="${trackX}" y="154" width="${usedW}" height="10" rx="5" fill="url(#uf-fill)"/>
${overflow ? `<rect x="${trackX + trackW - 4}" y="151" width="4" height="16" rx="2" style="fill:${v('limit')}"/>` : ''}
<circle cx="${trackX + usedW}" cy="159" r="8" style="fill:${v('knob')};stroke:${v('knob')}" fill-opacity="0.35" stroke-opacity="0.5"/>
<text x="${trackX}" y="179" ${font} font-size="9.5" style="fill:${v('muted')}">0 %</text>
<text x="${trackX + trackW}" y="179" ${font} font-size="9.5" style="fill:${v('muted')}" text-anchor="end">limite 100 %</text>

<line x1="20" y1="192" x2="${W - 20}" y2="192" style="stroke:${v('rule')}"/>
${stat(20, 210, 'RYTHME', view.rate, view.rateSub, font)}
${stat(172, 210, 'RESET DANS', view.resetIn, view.resetSub, font)}
${stat(20, 266, 'MARGE', view.margin, view.marginSub, font)}
${stat(172, 266, 'LIMITE DANS', view.limitIn, view.limitSub, font, limitBefore ? 'limit' : 'value')}
<line x1="20" y1="320" x2="${W - 20}" y2="320" style="stroke:${v('rule')}"/>
<text x="20" y="338" ${font} font-size="11" font-weight="600" style="fill:${v('accent')}">${wrap(view.verdict, 46).map((line, i) => `<tspan x="20" dy="${i === 0 ? 0 : 14}">${line}</tspan>`).join('')}</text>
<text x="${W - 66}" y="${H - 14}" ${font} font-size="13" font-weight="800" font-style="italic" style="fill:${v('accent')}" text-anchor="end">${BRAND}</text>
${bars}
</svg>`
}

// Les limites sont celles du compte, pas de la session : la dernière mesure reste
// valable d'une session à l'autre, jusqu'à la réinitialisation de la semaine.
const LAST = 'lastWeek'

const remembered = async ($: EngineInterface, now: number): Promise<SessionRateLimit | undefined> => {
  const saved = (await $.store.get(LAST)) as SessionRateLimit | undefined
  if (saved?.resetsAt === undefined || Date.parse(saved.resetsAt) <= now) return undefined
  return saved
}

export const register: Register = (on, options) => {
  const theme = themeOf(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-forecast',
      description: 'Ouvrir le panneau de prévision de la limite des 7 jours',
    })
    // Sans demande, le panneau ne s'ouvre que là où la place le permet (à droite sur le desktop).
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'usage-forecast' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    return { text: opened.isPlaced ? 'Panneau Prévision hebdo ouvert.' : `Panneau non affiché : ${opened.reason}` }
  })

  // Chaque nouvelle mesure : après une réponse, et dès que la limite bouge d'un point.
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      const week = e.rateLimits.find(r => r.kind === 'seven_day')
      if (week !== undefined) await $.store.set(LAST, week)
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const now = await $.clock.now()
    const live = (await $.session.usage()).rateLimits.find(r => r.kind === 'seven_day')
    const week = live ?? (await remembered($, now))
    const view = viewOf(forecastOf(week, now), live === undefined && week !== undefined)
    const { f } = view
    const alt = f === undefined
      ? 'Prévision hebdo : pas encore de mesure.'
      : `Prévision hebdo : ${view.l.label}. ${num(f.used)} % utilisés, reset ${when(f.resetsAt)} dans ${view.resetIn}. ` +
        `Rythme ${view.rate}. ${view.verdict}`
    const table = $.ui.resolve(e)

    // Desktop, VS Code, mobile : la carte en SVG, à la largeur du panneau. La table du
    // terminal connaît aussi `Svg` mais ne le dessine pas : on teste la surface.
    if (e.surface !== 'terminal' && 'Svg' in table) {
      const { Svg } = table
      return <Svg source={card(view, theme)} alt={alt} />
    }

    // Terminal : quelques lignes de texte.
    const { Box, Text } = table
    return (
      <Box flexDirection="column">
        <Text>
          <Text weight="bold">Prévision hebdo</Text> : <Text color={view.l.color}>{view.l.label}</Text>
          {view.stale ? <Text dimColor> (dernière mesure)</Text> : null}
        </Text>
        <Text>
          Utilisé {f === undefined ? '—' : `${num(f.used)} %`}
          {f?.projected === undefined ? '' : ` → ${Math.round(f.projected)} % au reset`}
        </Text>
        <Text dimColor>{f === undefined ? '' : `Reset ${when(f.resetsAt)}, dans ${view.resetIn}`}</Text>
        <Text>Rythme {view.rate} · marge {view.margin}</Text>
        <Text color={view.l.color}>{view.verdict}</Text>
      </Box>
    )
  })
}
