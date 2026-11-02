import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  plugin: 'kontext-cache-band',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

const USAGE = {
  startedAt: 0,
  context: {
    tokens: 90_000,
    window: 200_000,
    percent: 45,
    breakdown: { isAutoCompactEnabled: true, autoCompactThreshold: 167_000 },
  },
  rateLimits: [{ kind: 'five_hour', percentUsed: 12 }],
}

const STEP_RESULT = {
  turnId: 't1',
  index: 0,
  answer: '',
  toolUses: [],
  stopReason: 'end_turn',
  usage: {
    input_tokens: 1_000,
    output_tokens: 500,
    cache_read_input_tokens: 85_000,
    cache_creation_input_tokens: 4_000,
    model: 'm',
  },
}

// Antwort auf $.model.fork; ein Test setzt sie um, um Fehler zu spielen
const FORK_OK = {
  isAnswered: true,
  text: 'ok',
  usage: {
    input_tokens: 40,
    output_tokens: 2,
    cache_read_input_tokens: 89_000,
    cache_creation_input_tokens: 0,
    model: 'm',
  },
}
let forkAnswer: unknown = FORK_OK
let forks = 0
// Verbrauch der Hauptanfragen; ein Test setzt ihn um, etwa für einen kalten Cache
let stepUsage: unknown = STEP_RESULT.usage
const toasts: string[] = []

// Was unter dem Mod steht: Claude Code und andere Mods, hier eine Zeile „unten“
// store: Vorbelegung des Speichers ($.store) wie aus früheren Sitzungen, null für keinen
function engine(on: On, usage: unknown = USAGE, store: Readonly<Record<string, unknown>> | null = {}) {
  if (store !== null) mock.store(on, store)
  forkAnswer = FORK_OK
  forks = 0
  stepUsage = STEP_RESULT.usage
  toasts.length = 0
  on('model.fork', () => {
    forks += 1
    return { value: forkAnswer as never }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.toast', (_, e) => {
    toasts.push(String((e as { text?: unknown }).text ?? e))
    return { value: undefined } as never
  })
  on('settings.read', () => ({ value: {} }))
  on('session.usage', () => ({ value: (typeof usage === 'function' ? usage() : usage) as never }))
  on('classic.SessionStart', () => ({}))
  on('classic.PostModelSwitch', () => ({}))
  on('classic.ConfigChange', () => ({}))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', () => ({ sessionId: 's' }) as never)
  on('turn.step', async function* (_, e) {
    return { ...STEP_RESULT, usage: stepUsage, turnId: e.turnId, index: e.index } as never
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>unten</Text>
  })
}

// ---- Hilfen ------------------------------------------------------------------

const NOW = Date.parse('2026-10-29T10:00:00Z') // 29.10.2026, 11:00 in Wien
const MIN = 60_000
const H = 60 * MIN
const D = 24 * H
const at = (ms: number) => new Date(NOW + ms).toISOString()
const windows = (five?: [number, number], week?: [number, number]) => [
  ...(five === undefined ? [] : [{ kind: 'five_hour', percentUsed: five[0], resetsAt: at(five[1]) }]),
  ...(week === undefined ? [] : [{ kind: 'seven_day', percentUsed: week[0], resetsAt: at(week[1]) }]),
]

type Drawing = Mounted<'terminal' | 'desktop', 'AbovePrompt'>

// Quelltext der Balkengrafik, deren Bildbeschreibung passt (Desktop)
async function svgOf(ui: Drawing, alt: RegExp): Promise<string> {
  const svg = (await ui.findAll({ type: 'Svg' })).find(s => alt.test(String(s.props.alt)))
  return String(svg?.props.source)
}

// Zahl der Einheiten einer Balkengrafik in einer Farbe; ohne Farbe alle Einheiten
function units(source: string, color?: string): number {
  const rects = source.match(/<rect [^>]*\/>/g) ?? []
  return color === undefined ? rects.length : rects.filter(r => r.includes(`fill="${color}"`)).length
}

// Die Bezeichnungen der Gruppen in der Reihenfolge der Zeile
async function labels(ui: Drawing): Promise<string[]> {
  const all = await ui.findAll({ type: 'Text', text: /^(Kontext|Cache|5 Std|7 Tage)$/ })
  return all.map(t => String(t.text))
}

async function start($: Engine) {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 } as never)) {
    // nur durchlaufen
  }
}

// ---- Die Zeile -----------------------------------------------------------------

