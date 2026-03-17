# Obsidian Claude Plugin — Design Document

**Version:** 0.1 (Initial)  
**Status:** Pre-development  
**Author:** Scott  

---

## Overview

An Obsidian plugin that brings Claude Code's agentic file management capabilities into the Obsidian environment. The entire vault serves as the project context, with Claude able to read, write, create, move, and organize notes — while the user retains precise control over what Claude can see, touch, and remember.

The plugin is designed to be shareable: any user with Claude Code installed and authenticated (Pro or Max subscription) can use it with no additional API keys or billing setup.

---

## Goals

- Replicate the Claude Code / VS Code panel experience inside Obsidian
- Make the full vault available as Claude's working context
- Provide intelligent, user-controlled context injection rather than brute-force full-vault loading
- Store all session data inside the vault for portability and version control
- Support the kind of writing, planning, organizing, and scripting workflows that Obsidian users actually do — not just code

---

## Non-Goals (v1)

- Mobile support (desktop only, Electron/Node requirement)
- Multi-vault support
- Direct Anthropic API integration (this plugin uses the Claude Code CLI subprocess exclusively)
- Real-time collaboration

---

## Architecture

### Integration Approach

The plugin communicates with Claude exclusively via the **Claude Code CLI binary** (`claude`), spawned as a child process using Node.js `child_process`. This approach:

- Requires no API key — rides the user's existing Pro/Max subscription
- Is distributable to anyone with Claude Code installed
- Gives Claude full OS-level file access to the vault
- Is the same approach used by Cline and Zed

The plugin does **not** use the Anthropic Messages API directly, and does **not** use the Claude Agent SDK (which requires an API key and explicitly prohibits subscription-based third-party auth).

### Process Model

```
Obsidian (Electron renderer)
  └── child_process.spawn('claude', args, { cwd: vaultRoot, env: resolvedEnv })
        └── claude CLI process
              ├── reads/writes vault files directly
              ├── executes bash commands
              └── streams output back via stream-json format
```

The plugin:
1. Resolves the user's full shell environment at startup (via `bash -l -c env`) to ensure PATH is correct
2. Detects the `claude` binary location across OS/install variations
3. Spawns claude with `--output-format stream-json` and `--print` for non-interactive use
4. Manages conversation turns by building and passing message history
5. Intercepts tool calls before execution when frontmatter protection rules apply

### Session Storage

All session data lives inside the vault under `.obsidian/claude/`:

```
.obsidian/
  claude/
    sessions/
      2025-02-27T14-32-00_initial-vault-setup.json
      2025-02-27T16-45-00_blog-post-draft.json
      ...
    current-session.json   ← symlink or pointer to active session
```

Each session file contains:
- Session ID, title, created/updated timestamps
- Full conversation turn history (role, content, tool calls, tool results)
- Active pinned context file list for that session
- Model/settings snapshot

This makes sessions vault-portable, version-controllable, and independent of the global `~/.claude/` store.

### Context File (Replaces CLAUDE.md)

Claude Code's native `CLAUDE.md` convention is **not used**. Instead, the plugin manages its own context file at a user-configurable path (default: `_claude-context.md` at vault root, or any path set in plugin settings).

On each session start, the plugin:
1. Reads the configured context file (if it exists)
2. Reads the vault folder tree (collapsed to configurable depth)
3. Reads any always-pinned notes
4. Assembles a system prompt and injects it when spawning claude

This keeps the vault root clean and gives the user full control over naming and location.

---

## Features

### 1. Chat Panel

A sidebar or split panel (user preference) that provides the conversation interface.

**UI elements:**
- Message thread (user and Claude turns, rendered markdown)
- Streaming text display — Claude's responses render incrementally as tokens arrive
- Tool execution visibility — shows when Claude is reading/writing files, running commands
- Input area with send button and keyboard shortcut
- Session title (editable)
- `+` button for new conversation
- Session history access (list of past sessions)

**User stories:**
- *As a user, I want to type a message and see Claude's response stream in real time, like in the Claude.ai interface.*
- *As a user, I want to see when Claude is performing file operations so I know what it's doing.*
- *As a user, I want to start a new conversation without losing my history of past conversations.*

---

### 2. Session Management

**Behavior:**
- On plugin load, the last active session is automatically resumed (no re-briefing required)
- `+` starts a new session; the previous session is saved to `.obsidian/claude/sessions/`
- Session titles are auto-generated from the first user prompt (first ~60 chars) or manually editable
- A session picker (accessible from the panel header) lists past sessions with title and timestamp

