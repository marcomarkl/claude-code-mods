import { expect, test } from 'claude-code/testing'

import { configYaml, DEFAULT_CONFIG, newTask, nextNumber, parseConfig, setScalar, statusChange, taskOf } from '../hooks/backlog'

const NOW = { date: '2026-11-03', minute: '2026-11-03T09:15:00Z' }

// Gekürzt aus MrLesk/Backlog.md, backlog/tasks/back-798 - …md
const BACKLOG_MD = [
  '---',
  'id: BACK-798',
  'title: Correct most-progressed status resolution across active branches',
  'status: In Progress',
  'assignee:',
  "  - '@codex'",
  "created_date: '2026-10-28T23:46:00Z'",
  'labels: []',
  'dependencies: []',
  'priority: high',
  '---',
  '',
  '## Description',
  '',
  '<!-- SECTION:DESCRIPTION:BEGIN -->',
  'Text',
  '<!-- SECTION:DESCRIPTION:END -->',
  '',
].join('\n')

// Gekürzt aus aida-agent-plattform/backlog/tasks/006-aufbewahrungsfristen-setzen.md
const AIDA = [
  '---',
  'status: offen',
  'angelegt: 2026-08-24',
  'geaendert: 2026-08-31',
  '---',
  '',
  '# Zwei Zahlen setzen, die erst der Betrieb liefert',
  '',
  '**Am 27.08.2026 neu bewertet.**',
  '',
].join('\n')

const CONFIG = 'project_name: "Backlog.md"\ndefault_status: "To Do"\nstatuses: ["To Do", "In Progress", "Done"]\ntask_prefix: "back"\n'

test('Backlog.md: Aufgabe lesen, Status nach config.yml einordnen', async () => {
  const config = parseConfig(CONFIG)
  expect(config).toEqual({ statuses: ['To Do', 'In Progress', 'Done'], defaultStatus: 'To Do', prefix: 'back' })
  const task = taskOf('tasks/back-798 - Correct.md', BACKLOG_MD, config)
  expect([task.style, task.id, task.title, task.status, task.group, task.folder]).toEqual([
    'backlog.md',
    'BACK-798',
    'Correct most-progressed status resolution across active branches',
    'In Progress',
    'doing',
    'tasks',
  ])
})

test('Ordner-Form: Titel aus der Überschrift, deutscher Status, Archiv für gegenstandslos', async () => {
  const task = taskOf('tasks/006-aufbewahrungsfristen-setzen.md', AIDA, DEFAULT_CONFIG)
  expect([task.style, task.id, task.title, task.status, task.group]).toEqual([
    'ordner',
    '006-aufbewahrungsfristen-setzen',
    'Zwei Zahlen setzen, die erst der Betrieb liefert',
    'offen',
    'todo',
  ])
  const gone = taskOf('completed/001-x.md', AIDA.replace('status: offen', 'status: gegenstandslos'), DEFAULT_CONFIG)
  expect(gone.group).toBe('archived')
})

test('setScalar ändert nur die eine Zeile und behält die Quotierung', async () => {
  const changed = setScalar(BACKLOG_MD, 'status', 'Done')
  const before = BACKLOG_MD.split('\n')
  const after = changed.split('\n')
  expect(after.length).toBe(before.length)
  expect(after.filter((l, i) => l !== before[i])).toEqual(['status: Done'])
  // Gequotet bleibt gequotet
  expect(setScalar(BACKLOG_MD, 'created_date', '2026-11-03T09:15:00Z')).toContain("created_date: '2026-11-03T09:15:00Z'")
  // Fehlt der Schlüssel, kommt er vor das schließende ---
  expect(setScalar(AIDA, 'erledigt', '2026-11-03')).toBe(AIDA.replace('geaendert: 2026-08-31\n---', 'geaendert: 2026-08-31\nerledigt: 2026-11-03\n---'))
})