test('Eine Zeile: Kontext, Cache und beide Limits auf jeder Fläche', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: windows([12, 3 * H], [2, 4 * D]) })
  await start($)
  await clock.advance(90_000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await labels(ui)).toEqual(['Kontext', 'Cache', '5 Std', '7 Tage'])
    // Je ein kurzer Wert: Kontext in Prozent, Cache als Restzeit, Limits in Prozent
    for (const value of ['45 %', '58:30', '12 %', '2 %']) {
      expect((await ui.find({ type: 'Text', text: new RegExp(`^${value}$`) }))?.text).toBe(value)
    }
    // Keine Erklärtexte mehr
    expect(await ui.find({ type: 'Text', text: /von 200k|TTL|Treffer|gelesen|Auto-Compact|Limit/ })).toBeUndefined()
    // Gruppen brechen als Ganzes um, statt zu schrumpfen
    const row = (await ui.findAll({ type: 'Box' })).find(b => b.props.flexWrap === 'wrap')
    expect(row).toBeDefined()
    if (surface === 'terminal') {
      // Einheiten aus ▰ und ▱, 10 je Balken; 45 % sind 4,5, gerundet 5 Einheiten
      // Nur die äußeren Balkentexte: die gefärbten Abschnitte darin passen bei einfarbigen Balken auch
      const bars = (await ui.findAll({ type: 'Text', text: /^[▰▱]{10}$/ }))
        .filter(t => t.props.color === undefined && t.props.dimColor === undefined)
        .map(t => t.text)
      expect(bars).toEqual(['▰▰▰▰▰▱▱▱▱▱', '▰▰▰▰▰▰▰▰▰▰', '▰▱▱▱▱▱▱▱▱▱', '▱▱▱▱▱▱▱▱▱▱'])
      // Die Auto-Compact-Schwelle (84 %) liegt in der neunten Einheit: dort ein gelbes ▱
      const mark = (await ui.findAll({ type: 'Text', text: /^▱$/ })).find(t => t.props.color === 'warning')
      expect(mark).toBeDefined()
      expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    } else {
      expect(await ui.find({ type: 'Text', text: /[▰▱]/ })).toBeUndefined()
      const svgs = await ui.findAll({ type: 'Svg' })
      expect(svgs.map(s => s.props.alt)).toEqual([
        'Kontext 45 % belegt, Auto-Compact bei 84 %',
        'Cache: noch 58:30',
        '5-Stunden-Limit: 12 %',
        '7-Tage-Limit: 2 %',
      ])
      const context = String(svgs[0]?.props.source)
      expect(units(context)).toBe(10)
      expect(units(context, '#4CB05A')).toBe(5)
      // Schwellen-Einheit gelb und blass, an neunter Stelle (x = 8 · 10)
      expect(context).toContain('<rect x="80" y="0" width="8" height="8" rx="2" fill="#E0A33A" fill-opacity="0.6"/>')
      expect(units(String(svgs[1]?.props.source), '#4CB05A')).toBe(10)
      expect(units(String(svgs[2]?.props.source), '#4CB05A')).toBe(1)
    }
    // Was darunter gezeichnet wird, bleibt sichtbar
    expect((await ui.find({ type: 'Text', text: /^unten$/ }))?.text).toBe('unten')
    await ui.unmount()
  }
})

test('Countdown zählt im gezeichneten Band jede Sekunde weiter', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on)
  await start($)
  await clock.advance(90_000)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^58:30$/ }))?.text).toBe('58:30')
  await clock.advance(1_000)
  expect((await ui.find({ type: 'Text', text: /^58:29$/ }))?.text).toBe('58:29')
  await ui.unmount()
})

test('Kontext nahe der Schwelle: gefüllt in Warnfarbe, ohne eigene Marke', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, context: { ...USAGE.context, tokens: 176_000, percent: 88 } })
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const context = await svgOf(ui, /^Kontext/)
  expect(units(context, '#E0A33A')).toBe(9)
  expect(context).not.toContain('fill-opacity="0.6"')
  await ui.unmount()
})

