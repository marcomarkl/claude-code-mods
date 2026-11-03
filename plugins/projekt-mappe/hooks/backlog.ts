// ---- Backlog --------------------------------------------------------------------
//
// Geschrieben wird im Format von Backlog.md (github.com/MrLesk/Backlog.md): backlog/tasks/ mit
// einer Datei je Aufgabe, "task-12 - Titel.md", Frontmatter id/title/status/…, Status aus
// backlog/config.yml. Mitgelesen und verwaltet wird Marcos Ordner-Form: "012-slug.md" oder
// "task-012-slug.md" mit Frontmatter status/angelegt, erledigt → backlog/completed/.
// Tolerant: geändert werden nur einzelne Frontmatter-Zeilen, der Körper nie. Ohne YAML-Parser,
// zeilenweise. Reine Funktionen ohne $: die Dateizugriffe liegen in register.tsx.

import type { Folder, Group, Style, Task } from '../types'

export const FOLDERS: readonly Folder[] = ['tasks', 'completed', 'archive', 'drafts']

export type Config = { statuses: string[]; defaultStatus: string; prefix: string }

export const DEFAULT_CONFIG: Config = { statuses: ['To Do', 'In Progress', 'Done'], defaultStatus: 'To Do', prefix: 'task' }

// Marcos deutsche Status und wohin sie in der Anzeige gehören
const ORDNER_GROUP: Record<string, Group> = { offen: 'todo', ruht: 'doing', erledigt: 'done', gegenstandslos: 'archived' }
export const ORDNER_STATUSES = ['offen', 'ruht', 'erledigt', 'gegenstandslos']

// ---- Frontmatter, zeilenweise ------------------------------------------------------

type Front = { lines: string[]; eol: string; close: number }

function front(raw: string): Front | undefined {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const lines = raw.split(/\r\n|\n/)
  if ((lines[0] ?? '').trim() !== '---') return undefined
  const close = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  return close < 0 ? undefined : { lines, eol, close }
}

const unquote = (v: string) => {
  const t = v.trim()
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'")
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\"/g, '"')
  return t
}

// Ein einfacher Wert (eine Zeile); undefined, wenn der Schlüssel fehlt
export function scalar(raw: string, key: string): string | undefined {
  const f = front(raw)
  if (f === undefined) return undefined
  for (let i = 1; i < f.close; i++) {
    const m = new RegExp(`^${key}:(.*)$`).exec(f.lines[i] ?? '')
    if (m !== null) return unquote(m[1] ?? '')
  }
  return undefined
}

// Ein Wert, wie YAML ihn ohne Überraschung liest; einfache Anführungszeichen, wenn nötig
export const yamlValue = (v: string) =>
  v === '' || /^[\s'"[\]{}>|*&!%@`#,?:-]|[:#]\s|\s$|^(true|false|null|yes|no|~)$/i.test(v) || /^[\d.]+$/.test(v)
    ? `'${v.replace(/'/g, "''")}'`
    : v

// Setzt einen einfachen Schlüssel: die vorhandene Zeile mit ihrer Quotierung, sonst eine neue
// Zeile vor dem schließenden ---. Alles andere bleibt Zeichen für Zeichen.
// quoteNew: eine neue Zeile in einfachen Anführungszeichen, wie Backlog.md seine Daten schreibt
export function setScalar(raw: string, key: string, value: string, quoteNew = false): string {
  const f = front(raw)
  if (f === undefined) return raw
  const lines = [...f.lines]
  for (let i = 1; i < f.close; i++) {
    const m = new RegExp(`^(${key}:\\s*)(.*)$`).exec(lines[i] ?? '')
    if (m === null) continue
    const old = (m[2] ?? '').trim()
    const quote = old.startsWith("'") ? "'" : old.startsWith('"') ? '"' : ''
    const body = quote === "'" ? value.replace(/'/g, "''") : quote === '"' ? value.replace(/"/g, '\\"') : value
    lines[i] = `${m[1] ?? `${key}: `}${quote === '' ? yamlValue(value) : `${quote}${body}${quote}`}`
    return lines.join(f.eol)
  }
  lines.splice(f.close, 0, `${key}: ${quoteNew ? `'${value.replace(/'/g, "''")}'` : yamlValue(value)}`)
  return lines.join(f.eol)
}

