# Cortex — User Guide

Cortex is an Obsidian plugin that puts a Claude Code agent inside your vault. This guide covers installation, configuration, and day-to-day use.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [First Launch](#first-launch)
- [Using the Chat Panel](#using-the-chat-panel)
- [Context System](#context-system)
- [Commands](#commands)
- [Settings](#settings)
- [Known Limitations](#known-limitations)

---

## Requirements

- **Obsidian desktop** (Windows, Mac, or Linux) — mobile is not supported
- **Claude Code CLI** installed and authenticated ([full install guide](https://code.claude.com/docs/en/overview#native-install-recommended))
  - **Windows:** must be installed natively **in PowerShell** — a WSL or CMD-only install will not work
    ```powershell
    irm https://claude.ai/install.ps1 | iex
    ```
  - **Mac/Linux:**
    ```bash
    curl -fsSL https://claude.ai/install.sh | bash
    ```
  - Verify the install: `claude --version` should return a version number in your terminal
  - **Log in:** run `claude` in your terminal — on first launch it will prompt you to authenticate and open a browser. If the browser doesn't open automatically, press `c` to copy the login URL.
- A **Claude Pro or Max subscription** — Cortex rides your existing subscription, no separate API key needed

---

## Installation

### Via BRAT (recommended for beta)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs and auto-updates beta plugins directly from GitHub.

1. Install **BRAT** from the Obsidian community plugin browser
2. In BRAT settings, click **Add Beta Plugin** and enter: `ScottKirvan/Cortex`
3. BRAT installs Cortex and keeps it updated automatically

### Manually

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

- A **wave icon** appears in the left ribbon — click it to open the Cortex chat panel
- Or use the Command Palette: `Cortex: Open agent panel`
- If Claude is not found automatically, a notice will appear — go to **Settings → Cortex** and enter the full path to your `claude` binary

---

## Using the Chat Panel

The chat panel opens as a sidebar. Type your message and press **Enter** to send, or click **Send**. Use **Shift+Enter** to insert a newline without sending. The "Send on Enter" behavior can be toggled in **Settings → Cortex**.

Claude has access to your full vault — it can read, write, create, move, and organize notes. The vault root is Claude's working directory.

**Example prompts:**
- "Summarize the note [[Project Alpha]]"
- "Find all notes tagged #meeting from last week and create a summary note"
- "Rename all notes in the 03_Cards folder that start with 'Untitled' based on their content"
- "Create a new note in 06_Spaces called 'Q2 Goals' with an outline based on my existing goals notes"

---

## Context System

Cortex injects context at the start of each new session so Claude understands your vault before you ask your first question. Nothing is injected on subsequent turns — those use session resumption (`--resume`) which is far cheaper.

### 1. System Orientation

Automatically injected at every new session — no configuration needed. This tells Claude what Cortex is, that it's operating inside an Obsidian vault, what tools and capabilities it has available, and how to interact with Obsidian directly (opening files, navigating notes, showing notices). Claude is never starting blind.

### 2. Vault Tree

A folder and file name overview of your vault is automatically included so Claude understands your vault's layout. **Only names are listed — no file contents are read.** Hidden files and folders (names starting with `.`) are skipped.

The depth of the tree is configurable in **Settings → Cortex → Vault tree depth**:

| Setting              | What Claude sees                                  |
| -------------------- | ------------------------------------------------- |
| Off                  | No vault tree — Claude has no structural overview |
| 1 level              | Root-level folders and files only                 |
| 2 levels             | Root + one sublevel                               |
| 3 levels *(default)* | Root + two sublevels                              |
| N levels             | N levels deep from the root                       |
| Unlimited            | The full tree at any depth                        |

Deeper trees give Claude better spatial awareness of large vaults but cost more tokens on the first message of each session. For most vaults, 3 levels is a reasonable balance.

### 3. Context File (Persistent Memory)

A markdown file injected at the start of every session. Default path: `_claude-context.md` at your vault root. This file is Claude's **persistent memory** — it survives across sessions and syncs with your vault between machines.

You can seed it manually with your vault conventions:

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

### 4. Autonomous Memory Instruction

When **Autonomous memory** is enabled (on by default), Claude is instructed to actively maintain the context file as it learns about your vault — naming conventions, ongoing projects, your preferences, decisions made. Claude updates the file directly using its file-editing tools; you can inspect and edit it at any time in Obsidian.

Disable in **Settings → Cortex → Autonomous memory** if you prefer to manage the context file manually, or if your vault is public or shared.

#### Two kinds of memory

|                   | Session memory (`--resume`)                             | Autonomous memory (context file)     |
| ----------------- | ------------------------------------------------------- | ------------------------------------ |
| **What**          | Full conversation history                               | Key facts Claude chose to remember   |
| **How long**      | Until the Claude Code session expires                   | Permanent (until you edit or delete) |
| **Cross-machine** | No — stored in Claude Code's local cache (`~/.claude/`) | Yes — travels with vault sync        |
| **Size**          | 10KB–several MB per session (plain JSON lines)          | As small as you keep it              |
| **Inspectable**   | No                                                      | Yes — it's just a markdown file      |

> **Cross-machine note:** Session files live at `~/.claude/projects/<vault-path>/` keyed to the vault's absolute path. Resuming a session from another machine requires the vault to be at the same absolute path AND the session file to be present on that machine. This is generally not practical. Use the context file for cross-machine continuity instead.

#### Token cost model

Understanding when tokens are spent helps you use Cortex efficiently:

| Action                                             | Token cost     | Notes                                                        |
| -------------------------------------------------- | -------------- | ------------------------------------------------------------ |
| Opening the panel                                  | Free           | No API call                                                  |
| Switching sessions in History                      | Free           | Reads local `.jsonl` file only                               |
| Browsing session history                           | Free           | All local disk reads                                         |
| **First message of a new session**                 | **Full price** | Context injection + your prompt, cache created here          |
| **Continuing a session (turn 2+, within ~1 hour)** | **Cheap**      | History loaded from prompt cache (~10x cheaper)              |
| **Resuming after restart / 1+ hour gap**           | **Full price** | Cache expired; full history re-charged as fresh input tokens |
| Starting a new session                             | Free           | No API call until you send                                   |

**The key insight:** Claude's prompt cache expires after ~1 hour. Continuing a session within an hour is cheap; resuming a session after an overnight shutdown pays full price to reload the history. For sessions you haven't used in a while, starting a new session (paying only for context injection) may be cheaper than resuming a large accumulated one.

---

## Commands

Cortex provides a full command palette for quick access to all features. Press **Ctrl+P** (Windows/Linux) or **Cmd+P** (Mac) to open the Command Palette, then search for any of these commands:

### Panel & Navigation

| Command palette name             | ID                            | Description                                                                                  |
| -------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| **Cortex: Open agent panel**     | `open-cortex-agent`           | Opens or focuses the Cortex chat panel. You can also click the wave icon in the left ribbon. |
| **Cortex: Toggle Cortex panel**  | `toggle-cortex-panel`         | Quickly hide or show the Cortex chat panel without closing it.                               |
| **Cortex: Show session history** | `show-cortex-session-history` | Display a list of all saved sessions and resume a previous conversation.                     |

### Session Management

| Command palette name              | ID                     | Description                                                                                                            |
| --------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Cortex: New session**           | `new-cortex-session`   | Start a fresh conversation with Claude. The current session is saved automatically.                                    |
| **Cortex: Clear current session** | `clear-cortex-session` | Clear all messages from the current session. Claude can still see the vault tree and context file at the next message. |

### Communication & Settings

| Command palette name            | ID                           | Description                                                      |
| ------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| **Cortex: Export conversation** | `export-cortex-conversation` | Copy the current conversation as markdown to the clipboard.      |
| **Cortex: Copy last response**  | `copy-cortex-last-response`  | Copy Claude's last response to the clipboard in markdown format. |
| **Cortex: Open settings**       | `open-cortex-settings`       | Jump directly to the Cortex settings panel.                      |
| **Cortex: Focus chat input**    | `focus-cortex-input`         | Open the Cortex panel (if closed) and place the cursor in the chat input. Useful for binding to a hotkey. |
| **Cortex: Open context file**   | `open-cortex-context-file`   | Open the context file (`_claude-context.md` by default) in Obsidian for editing. |
| **Cortex: About Cortex**        | `show-cortex-about`          | Show the About panel with version info and links.                |

---

## Settings

Open **Settings → Cortex** to configure:

| Setting                        | Default              | Description                                                                                                                                             |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude binary path             | *(auto-detect)*      | Full path to the `claude` executable. Leave blank to auto-detect from PATH and common install locations.                                                |
| Context file path              | `_claude-context.md` | Vault-relative path to the context file injected at session start.                                                                                      |
| Vault tree depth               | 3 levels             | How many levels of folder/file names to inject at session start. 0 = off, 1 = root only, -1 = unlimited. Names only — no file contents are read.        |
| Send on Enter                  | On                   | Press Enter to send a message. Shift+Enter always inserts a newline.                                                                                    |
| Resume last session on startup | On                   | Automatically resume the most recent session when the Cortex panel opens.                                                                               |
| Autonomous memory              | On                   | Claude will autonomously update the context file as it learns about your vault. Disable if you prefer to manage it manually or if your vault is shared. |

---

## Known Limitations

- **Desktop only** — Obsidian mobile is not supported (Node.js APIs are unavailable on mobile)
- **Claude Code must be installed via a terminal** — the Obsidian desktop app or web app alone is not sufficient. On Windows this means PowerShell; on Mac/Linux use Terminal. See the [Claude Code install guide](https://code.claude.com/docs/en/overview#native-install-recommended) for platform-specific instructions.
- **One active session at a time** — concurrent sessions are not supported
- Claude operates with full vault access
- Sessions are stored in `.obsidian/plugins/cortex/.claude/sessions/` which is typically gitignored; sessions do not sync across devices

---

## Troubleshooting

**Setup panel appears instead of the chat panel**
Cortex could not find your Claude Code installation. Follow the on-screen steps to install Claude Code, or if it's already installed, enter the full path to the binary in the path field on that panel. See the [Claude Code install guide](https://code.claude.com/docs/en/overview#native-install-recommended) for platform-specific instructions.

**"Claude Code is not authenticated" error after sending a message**
Claude Code is installed but not logged in. Click **Open terminal** in the error card — a terminal window will open running Claude Code. Follow the prompts to authenticate (a browser window will open). Click **Done** when finished.

**Plugin doesn't appear in Obsidian after installing**
Ensure Safe Mode is disabled (Settings → Community Plugins) and that the `cortex/` folder contains both `main.js` and `manifest.json`. Restart Obsidian after installing.

**Claude doesn't seem to know about my vault structure**
Check that your context file exists at the configured path (`_claude-context.md` by default) and contains useful information about your vault. Also check that **Vault tree depth** is not set to Off.

**Claude is doing something unexpected mid-task**
Click the **Stop** button (the square icon in the input bar, visible while Claude is running) to interrupt immediately. Claude's process and any subprocesses are killed. Any files already written before you stopped will remain — review them before continuing. Start a new session or send a follow-up message to correct course.

**Claude seems to be running but nothing is happening**
If the status indicator has been showing for a long time with no output, Claude may be stuck. Click **Stop** to interrupt, then try again. Make sure Claude Code is installed and authenticated via a terminal — on Windows use PowerShell, on Mac/Linux use Terminal. Run `claude --version` to confirm the install is visible.
