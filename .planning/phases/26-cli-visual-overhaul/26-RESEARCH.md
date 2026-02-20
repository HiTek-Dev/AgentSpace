# Phase 26: CLI Visual Overhaul - Research

**Researched:** 2026-02-20
**Domain:** Ink terminal UI, syntax highlighting, input handling, component architecture
**Confidence:** HIGH

## Summary

Phase 26 transforms the existing Ink-based CLI chat from a functional but plain interface into a polished, information-dense experience matching Claude Code quality. The codebase is well-structured for this work: `Chat.tsx` orchestrates `StatusBar`, `MessageList`, `StreamingResponse`, and `InputBar` as separate components, and the `useChat` hook already tracks message types (`text`, `tool_call`, `bash_command`, `reasoning`) with timestamps. The main work is enhancing these existing components, not creating new architecture.

The critical technical challenge is integrating shiki syntax highlighting into the synchronous `marked-terminal` rendering pipeline. `@shikijs/cli`'s `codeToANSI()` is async, but `marked-terminal` requires synchronous renderers. The solution is to pre-initialize a synchronous shiki highlighter using `createHighlighterCoreSync` with the JavaScript regex engine, then write a thin sync wrapper that calls `highlighter.codeToTokensBase()` and applies ANSI colors via `ansis` — the same pattern `@shikijs/cli` uses internally, but without the async overhead. This replaces the current `cli-highlight` dependency entirely.

The second major concern is Ink's `<Static>` component contract. `MessageList` uses `<Static>` for append-only rendering — items rendered inside it cannot be updated. This means collapsible tool panels (CLIV-02) cannot live inside `<Static>`. The solution is to render tool calls as collapsed-only summaries inside `<Static>`, or to move interactive/expandable items outside `<Static>` into the live render region. The research on Ink pitfalls (from the project's own PITFALLS.md) strongly warns against putting any stateful components inside `<Static>`.

**Primary recommendation:** Pre-initialize shiki synchronously at CLI startup, replace `cli-highlight` with a custom sync `codeToAnsi` function, build collapsible panels outside `<Static>`, and implement a custom multiline TextInput using Ink's `useInput` hook since `@inkjs/ui`'s `TextInput` does not support multiline.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLIV-01 | Code blocks in CLI chat display syntax highlighting via shiki | Use `createHighlighterCoreSync` + JS regex engine for sync highlighting. Write custom `codeToAnsi` using `codeToTokensBase()` + `ansis`. Override `marked-terminal`'s highlight option. Remove `cli-highlight` dependency. |
| CLIV-02 | Tool call panels are collapsible -- default collapsed showing tool name + status, expand to show args/output | Custom Ink component with `useState` + `useInput`. MUST NOT be inside `<Static>` — keep as live render region below message history, or render collapsed-only summaries in Static and expand only the most recent tool call in live region. |
| CLIV-03 | User can cycle through previous messages with up/down arrow keys in input | Replace `@inkjs/ui` `TextInput` with custom input component using `useInput` hook. Maintain history array in `useChat` or a new `useInputHistory` hook. `key.upArrow`/`key.downArrow` detected via `useInput`. |
| CLIV-04 | Tool output truncated at ~20 lines with "... (N more lines)" indicator | Truncation logic in `MessageBubble` for `tool_call` and `bash_command` types. Split output by newlines, show first 20, append dimmed count. Pure render logic — no state needed, safe inside `<Static>`. |
| CLIV-05 | Empty chat state shows welcome message with agent name, slash commands, and keyboard shortcuts | Conditional render in `Chat.tsx` when `messages.length === 0 && !isStreaming`. Use `DISPLAY_NAME` from `@tek/core`. List slash commands from `HELP_TEXT` in `useSlashCommands.ts`. |
| CLIV-06 | Messages display timestamps (HH:MM) right-aligned and dimmed | Messages already have `timestamp: string` (ISO format). Parse and format as HH:MM in `MessageBubble`. Use Ink's `Box justifyContent="space-between"` for right-alignment. |
| CLIV-07 | User can enter multi-line input (Shift+Enter for newline, Enter to submit) | `@inkjs/ui` `TextInput` is single-line only with no multiline support. Build custom input using `useInput` hook — detect `key.return` with `key.shift` for newline insertion, `key.return` without shift for submit. |
| CLIV-08 | StatusBar redesigned with multi-zone layout: logo/connection, model/provider, token count + cost in compact format | Enhance existing `StatusBar.tsx`. Three `<Box>` zones with `justifyContent="space-between"`. Already has connection status, model, and usage — restructure layout and add logo/provider zone. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `shiki` | `^3.22.0` | Syntax highlighting engine | VS Code TextMate grammars. `createHighlighterCoreSync` enables synchronous highlighting after one-time init. Replaces abandoned `cli-highlight`. 15M+ weekly downloads. ESM-only (matches project). |
| `@shikijs/langs` | `^3.22.0` | Individual language imports | Import specific language grammars as plain objects for sync highlighter init. Avoids bundling all 200+ languages. |
| `@shikijs/themes` | `^3.22.0` | Individual theme imports | Import specific theme as plain object for sync highlighter init. Use `github-dark` or `nord` for terminal readability. |
| `ansis` | `^4.0.0` | ANSI escape code styling | Used by shiki's own `codeToAnsi` internally. Lightweight alternative to chalk for token-level coloring. Already a transitive dep of `@shikijs/cli`. |

