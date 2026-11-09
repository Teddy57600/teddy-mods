// Style « anneaux » des cartes : carte claire à anneaux de progression, logo en couches,
// pastille d'état, compte et barres de signal à droite.
// Fichier identique dans context-weather, usage-limits et usage-forecast : le modifier
// dans les trois mods à la fois.

export type Mode = 'sombre' | 'clair'
export type Theme = 'auto' | Mode
export type CardStyle = 'classique' | 'anneaux'

// Le réglage `style` du plugin.json : classique (par défaut) ou anneaux.
export const styleOf = (value: unknown): CardStyle => (value === 'anneaux' ? 'anneaux' : 'classique')

// Couleurs vives, les mêmes en sombre et en clair.
export const HUE = {
  gray: '#A3A8BD',
  green: '#22C08A',
  cyan: '#16C8DA',
  purple: '#A066F2',
  orange: '#F29B38',
  red: '#EF4444',
} as const

// Les couleurs fixes de la carte, dans chaque mode.
const SURFACE: Record<Mode, Record<string, string>> = {
  sombre: {
    bg: '#1C1E2B', border: '#34374B', stripe: '#232637', title: '#EEF0F8', text: '#D9DCE8', muted: '#9AA0B8',
    track: '#33364A', chip: '#2B2E42', ink: '#C9CDE0', avatar: '#3B3363', avatarInk: '#E6DCFF', rule: '#2E3144',
    layer1: '#B184F7', layer2: '#7D69C9', layer3: '#5A4E94',
  },
  clair: {
    bg: '#FFFFFF', border: '#DCDEE7', stripe: '#F6F7FA', title: '#1E2235', text: '#2A2E45', muted: '#8A8FA6',
    track: '#E9EAF0', chip: '#EEF0F5', ink: '#4A4F68', avatar: '#ECE3FB', avatarInk: '#3A2E6B', rule: '#ECEDF2',
    layer1: '#A066F2', layer2: '#C4B0F2', layer3: '#7F70B8',
  },
}

// Les couleurs passent par des variables CSS : en auto, la carte reste sombre et
// bascule sur le clair quand l'affichage demande un thème clair.
export const palette = (theme: Theme): string => {
  const block = (mode: Mode): string =>
    `svg{${Object.entries(SURFACE[mode]).map(([k, c]) => `--${k}:${c}`).join(';')}}`
  return theme === 'auto' ? `${block('sombre')}@media (prefers-color-scheme: light){${block('clair')}}` : block(theme)
}

export const v = (key: string): string => `var(--${key})`

export const FONT = `font-family="Segoe UI Variable Display, Segoe UI, system-ui, -apple-system, sans-serif"`