**User stories:**
- *As a user, I want to reopen Obsidian and continue exactly where I left off without any setup.*
- *As a user, I want to find and resume a conversation I had last week about a specific topic.*
- *As a user, I want to give my sessions meaningful names so I can find them later.*

---

### 3. Context Management

Context is the information injected into Claude's awareness at session start and/or on each turn. There are four layers:

#### 3a. Vault Structure (Always Injected)

A folder tree of the vault, collapsed to a configurable depth (default: 2-3 levels). Gives Claude navigational awareness without content cost. Injected once at session start.

#### 3b. Vault Context File (Persistent Project Memory)

A single markdown file (path configurable in settings) that serves as Claude's persistent orientation doc — vault structure, conventions, ongoing threads, current focus areas. Claude is instructed to maintain this file as the project evolves.

**User workflow:** On a new project, the user gives Claude a few orientation notes, Claude generates the context file, and maintains it autonomously going forward. Survives across sessions as the stable memory layer.

#### 3c. Pinned Context (Session or Permanent)

Individual notes can be added to Claude's context explicitly:

- **Permanent pins** — always injected, every session. Set via plugin settings or via note frontmatter (`claude.context: always`). Good for reference docs, style guides, taxonomies.
- **Session pins** — added for the current conversation only, cleared on `+`. Good for "read this meeting transcript while we discuss this project."

**UI:** A context panel or drawer in the chat UI showing currently active context files. Notes can be added via:
- Right-click context menu in Obsidian file explorer → "Pin to Claude context"
- Drag into context panel
- Inline command from within a note

#### 3d. Inline Selection Context

Highlight text in any note → command/right-click → "Send to Claude as context." Injects the selected text into the current session without leaving the note. Distinct from sending it as a prompt.

**User stories:**
- *As a user, I want Claude to always know my vault's organizational conventions without me explaining them every session.*
- *As a user, I want to temporarily add a reference document to a conversation without it persisting forever.*
- *As a user, I want to highlight a paragraph and add it to Claude's context without copy-pasting.*
- *As a user, I want to see exactly what context Claude currently has access to.*

---

### 4. Per-Note Frontmatter Instructions

Notes can carry Claude-specific metadata in their YAML frontmatter. The plugin reads this metadata before executing any tool call involving the file.

**Supported frontmatter schema:**

```yaml
---
claude:
  readonly: true
  protect: true
  instructions: "This is the canonical taxonomy. Suggest changes but never apply them directly."
  context: always
---
```

**Field definitions:**

| Field | Type | Behavior |
|-------|------|----------|
| `readonly` | boolean | Claude cannot write to this file. Any write attempt is blocked and the user is notified. |
| `protect` | boolean | Alias for `readonly`. Plugin intercepts write tool calls before execution. |
| `instructions` | string | Injected as context whenever this file is read or referenced in a session. |
| `context: always` | string | This note is permanently pinned to every session automatically. |
| `context: never` | string | This note is never read by Claude, even if asked. |

**User stories:**
- *As a user, I want to mark my master index note as read-only so Claude can never accidentally overwrite it.*
- *As a user, I want to attach instructions to a note so Claude knows how to handle it without me explaining every time.*
- *As a user, I want certain reference notes to always be in Claude's context automatically.*
- *As a user, I want to exclude sensitive notes from Claude's access entirely.*

---

### 5. Vault-Aware Tool Execution

When Claude executes file operations, the plugin mediates through the Obsidian vault API rather than raw filesystem calls where possible. This ensures:

- Obsidian's metadata cache stays updated (backlinks, tags, etc.)
- File events propagate correctly within Obsidian
- Frontmatter protection rules are enforced before writes execute

For bash/shell execution, commands run in the OS environment with the vault root as working directory.

---

### 6. Plugin Settings

Accessible via Obsidian's standard Settings → Community Plugins → Claude panel.

| Setting | Default | Description |
|---------|---------|-------------|
| Claude binary path | Auto-detected | Override if auto-detection fails |
| Context file path | `_claude-context.md` | Vault-relative path to the persistent context file |
| Vault tree depth | `3` | How many folder levels to include in initial tree injection |
| Panel position | Sidebar | Sidebar or split pane |
| Session storage location | `.obsidian/claude/sessions/` | Where session files are written |
| Always-pinned notes | (empty list) | Notes permanently injected into every session |
| Inject context on every turn | `false` | Re-inject pinned context each turn (more reliable, more tokens) vs. once at session start |
| Shell for env resolution | `bash` | Shell used to resolve PATH at startup |

---

## Technical Specifications

### Prerequisites (User)