### Already Installed (no changes needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `ink` | `^6.0.0` | React for terminal | Provides `useInput`, `Box`, `Text`, `Static`. Core framework. |
| `@inkjs/ui` | `^2.0.0` | Ink component library | `Spinner` used in `StreamingResponse`. `TextInput` used in `InputBar` — will be replaced with custom component for multiline. |
| `marked` | `^15.0.12` | Markdown parser | Used in `lib/markdown.ts` with `marked-terminal`. |
| `marked-terminal` | `^7.3.0` | Terminal markdown renderer | Accepts highlight options as second arg to `markedTerminal()`. |
| `chalk` | `^5.0.0` | Terminal string styling | Used for basic coloring. Keep for non-highlighting use. |

### To Remove

| Library | Reason |
|---------|--------|
| `cli-highlight` | Replaced by shiki. Uses highlight.js regex grammars (weaker than TextMate). Unmaintained since 2022. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `shiki` sync highlighter | `@shikijs/cli` `codeToANSI()` directly | `codeToANSI` is async — cannot be used inside `marked-terminal`'s synchronous renderer. Would require switching to `marked.parseAsync()` and making entire render pipeline async. Not worth the complexity. |
| Custom multiline input | `ink-multiline-input` (v0.1.0) | Published Dec 2025, 1 star, 1 contributor. Too immature for production. Building custom is ~80 lines and gives full control. |
| Custom collapsible panels | No mature Ink library exists | `@inkjs/ui` has no accordion/collapsible. Terminal has no click events — toggling is keyboard-driven. ~40-line custom component is correct. |

**Installation:**
```bash
pnpm --filter @tek/cli add shiki@^3.22.0 ansis@^4.0.0
pnpm --filter @tek/cli remove cli-highlight
```

Note: `@shikijs/langs` and `@shikijs/themes` are sub-exports of `shiki` — no separate install needed. Import as `import js from 'shiki/langs/javascript'` and `import nord from 'shiki/themes/nord'`.

## Architecture Patterns

### Recommended Component Structure

```
packages/cli/src/
├── components/
│   ├── Chat.tsx              # Orchestrator (existing — add welcome screen conditional)
│   ├── StatusBar.tsx          # Multi-zone layout (existing — redesign)
│   ├── MessageList.tsx        # Static append-only list (existing — minor changes)
│   ├── MessageBubble.tsx      # Per-message rendering (existing — add timestamps, truncation)
│   ├── StreamingResponse.tsx  # Live streaming text (existing — no changes)
│   ├── InputBar.tsx           # Custom multiline input (existing — rewrite internals)
│   ├── ToolPanel.tsx          # NEW: Collapsible tool call display
│   ├── WelcomeScreen.tsx      # NEW: Empty state welcome
│   └── MarkdownRenderer.tsx   # Markdown rendering (existing — no changes)
├── hooks/
│   ├── useChat.ts             # Chat state (existing — add input history tracking)
│   ├── useInputHistory.ts     # NEW: Up/down arrow message cycling
│   └── useSlashCommands.ts    # Slash commands (existing — export HELP_TEXT)
├── lib/
│   ├── markdown.ts            # marked + marked-terminal (existing — integrate shiki)
│   ├── shiki.ts               # NEW: Sync highlighter singleton + codeToAnsi
│   └── truncate.ts            # NEW: Output truncation utility
```

### Pattern 1: Synchronous Shiki Highlighter Singleton