// Le fond : carte arrondie et trois larges bandes obliques très pâles.
export const frame = (W: number, H: number, id: string): string => {
  const slant = H * 0.32
  const bands = [0.22, 0.47, 0.74].map(at => {
    const x = W * at
    const w = W * 0.05
    return `<polygon points="${x},${H} ${x + w},${H} ${x + w + slant},0 ${x + slant},0"/>`
  }).join('')
  return `<clipPath id="${id}-clip"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16"/></clipPath>` +
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" style="fill:${v('bg')}"/>` +
    `<g clip-path="url(#${id}-clip)" style="fill:${v('stripe')}">${bands}</g>` +
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="none" style="stroke:${v('border')}" stroke-width="1.5"/>`
}

// Trois losanges empilés, le plus vif en haut.
export const logo = (cx: number, cy: number): string => {
  const diamond = (dy: number, color: string): string =>
    `<path d="M${cx} ${cy + dy - 11} L${cx + 20} ${cy + dy} L${cx} ${cy + dy + 11} L${cx - 20} ${cy + dy} Z" style="fill:${v(color)}"/>`
  return diamond(9, 'layer3') + diamond(0, 'layer2') + diamond(-9, 'layer1')
}

// Logo, trait vertical, titre en capitales et pastille d'état.
export const header = (x: number, cy: number, title: string, label: string, dot: string): string =>
  logo(x + 20, cy) +
  `<line x1="${x + 56}" y1="${cy - 26}" x2="${x + 56}" y2="${cy + 26}" style="stroke:${v('border')}" stroke-width="1.5"/>` +
  `<text x="${x + 74}" y="${cy - 4}" ${FONT} font-size="19" font-weight="700" letter-spacing="0.8" style="fill:${v('title')}">${title}</text>` +
  `<circle cx="${x + 81}" cy="${cy + 17}" r="6" fill="${dot}"/>` +
  `<text x="${x + 94}" y="${cy + 23}" ${FONT} font-size="15.5" font-weight="500" style="fill:${v('text')}">${label}</text>`

// Anneau de progression, rempli dans le sens des aiguilles depuis midi, valeur au centre.
export const ring = (cx: number, cy: number, r: number, percent: number | undefined, value: string, color: string, stroke = 8): string => {
  const p = Math.max(0, Math.min(100, percent ?? 0))
  const c = 2 * Math.PI * r
  const arc = p <= 0
    ? ''
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" ` +
      `stroke-dasharray="${((c * p) / 100).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`
  const size = value.length > 4 ? r * 0.5 : r * 0.58
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" style="stroke:${v('track')}" stroke-width="${stroke}"/>` + arc +
    `<text x="${cx}" y="${cy}" ${FONT} font-size="${size.toFixed(1)}" font-weight="700" style="fill:${v('title')}" ` +
    `text-anchor="middle" dominant-baseline="central">${value}</text>`
}

// Petite pastille ronde à côté de la troisième ligne : flèches de remise à zéro, ou jetons.
const chip = (cx: number, cy: number, kind: 'reset' | 'tokens', scale = 1): string => {
  const glyph = kind === 'reset'
    ? `<path d="M-5 -0.5 A5 5 0 0 1 4.2 -2.8"/><path d="M4.7 -5.6 L4.4 -2.5 L1.3 -2.9"/>` +
      `<path d="M5 0.5 A5 5 0 0 1 -4.2 2.8"/><path d="M-4.7 5.6 L-4.4 2.5 L-1.3 2.9"/>`
    : `<path d="M-5 -3 H5"/><path d="M-5 0 H5"/><path d="M-5 3 H1.5"/>`
  return `<circle cx="${cx}" cy="${cy}" r="${11 * scale}" style="fill:${v('chip')}"/>` +
    `<g transform="translate(${cx} ${cy}) scale(${scale})" fill="none" style="stroke:${v('ink')}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`
}

// Titre, sous-titre et troisième ligne précédée de sa pastille.
export const info = (x: number, cy: number, title: string, sub: string, line: string, kind: 'reset' | 'tokens' = 'reset'): string =>
  `<text x="${x}" y="${cy - 16}" ${FONT} font-size="19" font-weight="700" style="fill:${v('title')}">${title}</text>` +
  `<text x="${x}" y="${cy + 7}" ${FONT} font-size="14" style="fill:${v('muted')}">${sub}</text>` +
  chip(x + 11, cy + 28, kind) +
  `<text x="${x + 30}" y="${cy + 33}" ${FONT} font-size="14.5" font-weight="500" style="fill:${v('text')}">${line}</text>`

// À droite : avatar à l'initiale, nom, puis quatre barres de signal (`lit` allumées).
// `right` est le bord droit du bloc.
export const account = (right: number, cy: number, name: string, lit: number): string => {
  const bars = Array.from({ length: 4 }, (_, i) => {
    const h = 9 + i * 5
    const isOn = i < lit
    return `<rect x="${right - 25 + i * 7}" y="${cy + 11 - h}" width="4.5" height="${h}" rx="2" ` +
      (isOn ? `fill="${HUE.cyan}"/>` : `style="fill:${v('track')}"/>`)
  }).join('')
  const nameEnd = right - 36
  const avatarX = nameEnd - 8.6 * name.length - 30
  return `<circle cx="${avatarX}" cy="${cy}" r="20" style="fill:${v('avatar')}"/>` +
    `<text x="${avatarX}" y="${cy}" ${FONT} font-size="18" font-weight="700" style="fill:${v('avatarInk')}" text-anchor="middle" dominant-baseline="central">${name.charAt(0)}</text>` +
    `<text x="${nameEnd}" y="${cy + 6}" ${FONT} font-size="16.5" font-weight="700" style="fill:${v('title')}" text-anchor="end">${name}</text>` +
    bars
}

