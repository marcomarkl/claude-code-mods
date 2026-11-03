import { expect, test } from 'claude-code/testing'

import { decisionFirst, licenseText, missingOf } from '../hooks/scaffold'

const MIT_HEAD = 'MIT License\n\nCopyright (c) <year> <copyright holders>\n\nPermission is hereby granted'

test('Vollständigkeit: was fehlt, zählt auch die gleichwertigen Formen', async () => {
  const none = { root: [], backlog: [], decisions: {}, plans: [] }
  expect(missingOf(none)).toEqual(['changelog', 'backlog', 'license', 'decisions'])
  expect(
    missingOf({ root: ['HISTORY.md', 'BACKLOG.md', 'LICENCE'], backlog: [], decisions: { 'backlog/decisions': ['decision-1 - X.md'] }, plans: [] }),
  ).toEqual([])
  // Ein leerer backlog/-Ordner ist noch kein Backlog
  expect(missingOf({ ...none, root: ['backlog'], backlog: ['assets'] })).toContain('backlog')
})

test('Lizenz: MIT mit Jahr und Name, Apache unverändert, ohne Name ein Platzhalter', async () => {
  expect(licenseText('MIT', MIT_HEAD, '2026', 'Marco Markl')).toBe(MIT_HEAD.replace('<year> <copyright holders>', '2026 Marco Markl'))
  expect(licenseText('Apache-2.0', 'Apache License\n', '2026', 'X')).toBe('Apache License\n')
  expect(licenseText('MIT', MIT_HEAD, '2026', ' ')).toContain('Copyright (c) 2026 Die Urheber')
  expect(licenseText('MIT', undefined, '2026', 'X')).toBeUndefined()
})

test('Erste ADR nach Nygard: Titel, Datum, Status, Kontext, Entscheidung, Folgen', async () => {
  const adr = decisionFirst('2026-11-03')
  expect(adr.split('\n').filter(l => l.startsWith('#'))).toEqual(['# 1. Entscheidungen festhalten', '## Status', '## Kontext', '## Entscheidung', '## Folgen'])
  expect(adr).toContain('Datum: 2026-11-03')
})