**What:** Initialize shiki once at module load with common languages, then use synchronously everywhere.
**When to use:** Any code block rendering in the terminal.
**Example:**

```typescript
// lib/shiki.ts
import { createHighlighterCoreSync } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { FontStyle } from '@shikijs/vscode-textmate'
import c from 'ansis'

// Import languages as plain objects for sync init
import js from 'shiki/langs/javascript'
import ts from 'shiki/langs/typescript'
import json from 'shiki/langs/json'
import bash from 'shiki/langs/bash'
import python from 'shiki/langs/python'
// Theme
import githubDark from 'shiki/themes/github-dark'

const highlighter = createHighlighterCoreSync({
  themes: [githubDark],
  langs: [js, ts, json, bash, python],
  engine: createJavaScriptRegexEngine(),
})

/**
 * Synchronous code-to-ANSI highlighting.
 * Mirrors @shikijs/cli codeToANSI but runs synchronously.
 */
export function codeToAnsiSync(code: string, lang: string): string {
  // Fall back to plaintext for unknown languages
  const loadedLangs = highlighter.getLoadedLanguages()
  const effectiveLang = loadedLangs.includes(lang) ? lang : 'text'

  const tokens = highlighter.codeToTokensBase(code, {
    lang: effectiveLang,
    theme: 'github-dark',
  })

  const theme = highlighter.getTheme('github-dark')
  let output = ''

  for (const line of tokens) {
    for (const token of line) {
      let text = token.content
      const color = token.color || theme.fg
      if (color) text = c.hex(color)(text)
      if (token.fontStyle) {
        if (token.fontStyle & FontStyle.Bold) text = c.bold(text)
        if (token.fontStyle & FontStyle.Italic) text = c.italic(text)
        if (token.fontStyle & FontStyle.Underline) text = c.underline(text)
      }
      output += text
    }
    output += '\n'
  }

  return output.replace(/\n$/, '')
}
```

Source: Implementation pattern derived from `@shikijs/cli` source code at `packages/cli/src/code-to-ansi.ts` in the shiki repository. Sync API from https://shiki.style/guide/sync-usage.

### Pattern 2: marked-terminal Shiki Integration

**What:** Override `marked-terminal`'s highlight function to use the sync shiki highlighter instead of `cli-highlight`.
**When to use:** In `lib/markdown.ts` configuration.
**Example:**

```typescript
// lib/markdown.ts
import { marked } from 'marked'
import { markedTerminal } from 'marked-terminal'
import { codeToAnsiSync } from './shiki.js'

marked.use(
  markedTerminal(
    {
      width: process.stdout.columns || 80,
      tab: 2,
      reflowText: true,
    },
    {
      // Override cli-highlight with shiki
      highlight: (code: string, lang: string) => codeToAnsiSync(code, lang),
    },
  ),
)
```

Source: `marked-terminal` accepts highlight options as second parameter per https://github.com/mikaelbr/marked-terminal README.

### Pattern 3: Collapsible Tool Panel (Outside Static)

**What:** Interactive toggle component for tool call display. Collapsed shows tool name + status icon, expanded shows args and output.
**When to use:** For `tool_call` and `bash_command` message types.
**Critical constraint:** MUST NOT be inside `<Static>` — `useState` is silently dropped inside Static.

```typescript
// components/ToolPanel.tsx
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

interface ToolPanelProps {
  toolName: string
  status: 'pending' | 'complete' | 'error'
  input: string
  output?: string
  isFocused?: boolean
}

export function ToolPanel({ toolName, status, input, output, isFocused }: ToolPanelProps) {
  const [expanded, setExpanded] = useState(false)

  useInput((_, key) => {
    if (isFocused && key.return) {
      setExpanded(prev => !prev)
    }
  }, { isActive: isFocused })

  const icon = expanded ? '▼' : '▶'
  const statusIcon = status === 'complete' ? '✓' : status === 'error' ? '✗' : '⋯'
  const statusColor = status === 'complete' ? 'green' : status === 'error' ? 'red' : 'yellow'

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text>{icon} </Text>
        <Text bold color="blue">{toolName}</Text>
        <Text color={statusColor}> {statusIcon}</Text>
      </Box>
      {expanded && (
        <Box flexDirection="column" marginLeft={2}>
          <Text dimColor>{input}</Text>
          {output && <Text>{truncateOutput(output, 20)}</Text>}
        </Box>
      )}
    </Box>
  )
}
```

