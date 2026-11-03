# todo-liste

Claude-Code-Mod für eine ToDo-Liste, im Terminal und im Code-Tab der Claude-Desktop-App. Es gibt zwei Listen: eine globale über alle Projekte und eine für das aktuelle Projekt. Bedient wird die Liste über Icons.

## Ein- und ausblenden

Rechts unter dem Eingabefeld, neben Claude Codes eigenen Modus-Anzeigen, steht der Schalter `☑ ToDos`. Gibt es offene Einträge, steht die Zahl dabei, etwa `☑ ToDos 3` für Projekt und global zusammen. Ein Klick öffnet oder schließt die Liste.

Ohne Maus geht es mit `/todo-liste`. `/todo-liste global` oder `/todo-liste projekt` öffnet die Liste direkt mit diesem Tab.

Wo die Liste erscheint, bestimmt Claude Code. Im Terminal steht sie im Vollbild ab 110 Spalten neben dem Chatverlauf, sonst über dem Eingabefeld.

Der Mod merkt sich, ob die Liste offen war und welcher Tab gewählt war, und stellt beides in der nächsten Sitzung wieder her.

## Bedienung

| Icon | Wirkung |
| --- | --- |
| `🌐 N` | Tab „global“, N offene Einträge |
| `📁 N` | Tab „aktuelles Projekt“, N offene Einträge |
| `＋` | neuer Eintrag (rechts oben): Text eingeben, „Speichern“ oder Enter speichert, Shift+Enter bricht um |
| `☐` / `☑` | abhaken bzw. wieder öffnen |
| `✎` | Text ändern, „Speichern“ oder Enter speichert, Shift+Enter bricht um |
| „Abbrechen“ | Eingabe verwerfen |
| `↑` `↓` | offenen Eintrag eine Stelle nach oben bzw. unten schieben |
| `✕` | Eintrag löschen, ohne Rückfrage |
| `🧹` | alle erledigten Einträge des Tabs entfernen, ohne Rückfrage |

Nach `＋` oder `✎` steht der Fokus gleich im Eingabefeld, man kann sofort tippen. Nach dem Speichern oder Abbrechen steht er wieder auf `＋` bzw. `✎`; Esc führt zurück ins Chat-Eingabefeld.

Neue Einträge kommen ans Ende der offenen. Abgehakte rutschen gedimmt und durchgestrichen ans Ende der Liste. Wieder geöffnete stellen sich hinten bei den offenen an. Einträge dürfen mehrzeilig sein; das Eingabefeld hat drei Zeilen, längere Texte scrollen darin. Mehr als eine Leerzeile am Stück wird zu einer, ein Eintrag hat höchstens 500 Zeichen.

In der mobilen App gibt es kein Eingabefeld. Dort lassen sich Einträge nur abhaken und löschen.

## Speicherorte

- **Global:** `~/.claude/todo-liste/TODO.md`, bzw. unter `CLAUDE_CONFIG_DIR`, wenn gesetzt.
- **Projekt:** `TODO.md` im Projektordner. Der Mod trägt `/TODO.md` in `.git/info/exclude` ein. Die Datei landet so in keinem Commit, und die `.gitignore` des Projekts bleibt unverändert. Läuft die Sitzung in einem Git-Worktree, gilt die Liste des ursprünglichen Projektordners: alle Worktrees eines Repos teilen sich eine Liste. Ohne Git-Repo gilt der Ordner, in dem die Sitzung läuft.

Beide Dateien folgen dem Format [todo-md](https://github.com/todo-md/todo-md): der Kopf `# TODO`, darunter eine Liste, offene zuerst, erledigte am Ende. Folgezeilen mehrzeiliger Einträge stehen zwei Leerzeichen eingerückt:

```markdown
# TODO

- [ ] Release bauen
- [ ] Doku nachziehen
  mit Beispielen
- [x] Tests
```

Die Datei gehört dem Mod. Er schreibt sie bei jeder Änderung neu. Von Hand bearbeiten geht, solange sie aus diesen Zeilen besteht; `*` oder `+` als Aufzählung und `[X]` liest er mit und schreibt sie als `- [ ]`/`- [x]` zurück. Eine `TODO.md` mit anderem Inhalt, etwa mit Abschnitten, Fließtext oder Tabellen, überschreibt der Mod nicht. Die Liste zeigt dann `⚠` mit dem Pfad und ist gesperrt, bis die Datei wieder dem Format entspricht.

Mehrere Sitzungen können dieselbe Liste bearbeiten. Jede Änderung liest die Datei vorher neu, die letzte gewinnt. Änderungen aus anderen Sitzungen erscheinen nach spätestens 10 Sekunden. Ändert eine andere Sitzung den Text eines Eintrags, den man gerade bearbeitet, schließt sich das Eingabefeld, und das Getippte geht verloren.

## Claude und die Liste

Claude bekommt ein Werkzeug `todos` und kann damit die Listen lesen und bearbeiten. Zum Beispiel:

- „setz ‚Release bauen‘ auf meine ToDo-Liste“
- „hak ‚Test‘ ab“
- „benenn den zweiten Eintrag um in …“
- „schieb ‚Doku‘ nach oben“
- „lösch die erledigten im Projekt“

Ohne Angabe legt Claude im Projekt an, auf Wunsch auch global. Beim Ändern trifft Claude einen Eintrag über seine Kennung, die das Lesen der Liste mitliefert. Die Kennung steht nicht in der Datei, der Mod bildet sie beim Lesen aus dem Text; nach einer Textänderung hat ein Eintrag deshalb eine neue. Löschen lässt sich nicht rückgängig machen, wie im Pane. Für die Freigabe gelten Claude Codes normale Berechtigungsregeln. Das Werkzeug liegt hinter ToolSearch und kostet keinen Kontext, solange Claude es nicht braucht.

## Installieren

In einer Terminal-Sitzung von Claude Code:

```
/plugin install todo-liste --marketplace marcomarkl/claude-code-mods
```

In der Desktop-App: **+** neben dem Eingabefeld, **Plugins**, **Add marketplace** mit `marcomarkl/claude-code-mods`, dann bei todo-liste **Add plugin**.

Zum Ausprobieren eines Arbeitsstands: `claude --plugin-dir /Pfad/zu/claude-code-mods/plugins/todo-liste`.
