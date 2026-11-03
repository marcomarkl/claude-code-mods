# projekt-mappe

Claude-Code-Mod für die Unterlagen eines Projekts, im Terminal und im Code-Tab der Claude-Desktop-App. Er verwaltet die ToDo-Liste, global und je Projekt, dazu je Projekt Backlog und Changelog in ihren üblichen Formaten. README, CLAUDE.md, Entscheidungen und Pläne zeigt er gerendert an, und fehlende Best-Practice-Dateien legt er mit festem Gerüst an. Bis Version 0.4.0 hieß der Mod todo-liste.

## Ein- und ausblenden

Rechts unter dem Eingabefeld, neben Claude Codes eigenen Modus-Anzeigen, stehen drei Schalter:

| Schalter | Zahl | Klick |
| --- | --- | --- |
| `☑ ToDo 3` | offene ToDos, Projekt und global zusammen | ToDo-Liste im zuletzt gewählten Bereich (🌐 oder 📁) |
| `🗂 Backlog 5` | offene Aufgaben (To Do und In Progress bzw. offen und ruht) | Reiter Backlog des Projekts |
| `📜 Changelog` | keine | Reiter Changelog des Projekts |

Ist das Pane zu, öffnet ein Klick es auf diesem Reiter. Ist es offen, schaltet der Klick um. Zeigt es den Reiter schon, schließt der Klick es. Der Schalter des sichtbaren Reiters ist hervorgehoben, die anderen sind gedimmt. Ohne offene Einträge steht keine Zahl dabei. Das Pane selbst heißt `🗂 Projektmappe`.

Ohne Maus geht es mit `/projekt-mappe`. `/projekt-mappe global` oder `/projekt-mappe projekt` öffnet die ToDo-Liste in diesem Bereich, `/projekt-mappe backlog`, `changelog` oder `doku` den Reiter.

Wo das Pane erscheint, bestimmt Claude Code. Im Terminal steht es im Vollbild ab 110 Spalten neben dem Chatverlauf, sonst über dem Eingabefeld. Der Mod merkt sich, ob das Pane offen war und welcher Bereich und Reiter gewählt war.

## Aufbau

Oben stehen `🌐 N` (global) und `📁 N` (aktuelles Projekt), jeweils mit der Zahl offener ToDos. Global gibt es nur die ToDo-Liste. Im Projekt stehen darunter die Reiter:

| Reiter | Inhalt |
| --- | --- |
| ToDo | die ToDo-Liste des Projekts |
| Backlog | Aufgaben nach Status gruppiert: Offen, In Arbeit, Erledigt, Archiv |
| Changelog | Einträge unter `[Unreleased]`, Release, darunter die veröffentlichten Versionen |
| Doku | README.md, CLAUDE.md, AGENTS.md, Entscheidungen, Pläne; darunter „Fehlt“ |

Alle 10 Sekunden liest der Mod die beiden ToDo-Listen und das Backlog neu, für die Zahlen an den Schaltern. Beim Backlog listet er dafür nur die Ordner auf und liest bloß die Aufgaben neu, die sich geändert haben. Changelog und Doku liest er nur, solange das Pane ihren Reiter zeigt.

In der mobilen App gibt es keine Eingabefelder. Dort lassen sich ToDos abhaken und löschen, Aufgaben erledigen und alles ansehen.

## Toleranz: nur die angefasste Einheit ändert sich

Diese Dateien werden auch von Hand und von Claude gepflegt. Der Mod ändert deshalb nur die Einheit, die er gerade anfasst: eine Checkbox-Zeile, ein Frontmatter-Feld einer Aufgabe, einen Changelog-Eintrag. Alles andere in der Datei bleibt Zeichen für Zeichen stehen, auch Einleitungen, Abschnitte, Fließtext, Byte Order Mark und Windows-Zeilenenden. Was er nicht als Einheit erkennt, zeigt er gerendert an. Gesperrt (`⚠`) ist eine Liste nur, wenn die Datei da, aber nicht lesbar ist.

## ToDo

