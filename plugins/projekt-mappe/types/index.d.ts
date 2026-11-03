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
  /** todo-md `[-]`: abgelehnt; zählt nicht als offen. */
  declined?: true
  /** 0 oben in der Liste, 1 eingerückt (Unteraufgabe). */
  depth: number
  /** Mit dem Nachbarn darüber bzw. darunter tauschbar (offen, gleich tief, kein Fremdinhalt dazwischen). */
  canUp?: true
  canDown?: true
}

/** Welche Liste: über alle Projekte oder die des aktuellen Projekts. */
export type Scope = 'global' | 'project'

/** Eine gelesene Liste. */
export type ListState = {
  items: TodoItem[]
  /** Was in der Datei nicht zu einem Eintrag gehört (Einleitung, Abschnitte), zum Anzeigen. */
  foreign?: string
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
export type Draft =
  | { kind: 'new'; scope: Scope }
  | { kind: 'edit'; scope: Scope; id: string }
  /** Neue Backlog-Aufgabe */
  | { kind: 'task' }
  /** Neuer Changelog-Eintrag, einen vorhandenen ändern, Release */
  | { kind: 'entry' }
  | { kind: 'entry-edit'; index: number }
  | { kind: 'release' }
  /** Lizenz wählen */
  | { kind: 'license' }

/** Reiter im Projekt. Global gibt es nur die ToDo-Liste. */
export type Section = 'todo' | 'backlog' | 'changelog' | 'doku'

/** Ordner unter backlog/. */
export type Folder = 'tasks' | 'completed' | 'archive' | 'drafts'
/** Backlog.md (github.com/MrLesk/Backlog.md) oder Marcos Ordner-Form (status/angelegt, deutsch). */
export type Style = 'backlog.md' | 'ordner'
/** Wohin eine Aufgabe in der Anzeige gehört, unabhängig vom Wortlaut ihres Status. */
export type Group = 'todo' | 'doing' | 'done' | 'archived'

/** Eine Backlog-Aufgabe, gelesen aus ihrer Datei. */
export type Task = {
  /** Pfad relativ zu backlog/, etwa `tasks/task-3 - Titel.md`. */
  file: string
  folder: Folder
  style: Style
  /** Backlog.md: `TASK-3`; Ordner-Form: der Dateiname ohne `.md`. */
  id: string
  title: string
  status: string
  group: Group
  /** Der Körper ohne Frontmatter, zum Anzeigen. */
  body: string
}

/**
 * keep: Keep a Changelog mit [Unreleased]; versions: Versionsabschnitte ohne [Unreleased];
 * dated: datierte Aufzählungspunkte; unknown: nur anzeigen; empty: leer oder fehlt.
 */
export type ChangelogStyle = 'keep' | 'versions' | 'dated' | 'unknown' | 'empty'

/** Ein Eintrag unter [Unreleased]. */
export type ChangelogEntry = { category: string; text: string }

/** Der Changelog des Projekts, wie zuletzt gelesen. */
export type ChangelogState = {
  /** Gefundene Datei; fehlt, wenn es keinen Changelog gibt. */
  file?: string
  /** CHANGES.md und HISTORY.md werden nur angezeigt. */
  isWritable: boolean
  style: ChangelogStyle
  unreleased: ChangelogEntry[]
  /** Alles außer [Unreleased], zum Anzeigen. */
  rest: string
  /** Vorschlag für Release, aus plugin.json bzw. package.json. */
  version?: string
}

/** Eine Datei im Reiter Doku. */
export type DocFile = {
  /** Pfad relativ zum Projekt-Root. */
  path: string
  label: string
  group: 'Projekt' | 'Entscheidungen' | 'Pläne'
}

/** Eine fehlende Best-Practice-Datei mit festem Gerüst. */
export type Missing = 'changelog' | 'backlog' | 'license' | 'decisions'

/** Der Reiter Doku, wie zuletzt gelesen. */
export type DocsState = {
  files: DocFile[]
  missing: Missing[]
  hasClaudeMd: boolean
}

/** Die geöffnete Doku-Datei. */
export type OpenDoc = { path: string; text: string }

/** Das Backlog des Projekts, wie zuletzt gelesen. */
export type BacklogState = {
  style: Style
  /** Die Status, die man setzen kann, in ihrer Reihenfolge. */
  statuses: string[]
  tasks: Task[]
  /** Eine einzelne BACKLOG.md ohne backlog/-Ordner: nur zum Anzeigen. */
  single?: string
}

/** Über Sitzungen gemerkt ($.store, Schlüssel `ui.v1`). */
export type UiState = {
  isOpen: boolean
  tab: Scope
  section?: Section
}

declare module 'claude-code' {
  interface PluginState {
    'projekt-mappe': {
      paths: Shaped<Paths | null>
      lists: Shaped<Lists | null>
      tab: Shaped<Scope>
      draft: Shaped<Draft | null>
      isOpen: Shaped<boolean>
      section: Shaped<Section>
      backlog: Shaped<BacklogState | null>
      changelog: Shaped<ChangelogState | null>
      docs: Shaped<DocsState | null>
      doc: Shaped<OpenDoc | null>
      /** Datei der aufgeklappten Aufgabe bzw. der geöffneten Doku-Datei */
      opened: Shaped<string | null>
      /** Letzte Meldung im Pane, etwa ein gescheitertes Verschieben */
      notice: Shaped<string | null>
    }
  }
}
