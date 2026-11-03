import { expect, test } from 'claude-code/testing'

import { addUnit, editUnit, itemsOf, moveUnit, parseDoc, removeUnit, serialize, toggleUnit } from '../hooks/todo'

// Gekürzt aus kc-social-media-assistant/TODO.md und ha-assistant/todo.md
const SOCIAL = '# TODO\n\nOffene Punkte des Projekts.\n\n- [x] **Conversions API prüfen**\n- [ ] **Laura prüfen**\n  mit Notiz\n- [ ] **Veranstaltung prüfen**\n'
const HA = '# TODO — ha-assistant\n\nStand: 2026-09-19.\n\n## Claude Offen\n- **Hydraulischer Abgleich**\n'

test('Rundlauf ohne Änderung ist zeichengleich, auch mit BOM und CRLF', async () => {
  for (const raw of [SOCIAL, HA, '', '# TODO\n', '﻿# TODO\r\n\r\n* [X] Groß\r\n+ [ ] Plus\r\n']) {
    expect(serialize(parseDoc(raw))).toBe(raw)
  }
})

test('Kernregel: eine Änderung lässt außerhalb der Einheit jedes Byte stehen', async () => {
  const doc = parseDoc(SOCIAL)
  expect(serialize(toggleUnit(doc, 1))).toBe(SOCIAL.replace('- [ ] **Laura', '- [x] **Laura'))
  expect(serialize(editUnit(doc, 1, 'Laura erledigt\nneue Notiz'))).toBe(SOCIAL.replace('**Laura prüfen**\n  mit Notiz', 'Laura erledigt\n  neue Notiz'))
  expect(serialize(removeUnit(doc, 1))).toBe(SOCIAL.replace('- [ ] **Laura prüfen**\n  mit Notiz\n', ''))
  expect(serialize(moveUnit(doc, 2, -1))).toBe(SOCIAL.replace('- [ ] **Laura prüfen**\n  mit Notiz\n- [ ] **Veranstaltung prüfen**\n', '- [ ] **Veranstaltung prüfen**\n- [ ] **Laura prüfen**\n  mit Notiz\n'))
  // Ohne Einheit: ans Ende, mit einer Leerzeile Abstand
  expect(serialize(addUnit(parseDoc(HA), 'neu'))).toBe(`${HA}\n- [ ] neu\n`)
})

test('Checkboxen im Codeblock sind kein Eintrag', async () => {
  const doc = parseDoc('# TODO\n\n- [ ] echt\n\n```\n- [ ] Beispiel\n```\n')
  expect(itemsOf(doc, 'project').map(i => i.text)).toEqual(['echt'])
})

test('Eingerückte Checkbox ist eine eigene Unteraufgabe, keine Folgezeile', async () => {
  const doc = parseDoc('- [ ] Eltern\n  mit Notiz\n  - [ ] Kind\n- [ ] Nächster\n')
  expect(itemsOf(doc, 'project').map(i => [i.text, i.depth])).toEqual([
    ['Eltern\nmit Notiz', 0],
    ['Kind', 1],
    ['Nächster', 0],
  ])
})