Format nach [todo-md](https://github.com/todo-md/todo-md): Einträge sind Checkbox-Zeilen, Folgezeilen mehrzeiliger Einträge stehen eingerückt darunter.

```markdown
# TODO

- [ ] Release bauen
- [ ] Doku nachziehen
  mit Beispielen
  - [ ] Unteraufgabe
- [x] Tests
- [-] abgelehnt
```

| Icon | Wirkung |
| --- | --- |
| `＋` | neuer Eintrag (rechts oben): Text eingeben, „Speichern“ oder Enter speichert, Shift+Enter bricht um |
| `☐` / `☑` | abhaken bzw. wieder öffnen; die Zeile bleibt in der Datei an ihrem Platz |
| `✎` | Text ändern |
| „Abbrechen“ | Eingabe verwerfen |
| `↑` `↓` | mit dem Nachbarn tauschen, wenn beide offen sind, gleich tief stehen und kein anderer Inhalt dazwischen liegt |
| `✕` | Eintrag löschen, ohne Rückfrage |
| `🧹` | alle erledigten Einträge entfernen, ohne Rückfrage |

Im Pane stehen die offenen oben, erledigte und abgelehnte (`[-]`) gedimmt darunter, Unteraufgaben eingerückt. Neue Einträge kommen hinter den letzten Eintrag der Datei, gibt es keinen, ans Ende. Eine leere Liste bekommt den Kopf `# TODO`. Ein Eintrag hat höchstens 500 Zeichen.

Speicherorte:

- **Global:** `~/.claude/projekt-mappe/TODO.md`, bzw. unter `CLAUDE_CONFIG_DIR`, wenn gesetzt.
- **Projekt:** `TODO.md` im Projektordner, sonst eine vorhandene `todo.md`. Der Mod trägt `/TODO.md` in `.git/info/exclude` ein, die Liste bleibt privat und landet in keinem Commit. Das gilt auch, wenn sich `git` selbst nicht aufrufen lässt, aber ein `.git`-Ordner da ist. Eine schon eingecheckte TODO-Datei bleibt eingecheckt. In einem Git-Worktree gilt die Liste des ursprünglichen Projektordners, alle Worktrees eines Repos teilen sich eine Liste.

## Backlog

Neue Backlogs entstehen im Format von [Backlog.md](https://github.com/MrLesk/Backlog.md), damit dessen CLI, Board und MCP-Server parallel funktionieren:

- Ordner `backlog/` mit `tasks/`, `completed/`, `archive/`, `drafts/` und `config.yml`
- eine Datei je Aufgabe, `task-12 - Titel-der-Aufgabe.md`, mit Frontmatter `id`, `title`, `status`, `assignee`, `created_date`, `labels`, `dependencies` und einer Beschreibung zwischen den Markierungen von Backlog.md
- Status aus `config.yml`, ohne Datei `To Do`, `In Progress`, `Done`; erledigt bleibt eine Aufgabe in `tasks/`, archivieren schiebt sie nach `archive/`

Daneben verwaltet der Mod die Ordner-Form, die in einigen Projekten schon existiert: `backlog/tasks/012-slug.md` oder `task-012-slug.md` mit Frontmatter `status` (`offen`, `ruht`, `erledigt`, `gegenstandslos`) und `angelegt`. Erledigen setzt dort `status` und `erledigt` und schiebt die Datei nach `backlog/completed/`. Neue Aufgaben folgen dem Namensmuster der vorhandenen.

Verschoben wird im Git-Repo per `git mv`, sonst per `mv`. Scheitert das, bleibt die Datei, wo sie war, und das Pane meldet den Fehler. Eine einzelne `BACKLOG.md` ohne `backlog/`-Ordner zeigt der Mod nur an.

Im Reiter klappt ein Klick auf eine Aufgabe ihre Beschreibung auf, mit Knöpfen für jeden Status und `🗄` zum Archivieren. `☐`/`☑` erledigt bzw. öffnet wieder. `＋` legt eine Aufgabe an: erste Zeile Titel, der Rest Beschreibung.

## Changelog

Format nach [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/): oben `## [Unreleased]`, Kategorien `### Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. `＋` legt einen Eintrag mit Kategorie an. „Release“ macht aus `[Unreleased]` eine Version, `## [1.2.0] - 2026-11-03`, und darüber ein neues, leeres `[Unreleased]`. Das Feld ist mit der Version aus `.claude-plugin/plugin.json` bzw. `package.json` vorbelegt. Leer gelassen, wird das heutige Datum zur Version, `## [2026-11-03]`, für Projekte ohne Versionen.

Bestehende Changelogs schreibt der Mod in ihrem Stil fort: datierte Aufzählungspunkte (`- 2026-11-03: …` oder `- **2026-11-03 (…)**`) bekommen einen neuen Punkt oben, Versionsabschnitte ohne Kategorien ein `[Unreleased]` darüber. Ändern und löschen lassen sich nur Einträge unter `[Unreleased]`. `CHANGES.md`, `HISTORY.md` und Changelogs in einem unbekannten Stil zeigt er nur an.

## Doku und Vollständigkeit

Der Reiter Doku listet `README.md`, `CLAUDE.md` und `AGENTS.md`, Entscheidungen aus `docs/decisions/`, `docs/adr/` und `backlog/decisions/` sowie die Pläne unter `plans/`. Ein Klick zeigt die Datei gerendert, nur lesend. Längere Dateien als 90 000 Zeichen werden gekürzt angezeigt, mit Hinweis.

Darunter steht „Fehlt“ mit dem, was nach Best Practice fehlt, und je einem Knopf zum Anlegen:

| Fehlt | Gerüst |
| --- | --- |
| Changelog | `CHANGELOG.md` nach Keep a Changelog, leeres `[Unreleased]` |
| Backlog | `backlog/config.yml` und `backlog/tasks/` nach Backlog.md |
| Entscheidungen | `docs/decisions/0001-record-architecture-decisions.md` und `template.md` nach Michael Nygard |
| Lizenz | `LICENSE`: MIT oder Apache-2.0 im SPDX-Wortlaut, oder „Alle Rechte vorbehalten“; Jahr und Name aus `git config user.name` |

Als vorhanden zählen auch eine einzelne `BACKLOG.md`, `CHANGES.md` und `HISTORY.md`. Vorhandene Dateien überschreibt der Mod nie. README, CLAUDE.md und AGENTS.md bekommen keine Vorlage, ihr Inhalt ist projektspezifisch. Fehlt CLAUDE.md, weist der Reiter auf Claude Codes `/init` hin.

## Claude und die Mappe

Claude bekommt das Werkzeug `projekt` und kann damit ToDo-Liste, Backlog und Changelog lesen und bearbeiten. Zum Beispiel:

- „setz ‚Release bauen‘ auf meine ToDo-Liste“
- „hak ‚Test‘ ab“
- „leg im Backlog eine Aufgabe ‚Backup prüfen‘ an“
- „setz TASK-3 auf In Progress“
- „trag im Changelog unter Fixed ein, dass der Fokus wieder stimmt“
- „mach ein Release 0.5.0“

Beim Ändern trifft Claude ToDos und Aufgaben über ihre Kennung, die das Lesen mitliefert. Die Kennung eines ToDos steht nicht in der Datei. Der Mod bildet sie aus dem Text, nach einer Textänderung ist sie also neu. Löschen lässt sich nicht rückgängig machen, wie im Pane. Für die Freigabe gelten Claude Codes normale Berechtigungsregeln. Das Werkzeug liegt hinter ToolSearch und kostet keinen Kontext, solange Claude es nicht braucht.

## Installieren

In einer Terminal-Sitzung von Claude Code:

```
/plugin install projekt-mappe --marketplace marcomarkl/claude-code-mods
```

In der Desktop-App: **+** neben dem Eingabefeld, **Plugins**, **Add marketplace** mit `marcomarkl/claude-code-mods`, dann bei projekt-mappe **Add plugin**.

Wer todo-liste installiert hat, deinstalliert es vorher. Sonst laufen beide Mods mit zwei Panes nebeneinander.

Zum Ausprobieren eines Arbeitsstands: `claude --plugin-dir /Pfad/zu/claude-code-mods/plugins/projekt-mappe`.
