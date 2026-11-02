# kontext-cache-band

Claude-Code-Mod, der im Band über dem Eingabefeld eine Zeile aus kleinen Balken zeigt, im Terminal und im Code-Tab der Claude-Desktop-App:

```
Kontext ▰▰▰▰▰▱▱▱▱▱  45 %  Cache ▰▰▰▰▰▰▰▰▰▰ 58:30  5 Std ▰▱▱▱▱▱▱▱▱▱  12 %  7 Tage ▱▱▱▱▱▱▱▱▱▱   2 %
```

Jeder Balken hat 10 Einheiten zu je 10 %, daneben steht ein kurzer Wert.

- **Kontext**: Füllstand des Kontextfensters (Wert der letzten Antwort, wie die Statuszeile ihn hat). Grün, gelb ab 5 Punkten vor der Auto-Compact-Schwelle, rot ab 90 %. Die Einheit, in der die Schwelle liegt, ist gelb, solange sie leer ist. Ohne Messung steht `–`.
- **Cache**: Restzeit bis zum Ablauf des Caches als `m:ss`. Der Balken ist direkt nach einer Anfrage voll und leert sich über die Lebensdauer (1 Stunde oder 5 Minuten). Grün, in der letzten Minute gelb. Ist der Cache abgelaufen, ist der Balken leer mit roten Einheiten und der Wert `–`. Wartet er auf die nächste Anfrage, ist abgeschaltet oder wurde nichts gecacht, ist der Balken grau und der Wert ebenfalls `–`.
- **5 Std** und **7 Tage**: die Nutzungsfenster des Abos in Prozent. Grün, ab 70 % gelb, ab 90 % rot. Nach der Zurücksetzung steht 0 %, bis die nächste Anfrage den neuen Stand bringt. Ohne Abo (API-Schlüssel, Gateway) gibt es diese Balken nicht.

Ein `≈` vor einem Wert heißt geschätzt: vor der ersten Antwort, nach `/clear` und nach einer Komprimierung beim Kontext, bei einem fortgesetzten Gespräch beim Cache.

Nicht jeder Plan hat jedes Nutzungsfenster, der große Max-Plan etwa kein 5-Stunden-Limit. Außerdem meldet Claude Code die Fenster erst nach der ersten Antwort einer Sitzung, und ein Fenster fällt kurz weg, sobald seine Zurücksetzung vorbei ist. Deshalb merkt sich der Mod jedes gemeldete Fenster über Sitzungen hinweg. Ein Fenster bekommt einen Balken, solange es in den letzten 7 Tagen gemeldet wurde. Fehlt es gerade, gilt der gemerkte Stand, nach dessen Zurücksetzung 0 %. Ein Fenster, das nie gemeldet wurde, bekommt keinen Balken.

Zur Prüfung gibt `/kontext-cache-band-limits` die Nutzungsfenster unverändert aus, wie Claude Code sie gerade meldet, dazu was der Mod zuletzt gespeichert und über Sitzungen gemerkt hat.

Im Terminal sind die Einheiten die Zeichen `▰` und `▱`, die Desktop-App zeichnet kleine abgerundete Rechtecke. Passt die Zeile nicht in die Breite, rutschen ganze Gruppen aus Bezeichnung, Balken und Wert in eine zweite Zeile.

## Cache warm halten: `/cache-keep-warm`

Hält den Prompt-Cache des Gesprächs für ein Zeitfenster warm, etwa über eine Mittagspause.

```
/cache-keep-warm 2h        # auch 90m, 90 (Minuten), 1h30m, 1,5h, 1:30; höchstens 24 h
/cache-keep-warm           # ohne Angabe 1 h; läuft es schon, zeigt es den Stand
/cache-keep-warm stop      # beendet (auch: aus, ende); oder „Beenden“ im Band
```

Kurz vor jedem Ablauf (5 min vorher bei 1 h Lebensdauer, 1 min vorher bei 5 min) schickt der Mod die letzte Anfrage des Gesprächs mit `$.model.fork` noch einmal ab. Die API liest sie aus dem Cache, und jeder Treffer setzt die Lebensdauer ohne Aufpreis neu. Das Gespräch selbst bekommt keine Nachricht dazu. Hält der Cache ohnehin bis zum Fensterende, wird nicht mehr aufgefrischt.

Solange es läuft, zeigt das Band eine zweite Zeile „Warm“: einen Balken für den Rest des Zeitfensters, die Restzeit als `h:mm`, die Zahl der Auffrischungen (etwa `· 2×`) und den Knopf „Beenden“. Es endet von selbst mit dem Fenster, nach `/clear` oder einem Gesprächswechsel, und wenn es nichts mehr aufzufrischen gibt. Schlägt eine Auffrischung fehl, steht das kurz in der Zeile (etwa „Auffrischung fehlgeschlagen (529)“), und nach 30 Sekunden folgt ein neuer Versuch.

