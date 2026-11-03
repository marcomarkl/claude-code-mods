import { expect, test } from 'claude-code/testing'

import { addEntry, changelogTemplate, editEntry, release, removeEntry, restOf, styleOf, unreleasedOf } from '../hooks/changelog'

const DATE = '2026-11-03'

const KEEP = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '',
  '- Reiter Backlog',
  '',
  '## [0.4.0] - 2026-11-02',
  '',
  '### Changed',
  '',
  '- Listen als TODO.md',
  '',
].join('\n')

// Gekürzt aus ha-assistant/CHANGELOG.md
const HA = [
  '# Changelog — ha-assistant',
  '',
  'Archiv abgeschlossener todo-Punkte (datierter Log, neueste zuerst).',
  '',
  '- 2026-10-17: **Nacharbeiten der Updates erledigt.**',
  '- 2026-10-08: **EMS-Gateway-Garantiefall erledigt.**',
  '',
].join('\n')

// Gekürzt aus kc-homepage/CHANGELOG.md
const KC = [
  '# Änderungshistorie — kc-homepage',
  '',
  'Neuester Eintrag oben.',
  '',
  '- **2026-11-02 (robots.txt: Google-Extended)** — per Skript',
  '  - **Umsetzung** per `craft exec`',
  '',
  '- **2026-11-01 (Leere Alt-Texte)** — Nachmessung',
  '',
].join('\n')

// Gekürzt aus plugin-cmd-skills/CHANGELOG.md
const CMD = ['# Changelog', '', 'Versionen des `cmd`-Plugins.', '', '## 0.24.1', '', 'Nur Dokumentation.', ''].join('\n')

test('Stile erkennen', async () => {
  expect([styleOf(KEEP), styleOf(HA), styleOf(KC), styleOf(CMD), styleOf(''), styleOf('# Notizen\n\nText\n')]).toEqual([
    'keep',
    'dated',
    'dated',
    'versions',
    'empty',
    'unknown',
  ])
})

test('Keep a Changelog: Eintrag in eine vorhandene Kategorie, der Rest bleibt', async () => {
  expect(addEntry(KEEP, 'Added', 'Reiter Changelog', DATE)).toBe(KEEP.replace('- Reiter Backlog\n', '- Reiter Backlog\n- Reiter Changelog\n'))
})

test('Keep a Changelog: neue Kategorie in kanonischer Reihenfolge', async () => {
  const fixed = addEntry(KEEP, 'Fixed', 'Fokus nach dem Speichern', DATE) ?? ''
  expect(fixed).toBe(KEEP.replace('- Reiter Backlog\n\n## [0.4.0]', '- Reiter Backlog\n\n### Fixed\n\n- Fokus nach dem Speichern\n\n## [0.4.0]'))
  // Added vor Fixed: eine neue Kategorie davor
  const withChanged = addEntry(fixed, 'Changed', 'Name', DATE) ?? ''
  expect(unreleasedOf(withChanged).map(e => e.category)).toEqual(['Added', 'Changed', 'Fixed'])
  expect(withChanged).toContain('### Changed\n\n- Name\n\n### Fixed')
})

test('Keep a Changelog: ändern und löschen, eine leere Kategorie verschwindet', async () => {
  expect(editEntry(KEEP, 0, 'Reiter Backlog und Doku')).toBe(KEEP.replace('- Reiter Backlog', '- Reiter Backlog und Doku'))
  expect(removeEntry(KEEP, 0)).toBe(KEEP.replace('### Added\n\n- Reiter Backlog\n\n', ''))
})

test('Release: [Unreleased] wird Version oder Datum, ein neues leeres darüber', async () => {
  expect(release(KEEP, '0.5.0', DATE)).toBe(KEEP.replace('## [Unreleased]\n', '## [Unreleased]\n\n## [0.5.0] - 2026-11-03\n'))
  expect(release(KEEP, '', DATE)).toContain('## [Unreleased]\n\n## [2026-11-03]\n\n### Added')
  // Nichts unter [Unreleased]: kein Release
  expect(release(changelogTemplate(), '1.0.0', DATE)).toBeUndefined()
})

test('Datierte Punkte: neuer Punkt oben, im Muster der Datei', async () => {
  expect(addEntry(HA, 'Added', 'Thermostat getauscht', DATE)).toBe(
    HA.replace('- 2026-10-17:', '- 2026-11-03: Thermostat getauscht\n- 2026-10-17:'),
  )
  expect(addEntry(KC, 'Added', 'Changelog-Reiter', DATE)).toBe(
    KC.replace('- **2026-11-02', '- **2026-11-03 (Changelog-Reiter)**\n\n- **2026-11-02'),
  )
})

test('Versionen ohne Kategorien: [Unreleased] mit Kategorie kommt darüber', async () => {
  expect(addEntry(CMD, 'Fixed', 'Pipe in der Tabelle', DATE)).toBe(
    CMD.replace('## 0.24.1', '## [Unreleased]\n\n### Fixed\n\n- Pipe in der Tabelle\n\n## 0.24.1'),
  )
})

test('Leer: Vorlage nach Keep a Changelog mit dem ersten Eintrag; unbekannt: nichts', async () => {
  const made = addEntry('', 'Added', 'Erste Fassung', DATE) ?? ''
  expect(made.startsWith('# Changelog\n')).toBe(true)
  expect(made.endsWith('## [Unreleased]\n\n### Added\n\n- Erste Fassung\n')).toBe(true)
  expect(addEntry('# Notizen\n\nText\n', 'Added', 'x', DATE)).toBeUndefined()
})

test('Anzeige: alles außer [Unreleased]', async () => {
  expect(restOf(KEEP)).toBe('# Changelog\n\n## [0.4.0] - 2026-11-02\n\n### Changed\n\n- Listen als TODO.md')
})