### Pattern 4: Custom Multiline Input with History

**What:** Replace `@inkjs/ui` `TextInput` with custom component supporting Shift+Enter for newlines and up/down for history.
**When to use:** InputBar replacement.

```typescript
// Simplified pattern — full implementation will manage cursor position,
// line array, and render with proper line breaks
import { useInput } from 'ink'

useInput((input, key) => {
  if (key.return && !key.shift) {
    // Submit
    onSubmit(text)
    setText('')
    return
  }
  if (key.return && key.shift) {
    // Insert newline
    setText(prev => prev + '\n')
    return
  }
  if (key.upArrow && text === '') {
    // Cycle history backward (only when input is empty)
    const prev = historyBack()
    if (prev) setText(prev)
    return
  }
  if (key.downArrow && text === '') {
    // Cycle history forward
    const next = historyForward()
    setText(next ?? '')
    return
  }
  // Regular character input
  if (input && !key.ctrl && !key.meta) {
    setText(prev => prev + input)
  }
  if (key.backspace) {
    setText(prev => prev.slice(0, -1))
  }
})
```

Source: Ink `useInput` API from https://github.com/vadimdemedes/ink. Key properties: `key.return`, `key.shift`, `key.upArrow`, `key.downArrow`, `key.backspace`, `key.ctrl`, `key.meta`.

### Anti-Patterns to Avoid