test('Kalter Cache: leerer Balken mit roten Einheiten, Wert –', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { CLAUDE_CODE_PROMPT_CACHE_TTL: '5m' })
  engine(on)
  await start($)
  await clock.advance(7 * MIN + 5_000)

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const cache = await svgOf(desktop, /^Cache/)
  expect(units(cache, '#E5534B')).toBe(10)
  expect((await desktop.findAll({ type: 'Svg' }))[1]?.props.alt).toBe('Cache: abgelaufen')
  expect(await desktop.find({ type: 'Text', text: /kalt|seit/ })).toBeUndefined()
  await desktop.unmount()

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const empty = (await terminal.findAll({ type: 'Text', text: /^▱{10}$/ })).find(t => t.props.color === 'error')
  expect(empty).toBeDefined()
  await terminal.unmount()
})

test('Nach /clear wartet der Cache auf die nächste Anfrage', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on)
  await start($)
  await $.session.end({ reason: 'clear' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    // Kontext und Cache ohne Wert; die Limits bleiben
    expect((await ui.findAll({ type: 'Text', text: /^–$/ })).length).toBe(2)
    if (surface === 'desktop') {
      const cache = await svgOf(ui, /^Cache/)
      expect(units(cache, '#808080')).toBe(10)
      expect((await ui.findAll({ type: 'Svg' }))[1]?.props.alt).toBe('Cache: wartet auf die nächste Anfrage')
    }
    await ui.unmount()
  }
})

test('Nach /compact gilt der alte Kontextwert nicht mehr, kurz danach die Schätzung', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, {})
  // Claude Code meldet direkt nach der Komprimierung noch den alten Wert, den neuen erst etwas später
  let usage: unknown = USAGE
  engine(on, () => usage)
  const summary = [{ role: 'user', text: 'Zusammenfassung', toolUses: [] }] as const
  on('session.compact', () => ({ messages: summary }) as never)
  await start($)
  await $.session.compact({ trigger: 'manual', messages: summary } as never)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^45 %$/ })).toBeUndefined()
  expect((await ui.findAll({ type: 'Svg' }))[0]?.props.alt).toBe('Kontext: noch keine Messung')
  expect((await ui.findAll({ type: 'Text', text: /^–$/ })).length).toBe(2)

  usage = { ...USAGE, context: { window: 200_000, breakdown: { ...USAGE.context.breakdown, totalTokens: 30_000 } } }
  await clock.advance(1000)
  expect((await ui.find({ type: 'Text', text: /^≈/ }))?.text).toBe('≈15 %')
  await ui.unmount()
})

test('Fehlt die Aufschlüsselung, hat der Kontext-Balken keine Schwellen-Einheit', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, context: { tokens: 90_000, window: 200_000, percent: 45 } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^45 %$/ }))?.text).toBe('45 %')
  expect(await svgOf(ui, /^Kontext/)).not.toContain('fill-opacity="0.6"')
  await ui.unmount()
})

test('Ohne Abo-Fenster: 5-Minuten-Lebensdauer, keine Limit-Balken', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, {})
  // Ein Gateway meldet nur ein spend_limit: das ist kein Abo und bekommt keinen Balken
  engine(on, { ...USAGE, rateLimits: [{ kind: 'spend_limit', percentUsed: 40 }] })
  await start($)
  await clock.advance(MIN)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^4:00$/ }))?.text).toBe('4:00')
  expect(await labels(ui)).toEqual(['Kontext', 'Cache'])
  await ui.unmount()
})

test('Ausgeschöpftes Abo-Fenster: vermutlich Zusatznutzung mit 5 Minuten, Limit rot', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: [{ kind: 'five_hour', percentUsed: 100 }] })
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^5:00$/ }))?.text).toBe('5:00')
  expect((await ui.find({ type: 'Text', text: /^100 %$/ }))?.text).toBe('100 %')
  expect(units(await svgOf(ui, /^5-Stunden/), '#E5534B')).toBe(10)
  await ui.unmount()
})

test('Kontext ohne gemessene Antwort zeigt Claude Codes Schätzung', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, {
    ...USAGE,
    rateLimits: [],
    context: { window: 200_000, breakdown: { isAutoCompactEnabled: true, autoCompactThreshold: 167_000, totalTokens: 12_000 } },
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /≈6 %/ }))?.text).toBe('≈6 %')
  await ui.unmount()
})

test('Kontext folgt jeder Anfrage, nicht erst dem Rundenende', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  let tokens = 90_000
  engine(on, () => ({
    ...USAGE,
    context: { ...USAGE.context, tokens, percent: Math.round((tokens / 200_000) * 100) },
  }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  tokens = 120_000
  for await (const _ of $.turn.step({ turnId: 't1', index: 1, model: 'm', messageCount: 3 } as never)) {
    // nur durchlaufen
  }

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^60 %$/ }))?.text).toBe('60 %')
  await ui.unmount()
})

