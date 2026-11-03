// ---- Doku und Vollständigkeit --------------------------------------------------------
//
// Welche Best-Practice-Dateien ein Projekt hat, welche fehlen, und die festen Gerüste zum
// Anlegen: CHANGELOG.md (Keep a Changelog), backlog/ (Backlog.md), docs/decisions/ mit einer
// ersten ADR nach Michael Nygard, LICENSE im SPDX-Wortlaut. README, CLAUDE.md und AGENTS.md
// bekommen keine Vorlage. Reine Funktionen ohne $: die Dateizugriffe liegen in register.tsx.

import type { DocFile, Missing } from '../types'

// Was im Projekt-Root als Datei oder Ordner liegt, und die Unterordner, auf die es ankommt
export type Present = {
  root: readonly string[]
  backlog: readonly string[]
  decisions: Readonly<Record<string, readonly string[]>>
  plans: readonly string[]
}

const has = (names: readonly string[], ...wanted: string[]) => names.some(n => wanted.includes(n))

export const DECISION_DIRS = ['docs/decisions', 'docs/adr', 'backlog/decisions'] as const

export function missingOf(present: Present): Missing[] {
  const out: Missing[] = []
  if (!has(present.root, 'CHANGELOG.md', 'changelog.md', 'CHANGES.md', 'HISTORY.md')) out.push('changelog')
  // Ein Backlog ist da, wenn backlog/ Aufgaben oder eine config.yml trägt, oder es eine BACKLOG.md gibt
  const hasBacklogDir = present.backlog.some(n => n === 'tasks' || n === 'completed' || n === 'config.yml')
  if (!hasBacklogDir && !has(present.root, 'BACKLOG.md', 'backlog.yml')) out.push('backlog')
  if (!has(present.root, 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'COPYING')) out.push('license')
  if (!DECISION_DIRS.some(d => (present.decisions[d]?.length ?? 0) > 0)) out.push('decisions')
  return out
}

// Die Dateien des Reiters Doku, in fester Reihenfolge
export function docFilesOf(present: Present): DocFile[] {
  const out: DocFile[] = []
  for (const name of ['README.md', 'CLAUDE.md', 'AGENTS.md']) {
    if (present.root.includes(name)) out.push({ path: name, label: name, group: 'Projekt' })
  }
  for (const dir of DECISION_DIRS) {
    for (const name of [...(present.decisions[dir] ?? [])].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }))) {
      if (name.endsWith('.md') && name.toLowerCase() !== 'readme.md' && name !== 'template.md') {
        out.push({ path: `${dir}/${name}`, label: name.replace(/\.md$/, ''), group: 'Entscheidungen' })
      }
    }
  }
  for (const path of [...present.plans].sort((a, b) => b.localeCompare(a, 'de', { numeric: true }))) {
    out.push({ path: `plans/${path}`, label: path.replace(/\.md$/, ''), group: 'Pläne' })
  }
  return out
}

export const decisionFirst = (date: string) =>
  [
    '# 1. Entscheidungen festhalten',
    '',
    `Datum: ${date}`,
    '',
    '## Status',
    '',
    'Angenommen',
    '',
    '## Kontext',
    '',
    'Entscheidungen zur Architektur und zum Vorgehen sollen mit ihrer Begründung nachvollziehbar bleiben,',
    'auch wenn die Beteiligten wechseln oder der Gesprächsverlauf, in dem sie fielen, nicht mehr da ist.',
    '',
    '## Entscheidung',
    '',
    'Wir halten Entscheidungen als Architecture Decision Records nach Michael Nygard fest: eine Datei je',
    'Entscheidung unter `docs/decisions/`, fortlaufend nummeriert, mit Status, Kontext, Entscheidung und Folgen.',
    'Die Vorlage ist `template.md`.',
    '',
    '## Folgen',
    '',
    'Jede Entscheidung hat einen festen Ort. Wird eine Entscheidung abgelöst, bleibt ihre Datei stehen und',
    'bekommt den Status „Ersetzt durch“ mit Verweis auf die neue.',
    '',
  ].join('\n')

export const decisionTemplate = () =>
  [
    '# N. Titel der Entscheidung',
    '',
    'Datum: JJJJ-MM-TT',
    '',
    '## Status',
    '',
    'Vorgeschlagen | Angenommen | Abgelehnt | Ersetzt durch [N](NNNN-titel.md)',
    '',
    '## Kontext',
    '',
    'Was die Entscheidung nötig macht: die Lage, die Kräfte, die Einschränkungen.',
    '',
    '## Entscheidung',
    '',
    'Was wir tun, im Aktiv: „Wir …“.',
    '',
    '## Folgen',
    '',
    'Was dadurch leichter und was schwerer wird, auch die Nachteile.',
    '',
  ].join('\n')

export const LICENSES = [
  { id: 'MIT', label: 'MIT' },
  { id: 'Apache-2.0', label: 'Apache-2.0' },
  { id: 'proprietary', label: 'Alle Rechte vorbehalten' },
] as const

// Der Lizenztext für LICENSE: MIT mit Jahr und Name eingesetzt, Apache-2.0 unverändert
// (der Hinweis zum Anwenden steht im Anhang des Wortlauts selbst)
export function licenseText(id: string, spdx: string | undefined, year: string, name: string): string | undefined {
  const holder = name.trim() === '' ? 'Die Urheber' : name.trim()
  if (id === 'proprietary') return `Copyright (c) ${year} ${holder}. Alle Rechte vorbehalten.\n`
  if (spdx === undefined) return undefined
  if (id === 'MIT') return spdx.replace('<year> <copyright holders>', `${year} ${holder}`)
  return spdx
}