- **Stateful components inside `<Static>`:** Static items render once and never update. Any `useState`, `useEffect`, or `useInput` inside Static children is silently ignored. This is the #1 risk for this phase.
- **Async rendering in marked pipeline:** `marked.parse()` with `marked-terminal` is synchronous. Adding any async extension (including shiki's async `codeToANSI`) will cause `marked.parse()` to return a Promise, which the current code casts to string (silent breakage per Pitfall 7 in PITFALLS.md).
- **Full language bundle:** Importing all shiki languages bloats the bundle and slows startup. Import only the 8-10 most common languages as individual modules.
- **Spinner during streaming:** Adding animated components alongside `StreamingResponse` doubles the render rate. Only use `Spinner` during the waiting-for-first-token phase (already correct in current code).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Syntax highlighting | Custom regex-based tokenizer | shiki `createHighlighterCoreSync` | TextMate grammars handle 200+ languages with edge cases (template literals, JSX, embedded languages) that regex solutions miss. |
| ANSI color application | Manual escape code construction | `ansis` library | Correct handling of 256-color and truecolor terminals, proper reset sequences, nested style composition. |
| Markdown-to-terminal | Custom markdown parser | `marked` + `marked-terminal` | Already installed and working. Handles tables, lists, blockquotes, inline code, links. |
| Terminal width detection | Hardcoded width | `process.stdout.columns` | Already used in markdown.ts. Handles resize events. |
| Key detection | Raw stdin parsing | Ink's `useInput` hook | Handles escape sequences, modifier keys, special keys across terminal emulators. |

**Key insight:** The terminal rendering stack (marked + marked-terminal + shiki) is already largely in place. The phase is about wiring shiki into the existing pipeline and building thin UI components, not creating new infrastructure.

## Common Pitfalls

### Pitfall 1: Shiki Async in Sync Pipeline

**What goes wrong:** Using `@shikijs/cli`'s `codeToANSI()` (async) inside `marked-terminal`'s synchronous highlight callback. The highlight function returns a Promise object, which gets `.toString()`'d as `[object Promise]` in the terminal output.
**Why it happens:** The obvious import path is `@shikijs/cli` which exports async functions. Shiki's documentation leads with async examples.
**How to avoid:** Use `createHighlighterCoreSync` with `createJavaScriptRegexEngine()` from `shiki/core` and `shiki/engine/javascript`. Call `highlighter.codeToTokensBase()` synchronously. Write a custom ~30-line `codeToAnsiSync()` function.
**Warning signs:** Code blocks display `[object Promise]` in the terminal. `typeof result === 'string'` check in `renderMarkdown` fails.

### Pitfall 2: Static Component State Swallowing

**What goes wrong:** Adding `useState` for expand/collapse inside `MessageBubble` (which renders inside `<Static>`). The toggle appears to do nothing — the collapsed/expanded state change is silently dropped.
**Why it happens:** Ink's `<Static>` renders items once and commits them to terminal history permanently. React state updates don't trigger re-renders for committed items.
**How to avoid:** Keep `MessageBubble` stateless. Collapsible tool panels must live outside `<Static>` in the live render region. Alternative: render tool calls as collapsed-only summaries inside Static (one-line with tool name and status), with no expand capability for historical messages.
**Warning signs:** `useState` or `useInput` appears inside any component rendered within `<Static>`.

### Pitfall 3: TextInput Replacement Losing Edge Cases

**What goes wrong:** Custom input component misses edge cases: cursor positioning on multiline, paste handling, Unicode characters, terminal control sequences.
**Why it happens:** `@inkjs/ui` `TextInput` handles many edge cases internally. A naive replacement using only `useInput` misses paste events, wide characters (CJK), and cursor movement within lines.
**How to avoid:** Start with the simplest possible custom input (single buffer, append-only with backspace). Add multiline support (Shift+Enter) as a second step. Do not try to support mid-text cursor movement in the first iteration — append-only with backspace is sufficient for a chat input.
**Warning signs:** Pasting text produces character-by-character rendering artifacts. CJK or emoji characters break line width calculations.

### Pitfall 4: Shiki Language Bundle Size

**What goes wrong:** Importing `shiki` with all bundled languages causes 3-5 second cold start delay.
**Why it happens:** Shiki bundles 200+ language grammars. Importing them all triggers synchronous parsing of all grammar definitions.
**How to avoid:** Import individual languages: `import ts from 'shiki/langs/typescript'`. Start with 8-10 languages: typescript, javascript, json, bash, python, css, html, yaml, markdown. Add others lazily if needed.
**Warning signs:** `tek chat` command takes >2 seconds to display the first prompt.

### Pitfall 5: Terminal Overflow During Rich Rendering

**What goes wrong:** Adding borders, multi-line status bars, and expanded tool panels pushes rendered height past `process.stdout.rows`, triggering Ink's full-screen clear and destroying scroll history.
**Why it happens:** Ink redraws the entire viewport when output height >= terminal rows. StatusBar with border (3 lines) + expanded tool panel (10+ lines) + InputBar (2+ lines for multiline) easily exceeds 24 rows.
**How to avoid:** Calculate available rows dynamically. Cap tool output truncation relative to terminal height. Keep StatusBar to exactly 1 line (remove border, use inline separators). Test with a 20-row terminal.
**Warning signs:** Terminal history disappears after a few messages. Screen flickers during streaming.

## Code Examples

### Output Truncation Utility

```typescript
// lib/truncate.ts
export function truncateOutput(output: string, maxLines = 20): string {
  const lines = output.split('\n')
  if (lines.length <= maxLines) return output
  const shown = lines.slice(0, maxLines).join('\n')
  const remaining = lines.length - maxLines
  return `${shown}\n... (${remaining} more lines)`
}
```

### Timestamp Formatting

```typescript
// In MessageBubble.tsx
function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

// Usage in render:
<Box justifyContent="space-between">
  <Text bold color="cyan">{"> "}</Text>
  <Text dimColor>{formatTimestamp(message.timestamp)}</Text>
</Box>
```

### Welcome Screen

```typescript
// components/WelcomeScreen.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { DISPLAY_NAME } from '@tek/core'

export function WelcomeScreen() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">{DISPLAY_NAME}</Text>
      <Text dimColor>Type a message to start chatting, or use a command:</Text>
      <Text>{''}</Text>
      <Text>  /help     Show all commands</Text>
      <Text>  /model    Switch model</Text>
      <Text>  /swap     Switch by alias</Text>
      <Text>  /proxy    Run terminal app</Text>
      <Text>{''}</Text>
      <Text dimColor>Enter to send | Shift+Enter for newline | Up/Down for history</Text>
    </Box>
  )
}
```

### StatusBar Multi-Zone Layout

```typescript
// Redesigned StatusBar — single line, no border, three zones
<Box justifyContent="space-between">
  {/* Zone 1: Logo + Connection */}
  <Box>
    <Text color={connected ? 'green' : 'red'}>{'● '}</Text>
    <Text bold>{DISPLAY_NAME}</Text>
  </Box>
  {/* Zone 2: Model/Provider */}
  <Text color="cyan">{shortModel}</Text>
  {/* Zone 3: Tokens + Cost */}
  <Text dimColor>
    {usage.totalTokens.toLocaleString()} tok | ${usage.totalCost.toFixed(2)}
  </Text>
</Box>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cli-highlight` (highlight.js grammars) | `shiki` (TextMate grammars) | shiki v1.0 (2024) | VS Code-quality highlighting in terminal. highlight.js misses many TypeScript/JSX tokens. |
| `ink-text-input` (separate package) | `@inkjs/ui` `TextInput` (monorepo) | ink-ui v2.0 (2024) | `TextInput` is now in `@inkjs/ui`. Still single-line only. |
| Shiki async-only | `createHighlighterCoreSync` | shiki v2.0 (2024) | Enables synchronous highlighting with JS regex engine. Critical for marked-terminal integration. |
| `chalk` for ANSI colors | `ansis` gaining adoption | 2024-2025 | `ansis` is used by shiki internally. Lighter weight. Both work fine for this use case. |

**Deprecated/outdated:**
- `cli-highlight`: Last updated 2022. Uses highlight.js v11 regex grammars. Replace with shiki.
- `ink-syntax-highlight`: Abandoned. CommonJS-only, incompatible with Ink 6 ESM.
- `ink-text-input` (standalone): Superseded by `@inkjs/ui` TextInput. The standalone package is archived.

## Open Questions

1. **Shiki JS regex engine accuracy vs Oniguruma**
   - What we know: `createJavaScriptRegexEngine()` enables fully synchronous operation. Oniguruma is more accurate but requires async WASM init.
   - What's unclear: How much highlighting quality is lost with the JS regex engine for common languages (TS, Python, bash).
   - Recommendation: Start with JS regex engine for synchronous operation. If quality gaps are noticed in testing, switch to Oniguruma with async pre-init at CLI startup (init the engine once, then use sync highlighter). The quality difference is likely negligible for common languages.

2. **Collapsible panels architecture for historical messages**
   - What we know: `<Static>` items cannot have interactive state. Current tool calls go into `<Static>` via `MessageList`.
   - What's unclear: Best UX for historical tool calls — always collapsed in Static, or render a scrollable interactive list outside Static.
   - Recommendation: Render historical tool calls as collapsed-only one-liners inside `<Static>` (tool name + status). The most recent/active tool call renders in the live region with expand/collapse capability. This avoids the Static contract violation while giving interactivity where it matters most.

3. **Custom input cursor management complexity**
   - What we know: `useInput` provides character-by-character input. Need to handle backspace, Shift+Enter, and history.
   - What's unclear: Whether mid-line cursor movement (left/right arrow within text) is needed for acceptable UX.
   - Recommendation: First iteration: append-only buffer with backspace from end. Multiline via Shift+Enter. History via up/down when buffer is empty. This covers 90% of chat input use cases. Mid-line editing can be added later if users request it.

## Sources

### Primary (HIGH confidence)
- Shiki sync usage guide: https://shiki.style/guide/sync-usage — `createHighlighterCoreSync` API, JS regex engine
- Shiki `@shikijs/cli` source: https://github.com/shikijs/shiki/blob/main/packages/cli/src/code-to-ansi.ts — `codeToANSI` implementation details
- Ink `useInput` source: https://github.com/vadimdemedes/ink/blob/master/src/hooks/use-input.ts — key properties including shift, return, arrows
- `@inkjs/ui` TextInput docs: https://github.com/vadimdemedes/ink-ui/blob/main/docs/text-input.md — confirms single-line only
- `marked-terminal` README: https://github.com/mikaelbr/marked-terminal — highlight options as second parameter
- Project PITFALLS.md: `.planning/research/PITFALLS.md` — Static contract, terminal overflow, streaming performance
- Project STACK.md: `.planning/research/STACK.md` — shiki recommendation, cli-highlight replacement rationale

### Secondary (MEDIUM confidence)
- Shiki installation guide: https://shiki.matsu.io/guide/install — available API methods (codeToHtml, codeToTokens, codeToHast)
- Ink GitHub README: https://github.com/vadimdemedes/ink — useInput hook signature, Static component behavior

### Tertiary (LOW confidence)
- `ink-multiline-input` (v0.1.0, Jan 2026): https://libraries.io/npm/ink-multiline-input — exists but too immature (1 star, 1 contributor). Not recommended.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — shiki is the established recommendation from project research (STACK.md). Sync API verified from official docs.
- Architecture: HIGH — component structure follows existing patterns. Static contract well-documented in project PITFALLS.md.
- Pitfalls: HIGH — all pitfalls verified against official Ink and shiki documentation plus project-specific research.

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable — shiki v3.x and Ink v6 are mature)