test('Fortgesetztes Gespräch: Cache-Stand aus Claude Codes Angaben geschätzt', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: [] })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  // 20 Minuten her und laut Claude Code noch warm: also 1 Stunde Lebensdauer
  await $.classic.SessionStart({
    source: 'resume',
    seconds_since_last_response: 1200,
    context_tokens: 70_000,
    prompt_cache_likely_expired: false,
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^≈40:00$/ }))?.text).toBe('≈40:00')
  await ui.unmount()
})

test('Modellwechsel: Lebensdauer von Claude Code, Cache des neuen Modells kalt', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: [] })
  await start($)
  await $.classic.PostModelSwitch({
    from_model: 'a',
    to_model: 'b',
    requested_model: 'b',
    source: 'command',
    context_tokens: 90_000,
    prompt_cache_warm: true,
    cache_ttl: '5m',
    estimated_cache_write_usd: 0.1,
    pricing: 'catalog',
  })

  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.findAll({ type: 'Svg' }))[1]?.props.alt).toBe('Cache: wartet auf die nächste Anfrage')
  await ui.unmount()

  // Die nächste Anfrage nimmt die gemeldete Lebensdauer
  for await (const _ of $.turn.step({ turnId: 't2', index: 0, model: 'b', messageCount: 3 } as never)) {
    // nur durchlaufen
  }
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^5:00$/ }))?.text).toBe('5:00')
  await ui.unmount()
})

test('Letzte Minute: Restzeit und Balken gelb', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { CLAUDE_CODE_PROMPT_CACHE_TTL: '5m' })
  engine(on)
  await start($)
  await clock.advance(4 * MIN + 30_000)

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await desktop.find({ type: 'Text', text: /^0:30$/ }))?.props.color).toBe('warning')
  // 30 s von 5 min sind eine Einheit
  expect(units(await svgOf(desktop, /^Cache/), '#E0A33A')).toBe(1)
  await desktop.unmount()

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await terminal.find({ type: 'Text', text: /^▰$/ }))?.props.color).toBe('warning')
  await terminal.unmount()
})

// ---- Nutzungsfenster ------------------------------------------------------------

test('Limits: gelb ab 70 %, rot ab 90 %', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: windows([92, 3 * H], [75, 4 * D]) })
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(units(await svgOf(ui, /^5-Stunden/), '#E5534B')).toBe(9)
  // 75 % sind 7,5, gerundet 8 Einheiten
  expect(units(await svgOf(ui, /^7-Tage/), '#E0A33A')).toBe(8)
  await ui.unmount()
})

test('Limits: nach der Zurücksetzung 0 %', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: windows([88, 30 * MIN], [41, 4 * D]) })
  await start($)
  await clock.advance(31 * MIN)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^0 %$/ }))?.text).toBe('0 %')
  expect((await ui.find({ type: 'Text', text: /^41 %$/ }))?.text).toBe('41 %')
  await ui.unmount()
})

test('Max-Plan ohne 5-Stunden-Fenster: drei Balken', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: windows(undefined, [41, 4 * D]) })
  await start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await labels(ui)).toEqual(['Kontext', 'Cache', '7 Tage'])
    await ui.unmount()
  }
})

test('Gemerktes Fenster: fehlt es, gilt der gemerkte Stand bis zur Zurücksetzung', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, {})
  let rateLimits: unknown[] = windows([23, 3 * H], [41, 4 * D])
  engine(on, () => ({ ...USAGE, rateLimits }))
  await start($)

  // Claude Code meldet die Fenster nicht mehr (etwa kurz nach einer Zurücksetzung)
  rateLimits = []
  await start($)
  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await labels(ui)).toEqual(['Kontext', 'Cache', '5 Std', '7 Tage'])
  expect((await ui.find({ type: 'Text', text: /^23 %$/ }))?.text).toBe('23 %')
  expect((await ui.find({ type: 'Text', text: /^41 %$/ }))?.text).toBe('41 %')
  await ui.unmount()

  // Nach der gemerkten Zurücksetzung des 5-Stunden-Fensters: 0 %
  // (in Schritten, weil der Sekundentakt sonst zu viele Aufrufe auf einmal fällig macht)
  for (let i = 0; i < 6; i += 1) await clock.advance(30 * MIN)
  await clock.advance(MIN)
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^0 %$/ }))?.text).toBe('0 %')
  await ui.unmount()
})

