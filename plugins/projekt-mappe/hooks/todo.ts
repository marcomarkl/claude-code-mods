// ---- TODO.md -------------------------------------------------------------------
//
// Format nach todo-md: Kopf "# TODO", darunter eine Liste "- [ ] Text" / "- [x] Text".
// Folgezeilen mehrzeiliger Einträge stehen zwei Leerzeichen eingerückt. Keine IDs, keine Daten.
// Reine Funktionen ohne $: die Dateizugriffe liegen in register.tsx.

import type { Scope, TodoItem } from '../types'

export const HEADER = '# TODO'
const MAX_TEXT = 500

export type Entry = { text: string; done: boolean }

const TASK = /^[-*+] \[( |x|X)\] (.*)$/

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

// Die Einträge der Datei; undefined, wenn eine Zeile nicht zum Format gehört (fremde Datei)
export function parseTodoMd(raw: string): Entry[] | undefined {
  const lines = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')
  const entries: Array<{ lines: string[]; done: boolean }> = []
  let current: { lines: string[]; done: boolean } | undefined
  let isStart = true
  for (const line of lines) {
    if (line.trim() === '') {
      current?.lines.push('')
      continue
    }
    if (isStart && line.trimEnd() === HEADER) {
      isStart = false
      continue
    }
    isStart = false
    const task = TASK.exec(line)
    if (task !== null) {
      current = { lines: [task[2] ?? ''], done: task[1] !== ' ' }
      entries.push(current)
    } else if (current !== undefined && line.startsWith('  ')) {
      current.lines.push(line.slice(2))
    } else {
      return undefined
    }
  }
  return entries
    .map(e => ({ text: cleanText(e.lines.join('\n')), done: e.done }))
    .filter(e => e.text !== '')
}

export function formatTodoMd(entries: readonly Entry[]): string {
  if (entries.length === 0) return `${HEADER}\n`
  const lines = entries.map(e => {
    const [first, ...rest] = e.text.split('\n')
    return [`- [${e.done ? 'x' : ' '}] ${first ?? ''}`, ...rest.map(l => (l === '' ? '' : `  ${l}`))].join('\n')
  })
  return `${HEADER}\n\n${lines.join('\n')}\n`
}

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
export const withIds = (entries: readonly Entry[], scope: Scope): TodoItem[] => {
  const seen = new Map<string, number>()
  return entries.map(e => {
    const n = seen.get(e.text) ?? 0
    seen.set(e.text, n + 1)
    return { id: `${scope === 'global' ? 'g' : 'p'}${hash(e.text)}-${n}`, text: e.text, done: e.done }
  })
}