test('Ordner-Form erledigen: status und erledigt gesetzt, Datei zieht nach completed/', async () => {
  const task = taskOf('tasks/006-x.md', AIDA, DEFAULT_CONFIG)
  const changed = statusChange(task, AIDA, 'erledigt', DEFAULT_CONFIG, NOW)
  expect(changed.moveTo).toBe('completed')
  expect(changed.text).toBe(AIDA.replace('status: offen', 'status: erledigt').replace('geaendert: 2026-08-31\n---', 'geaendert: 2026-08-31\nerledigt: 2026-11-03\n---'))
  // Wieder öffnen aus completed/ zieht zurück nach tasks/
  const back = taskOf('completed/006-x.md', changed.text, DEFAULT_CONFIG)
  expect(statusChange(back, changed.text, 'offen', DEFAULT_CONFIG, NOW).moveTo).toBe('tasks')
})

test('Backlog.md Done: nur Status und updated_date, die Datei bleibt in tasks/', async () => {
  const config = parseConfig(CONFIG)
  const task = taskOf('tasks/back-798 - Correct.md', BACKLOG_MD, config)
  const changed = statusChange(task, BACKLOG_MD, 'Done', config, NOW)
  expect(changed.moveTo).toBeUndefined()
  expect(changed.text).toBe(BACKLOG_MD.replace('status: In Progress', 'status: Done').replace('priority: high\n---', "priority: high\nupdated_date: '2026-11-03T09:15:00Z'\n---"))
})

test('Neue Aufgabe im Format von Backlog.md, Nummer über alle Ordner', async () => {
  const config = DEFAULT_CONFIG
  const existing = [
    taskOf('tasks/task-2 - A.md', BACKLOG_MD.replace('BACK-798', 'TASK-2'), config),
    taskOf('archive/task-7 - B.md', BACKLOG_MD.replace('BACK-798', 'TASK-7'), config),
  ]
  expect(nextNumber(existing, 'backlog.md', 'task')).toBe(8)
  const made = newTask('backlog.md', existing, config, 'Release: bauen & prüfen', 'Mit Notiz', NOW)
  expect(made.file).toBe('tasks/task-8 - Release-bauen-&-prüfen.md')
  expect(made.text).toBe(
    [
      '---',
      'id: TASK-8',
      "title: 'Release: bauen & prüfen'",
      'status: To Do',
      'assignee: []',
      "created_date: '2026-11-03T09:15:00Z'",
      'labels: []',
      'dependencies: []',
      '---',
      '',
      '## Description',
      '',
      '<!-- SECTION:DESCRIPTION:BEGIN -->',
      'Mit Notiz',
      '<!-- SECTION:DESCRIPTION:END -->',
      '',
    ].join('\n'),
  )
})

test('Neue Aufgabe in der Ordner-Form folgt dem vorhandenen Namensmuster', async () => {
  const docker = [taskOf('tasks/task-012-aida-paket.md', AIDA, DEFAULT_CONFIG)]
  expect(newTask('ordner', docker, DEFAULT_CONFIG, 'Backup prüfen', '', NOW).file).toBe('tasks/task-013-backup-pruefen.md')
  const aida = [taskOf('completed/027-zwei.md', AIDA, DEFAULT_CONFIG)]
  const made = newTask('ordner', aida, DEFAULT_CONFIG, 'Größe messen', 'Erst im Betrieb.', NOW)
  expect(made.file).toBe('tasks/028-groesse-messen.md')
  expect(made.text).toBe('---\nstatus: offen\nangelegt: 2026-11-03\n---\n\n# Größe messen\n\nErst im Betrieb.\n')
  expect(newTask('ordner', aida, DEFAULT_CONFIG, 'Ohne', '', NOW).text.endsWith('# Ohne\n')).toBe(true)
})

test('config.yml beim Anlegen: Werte, die das CLI von Backlog.md liest', async () => {
  const yaml = configYaml('mein-projekt')
  expect(parseConfig(yaml)).toEqual(DEFAULT_CONFIG)
  expect(yaml).toContain('project_name: mein-projekt')
  expect(yaml).toContain('date_format: yyyy-mm-dd hh:mm')
})
