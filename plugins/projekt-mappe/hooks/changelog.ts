// ---- Changelog ------------------------------------------------------------------
//
// Geschrieben wird nach Keep a Changelog 1.1.0 (keepachangelog.com): "## [Unreleased]" oben,
// Kategorien "### Added|Changed|…", Release als "## [1.2.0] - 2026-11-03", bei Projekten ohne
// Versionen "## [2026-11-03]". Bestehende Changelogs schreibt der Mod in ihrem Stil fort:
// datierte Aufzählungspunkte (ha-assistant, kc-homepage) oder Versionsabschnitte ohne
// Kategorien (plugin-cmd-skills, dann kommt ein [Unreleased] darüber). Einen unbekannten Stil
// zeigt er nur an. Reine Funktionen ohne $: die Dateizugriffe liegen in register.tsx.

import type { ChangelogEntry, ChangelogStyle } from '../types'

export const CATEGORIES = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'] as const

// Was die Kategorien heißen, zum Auswählen
export const CATEGORY_LABEL: Record<string, string> = {
  Added: 'Added · neu',
  Changed: 'Changed · geändert',
  Deprecated: 'Deprecated · veraltet',
  Removed: 'Removed · entfernt',
  Fixed: 'Fixed · behoben',
  Security: 'Security · Sicherheit',
}

export const changelogTemplate = () =>
  [
    '# Changelog',
    '',
    'Alle nennenswerten Änderungen an diesem Projekt stehen in dieser Datei.',
    '',
    'Das Format folgt [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), die Versionsnummern folgen',
    '[Semantic Versioning](https://semver.org/). Projekte ohne Versionen tragen das Datum als Version.',
    '',
    '## [Unreleased]',
    '',
  ].join('\n')

const UNRELEASED = /^##\s+\[unreleased\]/i
const VERSION = /^##\s+\[?v?\d+\.\d+/
const DATED = /^[-*]\s+(\*\*)?\d{4}-\d{2}-\d{2}/
const HEADING2 = /^##\s/
const HEADING3 = /^###\s+(.+?)\s*$/
const BULLET = /^[-*]\s+(.*)$/

type Doc = { lines: string[]; eol: string }

const split = (raw: string): Doc => ({ lines: raw.split(/\r\n|\n/), eol: raw.includes('\r\n') ? '\r\n' : '\n' })
const join = (doc: Doc) => doc.lines.join(doc.eol)

export function styleOf(raw: string): ChangelogStyle {
  const lines = split(raw).lines
  if (raw.trim() === '') return 'empty'
  if (lines.some(l => UNRELEASED.test(l))) return 'keep'
  if (lines.some(l => VERSION.test(l))) return 'versions'
  if (lines.some(l => DATED.test(l))) return 'dated'
  return 'unknown'
}

// [start, end) des Abschnitts [Unreleased], ohne die Überschrift
function unreleasedRange(lines: readonly string[]): { start: number; end: number } | undefined {
  const head = lines.findIndex(l => UNRELEASED.test(l))
  if (head < 0) return undefined
  let end = lines.findIndex((l, i) => i > head && HEADING2.test(l))
  if (end < 0) {
    // Linkverweise am Dateiende ("[Unreleased]: https://…") gehören nicht dazu
    end = lines.findIndex((l, i) => i > head && /^\[[^\]]+\]:\s/.test(l))
    if (end < 0) end = lines.length
  }
  return { start: head + 1, end }
}

type Located = ChangelogEntry & { start: number; end: number }

function entriesOf(lines: readonly string[]): Located[] {
  const range = unreleasedRange(lines)
  if (range === undefined) return []
  const out: Located[] = []
  let category = ''
  for (let i = range.start; i < range.end; i++) {
    const line = lines[i] ?? ''
    const cat = HEADING3.exec(line)
    if (cat !== null) {
      category = cat[1] ?? ''
      continue
    }
    const bullet = BULLET.exec(line)
    if (bullet !== null) {
      out.push({ category, text: bullet[1] ?? '', start: i, end: i + 1 })
      continue
    }
    // Eingerückte Folgezeile des letzten Eintrags
    const last = out[out.length - 1]
    if (last !== undefined && last.end === i && /^\s+\S/.test(line)) {
      last.text += `\n${line.trim()}`
      last.end = i + 1
    }
  }
  return out
}

export const unreleasedOf = (raw: string): ChangelogEntry[] =>
  entriesOf(split(raw).lines).map(({ category, text }) => ({ category, text }))