test('Sitzungsstart ohne gemeldete Fenster: gemerkter Stand aus früheren Sitzungen', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: [] }, {
    'seenWindows.v1': { sevenDay: { at: NOW - D, percent: 41, resetsAt: NOW + 2 * D } },
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await labels(ui)).toEqual(['Kontext', 'Cache', '7 Tage'])
  expect((await ui.find({ type: 'Text', text: /^41 %$/ }))?.text).toBe('41 %')
  await ui.unmount()
})

test('Gemerktes Fenster: nach mehr als 7 Tagen ohne Meldung kein Balken', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: [] }, {
    'seenWindows.v1': { fiveHour: { at: NOW - 8 * D, percent: 23 }, sevenDay: { at: NOW - 8 * D, percent: 41 } },
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await labels(ui)).toEqual(['Kontext', 'Cache'])
  await ui.unmount()
})

test('Speicher nicht lesbar: das Band zeigt trotzdem die gemeldeten Fenster', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: windows([23, 3 * H]) }, null)
  on('store.get', () => {
    throw new Error('Speicher kaputt')
  })
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await labels(ui)).toEqual(['Kontext', 'Cache', '5 Std'])
  expect((await ui.find({ type: 'Text', text: /^23 %$/ }))?.text).toBe('23 %')
  await ui.unmount()
})

test('Prüfbefehl zeigt gemeldete, gespeicherte und gemerkte Fenster', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: windows([23, 3 * H]) })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const result = (await $.command.run({ command: 'kontext-cache-band-limits', args: '' } as never)) as { text: string }
  expect(result.text).toBe(
    [
      'Abfragezeitpunkt (UTC): 2026-10-29T10:00:00.000Z',
      '',
      'Von Claude Code gemeldet (rateLimits, Anzahl 1):',
      '  {"kind":"five_hour","percentUsed":23,"resetsAt":"2026-10-29T13:00:00.000Z"}',
      '  seven_day: nicht gemeldet',
      '',
      'Vom Mod zuletzt gespeichert (Grundlage der Fußzeile):',
      '  fiveHour: 23 %, Zurücksetzung 2026-10-29T13:00:00.000Z',
      '  sevenDay: nichts',
      '',
      'Über Sitzungen gemerkt (seenWindows.v1, Balken bis 7 Tage nach der letzten Meldung):',
      '  fiveHour: 23 %, zuletzt gemeldet 2026-10-29T10:00:00.000Z, Zurücksetzung 2026-10-29T13:00:00.000Z',
      '  sevenDay: nichts',
    ].join('\n'),
  )
})

test('Prüfbefehl ohne Abo-Fenster', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, {})
  engine(on, { ...USAGE, rateLimits: [] })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const result = (await $.command.run({ command: 'kontext-cache-band-limits', args: '' } as never)) as { text: string }
  expect(result.text).toContain('rateLimits, Anzahl 0')
  expect(result.text).toContain('  five_hour: nicht gemeldet\n  seven_day: nicht gemeldet')
  expect(result.text).toContain('  fiveHour: nichts\n  sevenDay: nichts')
})

// ---- Warm halten ----------------------------------------------------------------

async function firstRequest($: Engine) {
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 } as never)) {
    // nur durchlaufen
  }
}

const runWarm = ($: Engine, args: string) =>
  $.command.run({ command: 'cache-keep-warm', args } as never)

