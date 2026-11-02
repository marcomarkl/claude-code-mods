/** Ein Eintrag der ToDo-Liste. */
export type TodoItem = {
  /** Feste Kennung, `crypto.randomUUID()`. */
  id: string
  /** Einzeiliger Text, höchstens 500 Zeichen. */
  text: string
  /** Wahr, wenn abgehakt. */
  done: boolean
  /** Angelegt, in Millisekunden seit der Epoche. */
  createdAt: number
  /** Abgehakt, in Millisekunden seit der Epoche; fehlt bei offenen. */
  doneAt?: number
}

/** Inhalt einer Listendatei (`global.json`, `.claude/todos.json`). */
export type TodoFile = {
  version: 1
  /** Offene zuerst, dann erledigte; jeweils in der Reihenfolge der Liste. */
  items: TodoItem[]
}

/** Welche Liste: über alle Projekte oder die des aktuellen Projekts. */
export type Scope = 'global' | 'project'

/** Eine gelesene Liste. */
export type ListState = {
  items: TodoItem[]
  /** Pfad der Datei, wenn sie da ist, aber nicht lesbar: dann ist die Liste gesperrt. */
  error?: string
}

/** Beide Listen, wie zuletzt gelesen (Zwischenspeicher für Schalter und Pane). */
export type Lists = {
  global: ListState
  project: ListState
}

/** Die Dateien der Sitzung. */
export type Paths = {
  /** `$.session.root()`, aus dem die Pfade ermittelt wurden. */
  root: string
  global: string
  project: string
  /** `.git/info/exclude` des Haupt-Checkouts; fehlt ohne Git-Repo. */
  exclude?: string
}

/** Was im Pane gerade bearbeitet wird: ein neuer Eintrag oder ein vorhandener. */
export type Draft = { kind: 'new'; scope: Scope } | { kind: 'edit'; scope: Scope; id: string }

/** Über Sitzungen gemerkt ($.store, Schlüssel `ui.v1`). */
export type UiState = {
  isOpen: boolean
  tab: Scope
}

declare module 'claude-code' {
  interface PluginState {
    'todo-liste': {
      paths: Shaped<Paths | null>
      lists: Shaped<Lists | null>
      tab: Shaped<Scope>
      draft: Shaped<Draft | null>
      isOpen: Shaped<boolean>
    }
  }
}