// Alles außer [Unreleased], zum Anzeigen
export function restOf(raw: string): string {
  const { lines } = split(raw)
  const range = unreleasedRange(lines)
  if (range === undefined) return raw.trim()
  return [...lines.slice(0, range.start - 1), ...lines.slice(range.end)].join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Leerzeilen am Ende eines Bereichs überspringen: die Einfügestelle liegt davor
const trimBack = (lines: readonly string[], from: number, to: number) => {
  let at = to
  while (at > from && (lines[at - 1] ?? '').trim() === '') at--
  return at
}

const bulletLines = (text: string) => {
  const [first, ...rest] = text.split('\n')
  return [`- ${first ?? ''}`, ...rest.map(l => (l === '' ? '' : `  ${l}`))]
}

function addKeep(doc: Doc, category: string, text: string): Doc {
  const lines = [...doc.lines]
  const range = unreleasedRange(lines)
  if (range === undefined) return doc
  // Die Kategorie suchen; ihr letzter Eintrag ist die Einfügestelle
  const heads: Array<{ name: string; at: number }> = []
  for (let i = range.start; i < range.end; i++) {
    const m = HEADING3.exec(lines[i] ?? '')
    if (m !== null) heads.push({ name: m[1] ?? '', at: i })
  }
  const own = heads.findIndex(h => h.name.toLowerCase() === category.toLowerCase())
  if (own >= 0) {
    const from = heads[own]?.at ?? range.start
    const to = heads[own + 1]?.at ?? range.end
    const at = trimBack(lines, from + 1, to)
    lines.splice(at, 0, ...bulletLines(text))
    return { ...doc, lines }
  }
  // Neue Kategorie in der Reihenfolge von Keep a Changelog
  const rank = (name: string) => {
    const r = CATEGORIES.findIndex(c => c.toLowerCase() === name.toLowerCase())
    return r < 0 ? CATEGORIES.length : r
  }
  const before = heads.find(h => rank(h.name) > rank(category))
  if (before !== undefined) {
    // Vor einer späteren Kategorie; deren Leerzeile davor bleibt die Trennung
    lines.splice(before.at, 0, `### ${category}`, '', ...bulletLines(text), '')
  } else {
    // Ans Ende von [Unreleased]: hinter den letzten Inhalt, mit genau einer Leerzeile davor;
    // folgt sofort eine Überschrift, auch eine danach
    const at = trimBack(lines, range.start, range.end)
    const needsGap = (lines[at] ?? '').trim() !== ''
    lines.splice(at, 0, '', `### ${category}`, '', ...bulletLines(text), ...(needsGap ? [''] : []))
  }
  return { ...doc, lines }
}

function addVersions(doc: Doc, category: string, text: string): Doc {
  const lines = [...doc.lines]
  const first = lines.findIndex(l => HEADING2.test(l))
  const at = first < 0 ? lines.length : first
  lines.splice(at, 0, '## [Unreleased]', '', `### ${category}`, '', ...bulletLines(text), '')
  return { ...doc, lines }
}

// Datierte Punkte: neuer Punkt vor den neuesten, im Muster der vorhandenen
function addDated(doc: Doc, text: string, date: string): Doc {
  const lines = [...doc.lines]
  const first = lines.findIndex(l => DATED.test(l))
  if (first < 0) return doc
  const sample = lines[first] ?? ''
  const [head, ...rest] = text.split('\n')
  const line = /^[-*]\s+\*\*\d{4}-\d{2}-\d{2}\s*\(/.test(sample)
    ? `- **${date} (${head ?? ''})**`
    : /^[-*]\s+\*\*\d{4}-\d{2}-\d{2}\*\*/.test(sample)
      ? `- **${date}** ${head ?? ''}`
      : `- ${date}: ${head ?? ''}`
  // Stehen die Punkte durch Leerzeilen getrennt, auch hier
  const next = lines.findIndex((l, i) => i > first && DATED.test(l))
  const isSpaced = next > 0 && (lines[next - 1] ?? '').trim() === ''
  lines.splice(first, 0, line, ...rest.map(l => `  ${l}`), ...(isSpaced ? [''] : []))
  return { ...doc, lines }
}

// Ein neuer Eintrag; undefined, wenn der Stil unbekannt ist (die Datei wird nur angezeigt)
export function addEntry(raw: string, category: string, text: string, date: string): string | undefined {
  const style = styleOf(raw)
  if (style === 'empty') return join(addKeep(split(changelogTemplate()), category, text))
  if (style === 'keep') return join(addKeep(split(raw), category, text))
  if (style === 'versions') return join(addVersions(split(raw), category, text))
  if (style === 'dated') return join(addDated(split(raw), text, date))
  return undefined
}

export function editEntry(raw: string, index: number, text: string): string | undefined {
  const doc = split(raw)
  const e = entriesOf(doc.lines)[index]
  if (e === undefined) return undefined
  const lines = [...doc.lines.slice(0, e.start), ...bulletLines(text), ...doc.lines.slice(e.end)]
  return join({ ...doc, lines })
}

// Löschen; eine danach leere Kategorie verschwindet mit ihrer Überschrift
export function removeEntry(raw: string, index: number): string | undefined {
  const doc = split(raw)
  const entries = entriesOf(doc.lines)
  const e = entries[index]
  if (e === undefined) return undefined
  const isLast = !entries.some((o, i) => i !== index && o.category === e.category)
  if (!isLast || e.category === '') return join({ ...doc, lines: [...doc.lines.slice(0, e.start), ...doc.lines.slice(e.end)] })
  // Letzter Eintrag seiner Kategorie: Überschrift und Eintrag samt den Leerzeilen dazwischen und
  // danach entfernen, die Leerzeile davor trennt weiter
  let head = e.start - 1
  while (head >= 0 && (doc.lines[head] ?? '').trim() === '') head--
  if (HEADING3.exec(doc.lines[head] ?? '')?.[1] !== e.category) {
    return join({ ...doc, lines: [...doc.lines.slice(0, e.start), ...doc.lines.slice(e.end)] })
  }
  let end = e.end
  while (end < doc.lines.length && (doc.lines[end] ?? '').trim() === '' && end + 1 < doc.lines.length) end++
  return join({ ...doc, lines: [...doc.lines.slice(0, head), ...doc.lines.slice(end)] })
}

// [Unreleased] wird zur Version (oder zum Datum), darüber ein neues, leeres [Unreleased]
export function release(raw: string, version: string, date: string): string | undefined {
  const doc = split(raw)
  const head = doc.lines.findIndex(l => UNRELEASED.test(l))
  if (head < 0 || entriesOf(doc.lines).length === 0) return undefined
  const v = version.trim().replace(/^\[|\]$/g, '')
  const title = v === '' ? `## [${date}]` : `## [${v}] - ${date}`
  const lines = [...doc.lines.slice(0, head), '## [Unreleased]', '', title, ...doc.lines.slice(head + 1)]
  return join({ ...doc, lines })
}