const bodyOf = (raw: string) => {
  const f = front(raw)
  return f === undefined ? raw : f.lines.slice(f.close + 1).join('\n')
}

// ---- config.yml ------------------------------------------------------------------

export function parseConfig(yaml: string | undefined): Config {
  if (yaml === undefined) return DEFAULT_CONFIG
  const line = (key: string) => new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(yaml)?.[1]?.trim()
  const list = line('statuses')
  const statuses =
    list !== undefined && list.startsWith('[')
      ? list
          .slice(1, list.lastIndexOf(']'))
          .split(',')
          .map(s => unquote(s))
          .filter(s => s !== '')
      : DEFAULT_CONFIG.statuses
  const def = line('default_status')
  const prefix = line('task_prefix')
  return {
    statuses: statuses.length > 0 ? statuses : DEFAULT_CONFIG.statuses,
    defaultStatus: def === undefined ? (statuses[0] ?? DEFAULT_CONFIG.defaultStatus) : unquote(def),
    prefix: prefix === undefined ? DEFAULT_CONFIG.prefix : unquote(prefix).toLowerCase(),
  }
}

export const configYaml = (projectName: string) =>
  [
    `project_name: ${yamlValue(projectName)}`,
    `default_status: "${DEFAULT_CONFIG.defaultStatus}"`,
    `statuses: [${DEFAULT_CONFIG.statuses.map(s => `"${s}"`).join(', ')}]`,
    `task_prefix: "${DEFAULT_CONFIG.prefix}"`,
    'date_format: yyyy-mm-dd hh:mm',
    '',
  ].join('\n')

// ---- Aufgaben lesen ----------------------------------------------------------------

const groupOf = (style: Style, status: string, folder: Folder, config: Config): Group => {
  if (folder === 'archive') return 'archived'
  if (style === 'ordner') return ORDNER_GROUP[status] ?? (folder === 'completed' ? 'done' : 'todo')
  const last = config.statuses[config.statuses.length - 1]
  if (status === last || folder === 'completed') return 'done'
  if (status === config.defaultStatus || status === config.statuses[0]) return 'todo'
  return 'doing'
}

export function taskOf(file: string, raw: string, config: Config): Task {
  const folder: Folder = FOLDERS.find(f => file.startsWith(`${f}/`)) ?? 'tasks'
  const name = file.slice(file.lastIndexOf('/') + 1).replace(/\.md$/, '')
  const id = scalar(raw, 'id')
  const style: Style = id === undefined ? 'ordner' : 'backlog.md'
  const status = scalar(raw, 'status') ?? (style === 'ordner' ? 'offen' : config.defaultStatus)
  const heading = /^#\s+(.+)$/m.exec(bodyOf(raw))?.[1]?.trim()
  const title = scalar(raw, 'title') ?? heading ?? name
  return {
    file,
    folder,
    style,
    id: id ?? name,
    title,
    status,
    group: groupOf(style, status, folder, config),
    body: bodyOf(raw).trim(),
  }
}

// Die Form des Projekts: Backlog.md, sobald eine Aufgabe eine id trägt oder es eine config.yml
// gibt; Marcos Ordner-Form, wenn nur Aufgaben ohne id da sind; sonst Backlog.md
export const styleOf = (tasks: readonly Task[], hasConfig: boolean): Style =>
  hasConfig || tasks.some(t => t.style === 'backlog.md') || tasks.length === 0 ? 'backlog.md' : 'ordner'

// ---- Neue Aufgaben -----------------------------------------------------------------

