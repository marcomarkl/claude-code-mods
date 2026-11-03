// ---- TODO.md -------------------------------------------------------------------
//
// Tolerant nach todo-md: Eine Einheit ist eine Checkbox-Zeile "- [ ] Text" samt ihren
// eingerückten Folgezeilen. Alles andere (Kopf, Einleitung, Abschnitte, Fließtext, Codeblöcke)
// ist Fremdinhalt und bleibt Zeichen für Zeichen stehen. Jede Änderung ersetzt nur die Zeilen
// ihrer Einheit. Reine Funktionen ohne $: die Dateizugriffe liegen in register.tsx.

import type { Scope, TodoItem } from '../types'

export const HEADER = '# TODO'
const MAX_TEXT = 500

// Einrückung, Aufzählungszeichen, Zustand (" ", "x", "X", "-" für abgelehnt), Text
const TASK = /^([ \t]*)([-*+]) \[( |x|X|-)\](?: (.*))?$/
const FENCE = /^[ \t]*(```|~~~)/

// Mehrzeilig erlaubt: Zeilenenden ohne Leerraum, höchstens eine Leerzeile am Stück,
// ohne Ränder, höchstens 500 Zeichen
export const cleanText = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT)
    .trim()

export type Unit = {
  // Zeilen [start, end) der Einheit
  start: number
  end: number
  indent: string
  marker: string
  state: ' ' | 'x' | 'X' | '-'
  text: string
}

export type TodoDoc = {
  lines: string[]
  units: Unit[]
  eol: '\n' | '\r\n'
  bom: boolean
}

const indentOf = (line: string) => /^[ \t]*/.exec(line)?.[0] ?? ''

export function parseDoc(raw: string): TodoDoc {
  const bom = raw.startsWith('﻿')
  const body = bom ? raw.slice(1) : raw
  const eol = body.includes('\r\n') ? '\r\n' : '\n'
  const lines = body.split(/\r\n|\n/)
  const units: Unit[] = []
  let current: Unit | undefined
  // Leerzeilen nach einer Einheit gehören nur dazu, wenn danach noch eine Folgezeile kommt
  let pendingBlank = 0
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (FENCE.test(line)) {
      inFence = !inFence
      current = undefined
      continue
    }
    if (inFence) continue
    if (line.trim() === '') {
      if (current !== undefined) pendingBlank++
      continue
    }
    const task = TASK.exec(line)
    if (task !== null) {
      current = {
        start: i,
        end: i + 1,
        indent: task[1] ?? '',
        marker: task[2] ?? '-',
        state: (task[3] ?? ' ') as Unit['state'],
        text: task[4] ?? '',
      }
      units.push(current)
      pendingBlank = 0
      continue
    }
    // Folgezeile: tiefer eingerückt als die Checkbox, ohne eigene Checkbox
    if (current !== undefined && indentOf(line).length > current.indent.length) {
      const cut = Math.min(indentOf(line).length, current.indent.length + 2)
      current.text += `${'\n'.repeat(pendingBlank)}\n${line.slice(cut)}`
      current.end = i + 1
      pendingBlank = 0
      continue
    }
    current = undefined
    pendingBlank = 0
  }
  return { lines, units, eol, bom }
}

export const serialize = (doc: TodoDoc) => `${doc.bom ? '﻿' : ''}${doc.lines.join(doc.eol)}`

// FNV-1a, 32 Bit: kurz, deterministisch, ohne Abhängigkeit
const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

// Die id hängt an Liste, Text und Vorkommen gleicher Texte: stabil, solange der Text bleibt
export function itemsOf(doc: TodoDoc, scope: Scope): TodoItem[] {
  const seen = new Map<string, number>()
  return doc.units.map(u => {
    const text = cleanText(u.text)
    const n = seen.get(text) ?? 0
    seen.set(text, n + 1)
    return {
      id: `${scope === 'global' ? 'g' : 'p'}${hash(text)}-${n}`,
      text,
      done: u.state === 'x' || u.state === 'X',
      ...(u.state === '-' ? { declined: true } : {}),
      depth: u.indent.length === 0 ? 0 : 1,
    }
  })
}

// Was nicht zu einer Einheit gehört, zum Anzeigen; leer, wenn es nur der Kopf ist
export function foreignOf(doc: TodoDoc): string {
  const inUnit = new Set<number>()
  for (const u of doc.units) for (let i = u.start; i < u.end; i++) inUnit.add(i)
  const text = doc.lines
    .filter((_, i) => !inUnit.has(i))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text === '' || text === HEADER ? '' : text
}

const unitLines = (u: Pick<Unit, 'indent' | 'marker' | 'state'>, text: string) => {
  const [first, ...rest] = text.split('\n')
  return [
    `${u.indent}${u.marker} [${u.state}] ${first ?? ''}`,
    ...rest.map(l => (l === '' ? '' : `${u.indent}  ${l}`)),
  ]
}

const replaced = (doc: TodoDoc, u: Unit, lines: string[]): TodoDoc =>
  parseDoc(serialize({ ...doc, lines: [...doc.lines.slice(0, u.start), ...lines, ...doc.lines.slice(u.end)] }))

// Abhaken und wieder öffnen tauscht nur das Zeichen in [ ]; die Zeile bleibt an ihrem Platz
export function toggleUnit(doc: TodoDoc, at: number): TodoDoc {
  const u = doc.units[at]
  if (u === undefined) return doc
  const isDone = u.state === 'x' || u.state === 'X'
  const line = doc.lines[u.start] ?? ''
  const next = line.replace(/\[( |x|X|-)\]/, `[${isDone ? ' ' : 'x'}]`)
  return replaced(doc, { ...u, end: u.start + 1 }, [next])
}

export function editUnit(doc: TodoDoc, at: number, text: string): TodoDoc {
  const u = doc.units[at]
  return u === undefined ? doc : replaced(doc, u, unitLines(u, text))
}

export function removeUnit(doc: TodoDoc, at: number): TodoDoc {
  const u = doc.units[at]
  return u === undefined ? doc : replaced(doc, u, [])
}

// Neu direkt hinter die letzte Einheit, oben in der Liste; ohne Einheit ans Ende, eine leere
// Datei bekommt den Kopf
export function addUnit(doc: TodoDoc, text: string): TodoDoc {
  const last = doc.units[doc.units.length - 1]
  const marker = doc.units.find(u => u.indent === '')?.marker ?? '-'
  const lines = unitLines({ indent: '', marker, state: ' ' }, text)
  if (last !== undefined) {
    return parseDoc(serialize({ ...doc, lines: [...doc.lines.slice(0, last.end), ...lines, ...doc.lines.slice(last.end)] }))
  }
  const hasContent = doc.lines.some(l => l.trim() !== '')
  if (!hasContent) return parseDoc(serialize({ ...doc, lines: [HEADER, '', ...lines, ''] }))
  const body = [...doc.lines]
  while (body.length > 0 && (body[body.length - 1] ?? '').trim() === '') body.pop()
  return parseDoc(serialize({ ...doc, lines: [...body, '', ...lines, ''] }))
}

// Zwei Einheiten sind tauschbar, wenn sie offen sind, gleich tief stehen und kein
// Fremdinhalt zwischen ihnen liegt
export function canMove(doc: TodoDoc, at: number, by: -1 | 1): boolean {
  const a = doc.units[at]
  const b = doc.units[at + by]
  if (a === undefined || b === undefined) return false
  const isOpen = (u: Unit) => u.state === ' '
  const [first, second] = by === 1 ? [a, b] : [b, a]
  return isOpen(a) && isOpen(b) && a.indent === b.indent && first.end === second.start
}

export function moveUnit(doc: TodoDoc, at: number, by: -1 | 1): TodoDoc {
  if (!canMove(doc, at, by)) return doc
  const a = doc.units[at]
  const b = doc.units[at + by]
  if (a === undefined || b === undefined) return doc
  const [first, second] = by === 1 ? [a, b] : [b, a]
  const lines = [
    ...doc.lines.slice(0, first.start),
    ...doc.lines.slice(second.start, second.end),
    ...doc.lines.slice(first.start, first.end),
    ...doc.lines.slice(second.end),
  ]
  return parseDoc(serialize({ ...doc, lines }))
}

// Alle erledigten Einheiten entfernen, von hinten, damit die Zeilennummern stimmen
export function clearDoneUnits(doc: TodoDoc): TodoDoc {
  let next = doc
  for (let i = doc.units.length - 1; i >= 0; i--) {
    const u = next.units[i]
    if (u !== undefined && (u.state === 'x' || u.state === 'X')) next = removeUnit(next, i)
  }
  return next
}