// Une valeur secondaire : titre discret, grand chiffre, précision.
export const stat = (x: number, y: number, title: string, value: string, sub: string, color?: string): string =>
  `<text x="${x}" y="${y}" ${FONT} font-size="11.5" font-weight="600" style="fill:${v('muted')}">${title}</text>` +
  `<text x="${x}" y="${y + 23}" ${FONT} font-size="18" font-weight="700" ${color ? `fill="${color}"` : `style="fill:${v('title')}"`}>${value}</text>` +
  `<text x="${x}" y="${y + 40}" ${FONT} font-size="11" style="fill:${v('muted')}">${sub}</text>`

// Version compacte pour les bandes au-dessus du prompt : 56 px de haut, comme le style classique.
export const BAND_H = 56

export const bandHeader = (x: number, cy: number, title: string, label: string, dot: string): string =>
  `<g transform="translate(${x + 16} ${cy}) scale(0.62) translate(${-x - 16} ${-cy})">${logo(x + 16, cy)}</g>` +
  `<line x1="${x + 40}" y1="${cy - 15}" x2="${x + 40}" y2="${cy + 15}" style="stroke:${v('border')}" stroke-width="1.3"/>` +
  `<text x="${x + 52}" y="${cy - 3}" ${FONT} font-size="13" font-weight="700" letter-spacing="0.8" style="fill:${v('title')}">${title}</text>` +
  `<circle cx="${x + 56}" cy="${cy + 9}" r="4" fill="${dot}"/>` +
  `<text x="${x + 65}" y="${cy + 13.5}" ${FONT} font-size="12.5" font-weight="500" style="fill:${v('text')}">${label}</text>`

export const bandRing = (cx: number, cy: number, percent: number | undefined, value: string, color: string): string =>
  ring(cx, cy, 19, percent, value, color, 4.5)

// Titre et sous-titre sur la première ligne, pastille et valeur sur la seconde.
export const bandInfo = (x: number, cy: number, title: string, sub: string, line: string, kind: 'reset' | 'tokens' = 'reset'): string =>
  `<text x="${x}" y="${cy - 4}" ${FONT} font-size="14" font-weight="700" style="fill:${v('title')}">${title}` +
  `<tspan font-size="12" font-weight="400" style="fill:${v('muted')}" dx="6">${sub}</tspan></text>` +
  chip(x + 8, cy + 10, kind, 0.72) +
  `<text x="${x + 21}" y="${cy + 14.5}" ${FONT} font-size="12.5" font-weight="500" style="fill:${v('text')}">${line}</text>`

export const bandAccount = (right: number, cy: number, name: string, lit: number): string => {
  const bars = Array.from({ length: 4 }, (_, i) => {
    const h = 6 + i * 4
    const isOn = i < lit
    return `<rect x="${right - 20 + i * 5.5}" y="${cy + 9 - h}" width="3.5" height="${h}" rx="1.5" ` +
      (isOn ? `fill="${HUE.cyan}"/>` : `style="fill:${v('track')}"/>`)
  }).join('')
  const nameEnd = right - 28
  const avatarX = nameEnd - 7.4 * name.length - 22
  return `<circle cx="${avatarX}" cy="${cy}" r="14" style="fill:${v('avatar')}"/>` +
    `<text x="${avatarX}" y="${cy}" ${FONT} font-size="13" font-weight="700" style="fill:${v('avatarInk')}" text-anchor="middle" dominant-baseline="central">${name.charAt(0)}</text>` +
    `<text x="${nameEnd}" y="${cy + 5}" ${FONT} font-size="14" font-weight="700" style="fill:${v('title')}" text-anchor="end">${name}</text>` +
    bars
}

export const rule = (x1: number, x2: number, y: number): string =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" style="stroke:${v('rule')}" stroke-width="1.2"/>`
