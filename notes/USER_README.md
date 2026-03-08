# Cortex — User Guide

Cortex is an Obsidian plugin that puts a Claude Code agent inside your vault. This guide covers installation, configuration, and day-to-day use.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [First Launch](#first-launch)
- [Using the Chat Panel](#using-the-chat-panel)
- [Context System](#context-system)
- [Per-Note Frontmatter Controls](#per-note-frontmatter-controls)
- [Settings](#settings)
- [Known Limitations](#known-limitations)

---

## Requirements

- **Obsidian desktop** (Windows, Mac, or Linux) — mobile is not supported
- **Claude Code CLI** installed and authenticated
  - **Windows:** must be installed natively in PowerShell — a WSL-only install will not work
    ```powershell
    winget install Anthropic.ClaudeCode
    # or
    irm https://claude.ai/install.ps1 | iex
    ```
  - **Mac/Linux:**
    ```bash
    npm install -g @anthropic-ai/claude-code
    ```
  - Verify the install: `claude --version` should return a version number in your terminal
  - **Log in:** `claude login` — this opens a browser for OAuth authentication (one-time per environment)
  - Having Claude Code installed in WSL does **not** count — you must install and log in natively in PowerShell
- A **Claude Pro or Max subscription** — Cortex rides your existing subscription, no separate API key needed

---

## Installation

### From a Release (recommended)

1. Download `cortex-<version>.zip` from the [Releases page](https://github.com/ScottKirvan/Cortex/releases)
2. Extract the zip — you should have a `cortex/` folder containing `main.js`, `manifest.json`, and `styles.css`
3. Move the `cortex/` folder into `<your-vault>/.obsidian/plugins/`
4. In Obsidian: **Settings → Community Plugins → disable Safe Mode** (if prompted)
5. Find **Cortex** in the installed plugins list and enable it

### From Source

See [CONTRIBUTING.md](../CONTRIBUTING.md) for building from source.

---

## First Launch

After enabling the plugin:

- A **message-square icon** appears in the left ribbon — click it to open the Cortex chat panel
- Or use the Command Palette: `Cortex: Open chat`
- If Claude is not found automatically, a notice will appear — go to **Settings → Cortex** and enter the full path to your `claude` binary

---

## Using the Chat Panel

The chat panel opens as a sidebar. Type your message and press **Enter** to send, or click **Send**. Use **Shift+Enter** to insert a newline without sending. The "Send on Enter" behaviour can be toggled in **Settings → Cortex**.

Claude has access to your full vault — it can read, write, create, move, and organize notes. The vault root is Claude's working directory.

**Example prompts:**
- "Summarize the note [[Project Alpha]]"
- "Find all notes tagged #meeting from last week and create a summary note"
- "Rename all notes in the 03_Cards folder that start with 'Untitled' based on their content"
- "Create a new note in 06_Spaces called 'Q2 Goals' with an outline based on my existing goals notes"

---

## Context System

Cortex uses four layers of context to give Claude the right information at the start of each session:

### 1. Vault Tree
A folder structure overview is automatically included so Claude understands your vault layout.

### 2. Context File
A markdown file injected at the start of every session. Default path: `_claude-context.md` at your vault root. Create this file to give Claude standing instructions — your vault conventions, naming rules, recurring projects, etc.

```markdown
# My Vault Context

## Conventions
- All meeting notes go in 02_Calendar/YYYY-MM-DD format
- Projects live in 06_Spaces/Projects/
- Use #status/active and #status/done tags

## Current focus
Working on Q2 planning. Key notes: [[Q2 Goals]], [[Team Roster]]
```

The context file path is configurable in **Settings → Cortex**.

### 3. Pinned Notes
Individual notes can be permanently pinned to every session using frontmatter (see below).

### 4. Inline Selection
Highlight text in any note before sending a message — the selection is included in the prompt automatically.

---

## Per-Note Frontmatter Controls

Add a `claude:` block to any note's YAML frontmatter to control how Cortex treats it.

### `readonly` / `protect`
Prevents Claude from modifying the note. Claude can still read it.

```yaml
---
claude:
  readonly: true
---
```

### `context: always`
Pins the note — its content is injected into every session automatically.

```yaml
---
claude:
  context: always
---
```

Useful for your goals note, active project brief, or any note Claude should always be aware of.

### `context: never`
Excludes the note from Claude's access entirely. Claude will not read or write this note.

```yaml
---
claude:
  context: never
---
```

Useful for private notes, sensitive information, or notes that would add noise without value.

### `instructions`
Injects a custom instruction whenever Claude reads or references this note.

```yaml
---
claude:
  instructions: "This is a template — never modify it directly. Copy it to create new instances."
---
```

### Combining fields

```yaml
---
claude:
  readonly: true
  context: always
  instructions: "This is the master project brief. Reference it for all project-related questions."
---
```

---

## Settings

Open **Settings → Cortex** to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Claude binary path | *(auto-detect)* | Full path to the `claude` executable. Leave blank to auto-detect from PATH and common install locations. |
| Context file path | `_claude-context.md` | Vault-relative path to the context file injected at session start. |

---

## Known Limitations

- **Desktop only** — Obsidian mobile is not supported (Node.js APIs are unavailable on mobile)
- **Windows:** Claude Code must be installed natively in PowerShell, not just in WSL
- **One active session at a time** — concurrent sessions are not supported in v1
- Claude operates with full vault access — use `readonly` frontmatter on notes you don't want modified
- Sessions are stored in `.obsidian/claude/sessions/` which is typically gitignored; sessions do not sync across devices

---

## Troubleshooting

**"Claude binary not found" notice on startup**
Claude Code is not installed or not in a location Cortex can find. Either install it (see [Requirements](#requirements)) or enter the full path manually in **Settings → Cortex → Claude binary path**.

**Plugin doesn't appear in Obsidian after installing**
Ensure Safe Mode is disabled (Settings → Community Plugins) and that the `cortex/` folder contains both `main.js` and `manifest.json`. Restart Obsidian after installing.

**Claude doesn't seem to know about my vault structure**
Check that your context file exists at the configured path (`_claude-context.md` by default) and contains useful information about your vault.