Kosten: Jede Auffrischung liest den ganzen Kontext aus dem Cache (zum Cache-Lesepreis, laut Anthropic ein Bruchteil des normalen Eingabepreises) und zählt im Abo zur Nutzung. Bei 1 h Lebensdauer ist das etwa eine Auffrischung pro Stunde, bei 5 min rund zwölf. Ist der Cache beim Start schon abgelaufen, baut die erste Auffrischung ihn neu auf, das kostet einmal einen Schreibvorgang. Läuft der Rechner nicht (Ruhezustand, App geschlossen), wird nicht aufgefrischt.

## Wann sich die Anzeige aktualisiert

- Nach jeder Modellanfrage des Hauptgesprächs (oft mehrmals pro Runde): alle Balken.
- Nach jeder Runde und wenn sich ein Nutzungsfenster bewegt: Kontext und Nutzungsfenster.
- Jede Sekunde, solange der Cache warm ist: die Restzeit. Beim Ablauf einmal (leerer Balken).
- Einmal pro Minute, solange Nutzungsfenster angezeigt werden: nach einer Zurücksetzung 0 %.
- Nach geänderten Einstellungen, einem Modellwechsel, `/clear`, einem Gesprächswechsel und einer Komprimierung: sofort.

Vor der ersten Antwort, nach `/clear` und nach einer Komprimierung gibt es keinen gemessenen Kontextwert. Dann zeigt der Kontext Claude Codes Schätzung mit `≈`. Während eine einzelne Antwort noch läuft, steht der Kontext auf dem Stand der vorigen Anfrage, weil die API die Token erst am Ende meldet.

## Wie die Cache-Restzeit berechnet wird

Claude Code meldet die Restzeit nicht direkt. Der Mod merkt sich bei jeder Anfrage des Hauptgesprächs den Zeitpunkt und die Cache-Lebensdauer, die dabei galt, und zählt von dort herunter.

Rangfolge der Lebensdauer: `FORCE_PROMPT_CACHING_5M`, `CLAUDE_CODE_PROMPT_CACHE_TTL`, Einstellung `promptCacheTtl`, `ENABLE_PROMPT_CACHING_1H` (laut Claude-Code-Doku). Ohne eigene Einstellung: ausgeschöpftes Abo-Fenster 5 Minuten („Zusatznutzung, vermutet“), sonst der Wert, den Claude Code selbst gemeldet hat („von Claude Code gemeldet“, bei Modellwechsel und beim Fortsetzen eines Gesprächs), sonst 1 Stunde im Abo und 5 Minuten ohne Abo.

Beim Fortsetzen eines Gesprächs schätzt der Mod den Cache-Stand aus Claude Codes Angaben (Zeit seit der letzten Antwort, Kontextgröße, ob der Cache vermutlich abgelaufen ist) und kennzeichnet ihn mit `≈`.

Grenzen:

- Nur Anfragen des Hauptgesprächs zählen. Subagenten haben einen eigenen Cache. Prompt-Vorschläge, Forks und andere Nebenanfragen können den Cache etwas länger warm halten, als der Countdown zeigt.
- Zusatznutzung erkennt der Mod nur indirekt. Sicher wird die Anzeige mit einer eigenen `promptCacheTtl`-Einstellung.

## Installieren

In einer Terminal-Sitzung von Claude Code eingeben:

```
/plugin install kontext-cache-band --marketplace marcomarkl/claude-code-mods
```

Danach `y`, um den Marktplatz hinzuzufügen, und einen Geltungsbereich wählen. Bei einem privaten Repository braucht der Rechner Zugriff auf GitHub (angemeldetes `gh` oder Git-Zugangsdaten).

In der Desktop-App: **+** neben dem Eingabefeld, **Plugins**, **Add marketplace** mit `marcomarkl/claude-code-mods`, dann **Add plugin**.

## Aus einem Ordner laden (Entwicklung)

Ordner dauerhaft für alle Sitzungen der Desktop-App und des Terminals: in `~/.claude/settings.json`

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/Pfad/zu/claude-code-mods/plugins/kontext-cache-band" } }
```

Einmalig im Terminal: `claude --plugin-dir /Pfad/zu/claude-code-mods/plugins/kontext-cache-band`

Braucht Claude Code 2.1.287 oder neuer (Desktop-App: 2.1.286), geprüft mit 2.1.312.