// Die nächste Nummer: das Maximum aller Nummern über alle Ordner, plus 1
export function nextNumber(tasks: readonly Task[], style: Style, prefix: string): number {
  let max = 0
  for (const t of tasks) {
    const m =
      style === 'backlog.md'
        ? new RegExp(`^${prefix}-(\\d+)$`, 'i').exec(t.id)
        : /^(?:task-)?(\d+)-/.exec(t.file.slice(t.file.lastIndexOf('/') + 1))
    if (m !== null) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

const asciiSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '') || 'aufgabe'

// Backlog.md schreibt den Titel mit Bindestrichen statt Leerzeichen in den Dateinamen
const backlogSlug = (title: string) =>
  title
    .replace(/[\\/:*?"<>|#]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'Task'

export type NewTask = { file: string; text: string }

export function newTask(
  style: Style,
  existing: readonly Task[],
  config: Config,
  title: string,
  description: string,
  now: { date: string; minute: string },
): NewTask {
  const n = nextNumber(existing, style, config.prefix)
  if (style === 'backlog.md') {
    const desc = description.trim()
    return {
      file: `tasks/${config.prefix}-${n} - ${backlogSlug(title)}.md`,
      text: [
        '---',
        `id: ${config.prefix.toUpperCase()}-${n}`,
        `title: ${yamlValue(title)}`,
        `status: ${yamlValue(config.defaultStatus)}`,
        'assignee: []',
        `created_date: '${now.minute}'`,
        'labels: []',
        'dependencies: []',
        '---',
        '',
        '## Description',
        '',
        '<!-- SECTION:DESCRIPTION:BEGIN -->',
        ...(desc === '' ? [] : [desc]),
        '<!-- SECTION:DESCRIPTION:END -->',
        '',
      ].join('\n'),
    }
  }
  // Ordner-Form: dem Namensmuster der vorhandenen Dateien folgen, Breite der Nummer wie dort
  const names = existing.map(t => t.file.slice(t.file.lastIndexOf('/') + 1))
  const hasTaskPrefix = names.some(n2 => /^task-\d+-/.test(n2))
  const width = Math.max(3, ...names.map(n2 => /^(?:task-)?(\d+)-/.exec(n2)?.[1]?.length ?? 0))
  const num = String(n).padStart(width, '0')
  const desc = description.trim()
  return {
    file: `tasks/${hasTaskPrefix ? 'task-' : ''}${num}-${asciiSlug(title)}.md`,
    text: ['---', 'status: offen', `angelegt: ${now.date}`, '---', '', `# ${title}`, '', ...(desc === '' ? [] : [desc, '']), ''].join(
      '\n',
    ),
  }
}

// ---- Status ändern ------------------------------------------------------------------

// Was eine Statusänderung schreibt und ob die Datei danach umzieht
export type StatusChange = { text: string; moveTo?: Folder }

export function statusChange(
  task: Task,
  raw: string,
  status: string,
  config: Config,
  now: { date: string; minute: string },
): StatusChange {
  if (task.style === 'ordner') {
    let text = setScalar(raw, 'status', status)
    // Datumsfelder wie in Marcos Projekten: erledigt (docker-nas, aida), beendet (aida), ruht_seit
    if (status === 'erledigt') text = setScalar(text, 'erledigt', now.date)
    if (status === 'gegenstandslos') text = setScalar(text, 'beendet', now.date)
    if (status === 'ruht') text = setScalar(text, 'ruht_seit', now.date)
    const moveTo: Folder | undefined =
      status === 'erledigt' || status === 'gegenstandslos' ? 'completed' : task.folder === 'completed' ? 'tasks' : undefined
    return moveTo === undefined || moveTo === task.folder ? { text } : { text, moveTo }
  }
  // Backlog.md: Done bleibt in tasks/, nur der Status ändert sich
  let text = setScalar(raw, 'status', status)
  text = setScalar(text, 'updated_date', now.minute, true)
  return { text }
}

// Der Status, der „erledigt“ bedeutet
export const doneStatus = (style: Style, config: Config) =>
  style === 'ordner' ? 'erledigt' : (config.statuses[config.statuses.length - 1] ?? 'Done')

export const statusesOf = (style: Style, config: Config) => (style === 'ordner' ? ORDNER_STATUSES : config.statuses)
