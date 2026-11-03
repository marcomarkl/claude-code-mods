/** Ein Eintrag der ToDo-Liste, gelesen aus einer `TODO.md`. */
export type TodoItem = {
  /**
   * Beim Lesen gebildet aus Liste (`p`/`g`), Text und Vorkommen gleicher Texte;
   * stabil, solange der Text bleibt.
   */
  id: string
  /** Text, auch mehrzeilig, höchstens 500 Zeichen. */
  text: string
  /** Wahr, wenn abgehakt. */
  done: boolean
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
    'projekt-mappe': {
      paths: Shaped<Paths | null>
      lists: Shaped<Lists | null>
      tab: Shaped<Scope>
      draft: Shaped<Draft | null>
      isOpen: Shaped<boolean>
    }
  }
}