- Obsidian desktop (not mobile)
- Node.js accessible in environment (for child_process)
- Claude Code CLI installed and authenticated (`claude login` completed)
- Pro or Max Claude subscription

### Build Stack

- TypeScript
- esbuild (bundler, standard for Obsidian plugins)
- Obsidian Plugin API
- Node.js built-ins: `child_process`, `path`, `os`, `fs`
- No external npm runtime dependencies (everything bundled)

### Binary Detection

At plugin startup, the following locations are checked in order:

1. User-configured path (settings override)
2. `which claude` via shell resolution
3. `~/.local/bin/claude` (Linux/Mac default native install)
4. `~/.npm-global/bin/claude` (npm install fallback)
5. Windows: `%USERPROFILE%\.local\bin\claude.exe`

If not found, the plugin displays a setup prompt with installation instructions.

### Environment Resolution

To ensure correct PATH inheritance:

```typescript
const env = await resolveShellEnv(); // spawns bash -l -c env, parses output
// used for all subsequent claude process spawns
```

Cached at startup, not re-resolved per spawn.

### Stream-JSON Parsing

Claude is spawned with `--output-format stream-json`. Output is parsed incrementally:

- Text delta blocks → appended to current message display in real time
- Tool use blocks → displayed as tool call indicators in the UI
- Tool result blocks → shown as execution feedback
- End turn signals → mark message complete

### Frontmatter Interception

Before Claude executes a write tool call, the plugin:
1. Identifies the target file path
2. Reads frontmatter via `app.metadataCache`
3. Checks `claude.readonly` and `claude.protect` fields
4. If protected: blocks the call, injects a message to Claude explaining the restriction
5. If not protected: allows the call to proceed

---

## Session File Format

```json
{
  "id": "2025-02-27T14-32-00",
  "title": "Reorganize Projects folder structure",
  "created": "2025-02-27T14:32:00Z",
  "updated": "2025-02-27T15:14:22Z",
  "contextFile": "_claude-context.md",
  "pinnedNotes": ["Reference/Style-Guide.md"],
  "turns": [
    {
      "role": "user",
      "content": "Let's reorganize the Projects folder...",
      "timestamp": "2025-02-27T14:32:01Z"
    },
    {
      "role": "assistant",
      "content": "I'll start by reading the current structure...",
      "toolCalls": [...],
      "timestamp": "2025-02-27T14:32:08Z"
    }
  ]
}
```

---

## Open Questions / Decisions Deferred to Implementation

1. **Context injection strategy** — inject pinned notes once at session start, or re-inject on every turn? Tradeoff: reliability vs. token cost. Consider making this a setting.

2. **Compaction handling** — when Claude's context window fills, it compacts automatically. The plugin should detect compaction events in the stream and possibly notify the user, since early-conversation instructions can get summarized away.

3. **Concurrent sessions** — should the plugin support multiple active sessions in different panels? Probably not v1, but worth noting.

4. **Vault context file auto-generation** — should the plugin prompt the user to create a context file on first launch if none exists? Or let Claude generate one from an onboarding prompt?

5. **`.obsidian/` gitignore** — sessions in `.obsidian/` are typically gitignored. Is this the right behavior? Some users may want session history under version control. Consider making storage location configurable to enable this.

6. **Permission prompts** — Claude Code sometimes pauses to ask permission mid-task. The plugin needs a UI pattern for surfacing and responding to these prompts inline.

7. **`context: never` enforcement** — how does the plugin prevent Claude from reading a protected file if the user asks Claude to read it directly? Needs a clear UX decision.

---

## Future Directions (Post-v1)

- **Dataview / metadata awareness** — give Claude access to query the vault's metadata graph, not just file contents
- **Template integration** — Claude generates new notes using the user's existing Templater templates
- **Git integration** — commit messages, branch summaries, change review
- **Multi-context profiles** — saved sets of pinned notes for different workflow modes (writing mode, planning mode, research mode)
- **Slash commands** — custom `.obsidian/claude/commands/` directory, mirroring Claude Code's command pattern
- **Canvas integration** — read and generate Obsidian Canvas files

---

## Appendix: Frontmatter Examples

**Protected reference document:**
```yaml
---
claude:
  readonly: true
  context: always
  instructions: "This is the canonical project taxonomy. Reference it when organizing notes. Never modify it."
---
```

**Meeting note (session context only):**
```yaml
---
claude:
  instructions: "This is a raw meeting transcript. Extract action items and decisions but don't reformat the note itself."
---
```

**Sensitive note (excluded from Claude):**
```yaml
---
claude:
  context: never
---
```

**Style guide (always present):**
```yaml
---
claude:
  context: always
---
```