// Spult zwei Stunden im Sekundentakt vor: braucht mehr als die üblichen 5 s
test('Warm halten: frischt kurz vor Ablauf auf und endet mit dem Zeitfenster', { timeoutMs: 30_000 }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, {})
  engine(on)
  await firstRequest($)

  const started = await runWarm($, '2h')
  expect(started.text).toContain('Cache wird 2 h lang warm gehalten. Die erste Auffrischung folgt in 55 min.')

  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // Warm-Zeile: Balken des Fensters (voll), Restzeit, Zahl der Auffrischungen, Knopf
  expect(await ui.find({ type: 'Text', text: /^Warm$/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^2:00$/ }))?.props.color).toBe('success')
  expect((await ui.find({ type: 'Text', text: /×$/ }))?.text).toBe('· 0×')
  expect(units(await svgOf(ui, /^Cache warm halten/), '#4CB05A')).toBe(10)
  expect(await ui.find({ type: 'Button', key: 'keep-warm-stop' })).toBeDefined()
  // Die Erklärtexte von früher stehen nicht mehr da
  expect(await ui.find({ type: 'Text', text: /aktiv|nächste in/ })).toBeUndefined()
  await ui.unmount()

  // Bei 55 min die erste Auffrischung, die Restzeit beginnt von vorn
  await clock.advance(55 * 60_000 + 2_000)
  expect(forks).toBe(1)
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /×$/ }))?.text).toBe('· 1×')
  expect((await ui.find({ type: 'Text', text: /^5\d:\d\d$|^60:00$/ }))?.text).toMatch(/^(59:5\d|60:00)$/)
  await ui.unmount()

  // Bei 1 h 50 die zweite; danach hält der Cache bis Fensterende, keine dritte
  await clock.advance(55 * 60_000)
  expect(forks).toBe(2)
  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await terminal.find({ type: 'Text', text: /×$/ }))?.text).toBe('· 2×')
  expect(await terminal.find({ type: 'Text', text: /^Warm$/ })).toBeDefined()
  await terminal.unmount()

  await clock.advance(11 * 60_000)
  expect(forks).toBe(2)
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Warm$/ })).toBeUndefined()
  await ui.unmount()
})

test('Warm halten: Beenden im Band und per Befehl', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, {})
  engine(on)
  await firstRequest($)

  await runWarm($, '90m')
  for (const surface of ['terminal', 'desktop'] as const) {
    await runWarm($, '90m')
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^1:30$/ }))?.text).toBe('1:30')
    await ui.press({ key: 'keep-warm-stop' })
    expect(await ui.find({ type: 'Text', text: /^Warm$/ })).toBeUndefined()
    await ui.unmount()
  }

  expect((await runWarm($, 'stop')).text).toBe('Cache warm halten läuft nicht.')
  await runWarm($, '1:30')
  expect((await runWarm($, '')).text).toContain('läuft noch 1 h 30 min')
  expect((await runWarm($, 'aus')).text).toBe('Cache warm halten beendet (0× aufgefrischt).')
})

test('Warm halten: Dauer-Angaben', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, {})
  engine(on)
  await firstRequest($)

  const cases: Array<[string, string]> = [
    ['45', '45 min'],
    ['1h30m', '1 h 30 min'],
    ['1h30', '1 h 30 min'],
    ['1,5h', '1 h 30 min'],
    ['2 std', '2 h'],
    ['', '1 h'],
  ]
  for (const [args, span] of cases) {
    await runWarm($, 'stop')
    expect((await runWarm($, args)).text).toContain(`Cache wird ${span} lang warm gehalten`)
  }
  for (const bad of ['3x', '25h', '0', 'h']) {
    expect((await runWarm($, bad)).text).toContain('Unbekannte Dauer')
  }
})

test('Warm halten: Fehler zeigt Hinweis und versucht nach 30 s erneut', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, { CLAUDE_CODE_PROMPT_CACHE_TTL: '5m' })
  engine(on)
  await firstRequest($)

  await runWarm($, '1h')
  forkAnswer = {
    isAnswered: false,
    reason: 'api-error',
    status: 529,
    error: 'overloaded_error',
    usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm' },
  }
  // 5-min-TTL: Auffrischung 1 min vor Ablauf
  await clock.advance(4 * 60_000 + 2_000)
  expect(forks).toBe(1)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const error = await ui.find({ type: 'Text', text: /fehlgeschlagen/ })
  expect(error?.text).toBe('Auffrischung fehlgeschlagen (529)')
  expect(error?.props.color).toBe('warning')
  await ui.unmount()

  forkAnswer = FORK_OK
  await clock.advance(15_000)
  expect(forks).toBe(1)
  await clock.advance(16_000)
  expect(forks).toBe(2)
})

test('Warm halten: ohne Gespräch zum Auffrischen endet es', { timeoutMs: 30_000 }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, {})
  engine(on)
  await firstRequest($)

  await runWarm($, '3h')
  forkAnswer = { isAnswered: false, reason: 'nothing-to-fork' }
  await clock.advance(55 * 60_000 + 2_000)
  expect(forks).toBe(1)
  expect((await runWarm($, 'stop')).text).toBe('Cache warm halten läuft nicht.')
})

test('Warm halten: /clear beendet es', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, {})
  engine(on)
  await firstRequest($)

  await runWarm($, '2h')
  await $.session.end({ reason: 'clear' } as never)
  expect((await runWarm($, 'stop')).text).toBe('Cache warm halten läuft nicht.')
})

