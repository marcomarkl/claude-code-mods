# claude-code-mods

Sammlung von Mods für Claude Code (Terminal und Code-Tab der Claude-Desktop-App). Das Repository ist zugleich ein Plugin-Marktplatz: Jeder Mod liegt in einem eigenen Ordner unter `plugins/` und ist in `.claude-plugin/marketplace.json` eingetragen.

| Mod | Inhalt |
| --- | --- |
| [kontext-cache-band](plugins/kontext-cache-band/README.md) | Band über dem Eingabefeld mit Kontextfüllstand, Cache-Restzeit, Auto-Compact-Schwelle und den Nutzungslimits des Abos; `/cache-keep-warm` |
| [projekt-mappe](plugins/projekt-mappe/README.md) | Projektmappe in einem Pane: ToDo global und pro Projekt, Backlog und Changelog nach Best Practice verwalten, README, CLAUDE.md, Entscheidungen und Pläne ansehen, fehlende Dateien anlegen; Claude kann lesen und bearbeiten |

## Installieren

In einer Terminal-Sitzung von Claude Code:

```
/plugin install <mod> --marketplace marcomarkl/claude-code-mods
```

In der Desktop-App: **+** neben dem Eingabefeld, **Plugins**, **Add marketplace** mit `marcomarkl/claude-code-mods`, dann **Add plugin**.

## Aufbau

```
.claude-plugin/marketplace.json   Marktplatz mit allen Mods
plugins/<mod>/
  .claude-plugin/plugin.json      Name, Version, Beschreibung
  hooks/hooks.json                verweist auf das Hooks-Modul
  hooks/register.tsx              das Hooks-Modul
  types/index.d.ts                Typvertrag für $.state (falls gebraucht)
  tests/*.test.tsx                Tests
  README.md
```

Ein neuer Mod bekommt einen Ordner unter `plugins/` und einen Eintrag in `.claude-plugin/marketplace.json`.

## Entwickeln

Prüfen, Typen checken und testen, jeweils für einen Mod-Ordner:

```
claude plugin validate plugins/<mod>
claude plugin test plugins/<mod>
```

Zum Laden aus dem Ordner den Mod-Pfad in `~/.claude/settings.json` unter `env.CLAUDE_CODE_PLUGIN_DIRS` eintragen oder `claude --plugin-dir plugins/<mod>` starten.
