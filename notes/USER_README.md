# Cortex — User Guide

Cortex is an Obsidian plugin that puts a Claude Code agent inside your vault. This guide covers installation, configuration, and day-to-day use.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [First Launch](#first-launch)
- [Using the Chat Panel](#using-the-chat-panel)
- [Session Manager](#session-manager)
- [Context System](#context-system)
- [Commands](#commands)
- [Settings](#settings)
- [Permissions](#permissions)
- [Logging](#logging)
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
2. In BRAT settings, click **Add Beta Plugin** and enter: `ScottKirvan/ObsidianCortex`
3. BRAT installs Cortex and keeps it updated automatically

### Manually

1. Download `cortex-<version>.zip` from the [Releases page](https://github.com/ScottKirvan/ObsidianCortex/releases)
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

### Attaching context to a message

Attached items appear in a bar above the input field. Click **×** to remove an item, or click the **pin icon** to keep it attached for every subsequent message in the session (useful for a reference note you want always present). All attached context is prepended to your message when you send.

**Attachment button (paperclip)**

Click the paperclip icon in the input bar to open the attach menu:

| Option | What it does |
|---|---|
| **Attach file** | Opens your system file picker — attach any file from anywhere on your drive. Text-based files (`.md`, `.txt`, `.fountain`, `.js`, etc.) are read and their content included inline. Images (`.png`, `.jpg`, `.gif`, `.webp`, etc.) and PDFs are copied to a temporary folder inside your vault so Claude can read them with its Read tool. |
| **Attach URL** | Enter any URL — it is passed to Claude as-is. Claude decides what to do with it based on your message (fetch the content, analyse the address, store it as a reference, etc.). |
| **@ Add note** | Opens the same vault note search as the `@` shortcut below. |

**Paste images from clipboard**

Paste an image directly into the chat input with **Ctrl+V** (or **Cmd+V**). This works for:
- **Screenshots** — take a screenshot, then paste into Cortex. The image is saved to a temporary folder inside your vault and attached automatically.
- **Files copied from Explorer/Finder** — copy a `.png`, `.jpg`, `.gif`, `.webp`, or `.pdf` file and paste it into the input.

Pasted images appear in the context bar with an image icon (PDFs show a file icon). They are attached for your next message only, unless you pin them.

> **Note:** Pasted and attached binary files are saved to `.obsidian/plugins/cortex/tmp/` and are not automatically cleaned up. You can delete them manually when no longer needed.

**Drag and drop**

Drag any file from your file system and drop it anywhere onto the Cortex panel. The panel highlights with a dashed border while you're dragging over it. Images and PDFs are handled the same way as the file picker — copied to the tmp folder and attached with their original filename. Text-based files are read inline.

**@-mention a note**

Type `@` anywhere in the chat input to open an autocomplete dropdown. The currently open note is pre-selected — press **Enter** immediately to attach it without typing. Start typing to filter by name. Press **↑ / ↓** to navigate, **Enter** or **Tab** to select, **Escape** to dismiss. The full contents of the selected note are attached as context.

Non-Markdown files (e.g. `.fountain`, `.txt`) show their extension next to the filename in the dropdown so you can distinguish them from notes with the same name. The file types included in the search are configurable — see **@-mention file types** in Settings.

**Send selected text**

Highlight any text in an open note, then run **Cortex: Send selection as context** from the Command Palette (or bind it to a hotkey). The selected text is attached as a labeled snippet. You can attach multiple selections and @-mentions at once — they all send together with your next message.

A **context gauge** (ring icon) appears in the input bar after your first message — hover to see how much of the session's 200K token context window remains, and click to manually compact the session history if it's filling up.

### UI Bridge action confirmation

The Command Allowlist is the single permission boundary for `run-command` actions. Commands in the allowlist execute immediately — no further confirmation needed. Commands *not* in the allowlist are handled based on your settings:

- **Prompt for unlisted commands on (default):** A confirmation modal appears showing the command name and a **Don't ask again** checkbox. Click **Allow** to run it (if checked: adds to allowlist permanently). Click **Deny** to block it (if checked: adds to denylist — future attempts are silently hard-blocked). Allowlist always takes precedence over the denylist, so checking a denied command in the command browser re-enables it.
- **Prompt for unlisted commands off:** Unlisted commands are hard-blocked with a notice explaining why.

The 6 built-in UI Bridge actions (open file, open settings, focus search, etc.) always execute immediately — they predate the allowlist system and Claude is instructed to always emit a `show-notice` describing what it did and why.

### Running Obsidian commands

Claude can execute Obsidian commands directly — for example, opening today's daily note, triggering a Templater template, or refreshing a Dataview view — without you having to do it manually.

Three commands are pre-approved by default (`switcher:open`, `daily-notes`, `editor:open-search`). You can adjust the list at any time in **Settings → Cortex → UI Bridge & Commands**, which shows every command registered by Obsidian and your installed plugins, searchable by name.

**How permission works:**

| Situation | What happens |
|---|---|
| Command is in the **allowlist** | Runs immediately — no confirmation |
| Command is **not** in the allowlist (prompt mode on) | A modal appears: Allow or Deny, with an optional **Don't ask again** checkbox |
| Allow + Don't ask again | Command runs and is added to the allowlist permanently |
| Deny + Don't ask again | Command is added to the denylist — future attempts are silently hard-blocked |
| Command is in the **denylist** | Silently blocked (allowlist always beats denylist — check it in the browser to re-enable) |
| Prompt mode off | Unlisted commands are hard-blocked with an explanatory notice |

Claude looks up command IDs from a reference file (`.obsidian/plugins/cortex/commands.md`) generated at startup — it never guesses IDs. If a command can't be found after you approve it, you'll see a clear notice explaining why.

Once enabled, you can ask Claude things like:
- "Open today's daily note"
- "Refresh the Dataview on this page"
- "Create a new note from my Project template"

### Tool call visibility

While Claude is working, tool calls appear above the response bubble — you can see in real time what Claude is reading, writing, or searching. When the response completes, the tool list collapses to a single toggle line to keep the chat readable. Click it to expand or collapse.

---

## Session Manager

Open the session manager by clicking the session name in the panel toolbar, or via **Cortex: Show session history** in the Command Palette.

### What you can do

| Action | How |
|---|---|
| **Resume a session** | Click any row |
| **Save to vault** | Hover over a row to reveal the action icons, then click the **download icon** — opens the export path prompt, then saves the session as a vault note |
| **Rename a session** | Click the pencil icon — edit inline, then press Enter or click away to confirm. Clicking the modal X also commits the rename. |
| **Delete a session** | Click the trash icon — you will be asked to confirm |
| **Reorder sessions** | Drag the ⠿ grip handle on the left of any row up or down |
| **Filter sessions** | Type in the search box at the top |

### Active session

The currently open session is marked with an accent-coloured left border and bold title so you can see at a glance where you are.

### Sort order

Sessions are listed most-recent-first by default. Once you drag any row, that order is saved and persists across restarts. New sessions are always inserted at the top of the list, above your manually ordered sessions, so they are easy to find. You can drag them into position afterwards.

Drag handles are hidden and dragging is disabled while the search filter is active — filtering shows a subset of sessions, so reordering would produce confusing results.

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

### 4. Active Note

The path of the currently open note is automatically prepended to every message you send — e.g. `[Active note: 06_Spaces/Projects/Alpha.md]`. This means Claude always knows which note you're looking at without you having to say so. If no note is open, nothing is added.

**Split-pane awareness:** When you have multiple notes open side by side, Cortex detects the split layout and injects all visible file paths instead — e.g. `[Open in split view: Notes/A.md | Projects/B.md]`. In stacked tabs (multiple tabs in the same pane), only the active tab is included. This behaviour is on by default and can be toggled in Settings → **Inject split-pane files as context**.

### 5. Per-note Frontmatter Context

You can add Cortex properties to any note's frontmatter to control how Claude treats that file. Obsidian displays them cleanly in the Properties panel.

| Property | Value | Effect |
|---|---|---|
| `cortex-context` | `always` | Full note content injected at the start of every new session |
| `cortex-instructions` | any string | Instruction injected at session start telling Claude how to treat this file |

Both properties are independent — use either or both.

**Pin a note to every session** (e.g. a project brief, style guide, or reference):
```yaml
---
cortex-context: always
---
```

**Give Claude standing instructions for a specific file** (e.g. formatting rules, tone, handling):
```yaml
---
cortex-instructions: "Always write in present tense and keep bullet points under 10 words."
---
```

Both together:
```yaml
---
cortex-context: always
cortex-instructions: "This is the team writing guide — apply its rules to any note you edit."
---
```

> **Partial file protection:** You can use `cortex-instructions` to tell Claude not to modify a file — e.g. `"Read this file for reference only. Do not edit it."` This works well in practice but is convention, not enforcement. Claude is instructed not to write, but there is no infrastructure-level block if it misunderstands or loses track mid-task. For truly critical files, keep a backup or use your vault's git history as a safety net.

### 6. Autonomous Memory Instruction

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
| **Cortex: Export session to vault** | `export-cortex-to-vault` | Save the currently visible conversation as a note in the vault. Prompts for a path (defaults to your configured Export folder). To export a past session, use the download icon in the Session Manager. |
| **Cortex: Copy last response**  | `copy-cortex-last-response`  | Copy Claude's last response to the clipboard in markdown format. |
| **Cortex: Open settings**       | `open-cortex-settings`       | Jump directly to the Cortex settings panel.                      |
| **Cortex: Send selection as context** | `send-selection-to-cortex` | Highlight text in any note, then run this command to attach it as context for your next message. |
| **Cortex: Focus chat input**    | `focus-cortex-input`         | Open the Cortex panel (if closed) and place the cursor in the chat input. Useful for binding to a hotkey. |
| **Cortex: Open context file**   | `open-cortex-context-file`   | Open the context file (`_claude-context.md` by default) in Obsidian for editing. |
| **Cortex: Refresh session context** | `refresh-cortex-context` | Re-inject the current context file and command allowlist into the active session. Useful if you've edited the context file, changed the allowlist, or added per-note frontmatter mid-session and want Claude to be aware immediately without starting a new session. The refresh is queued and sent with your next message. |
| **Cortex: About Cortex**        | `show-cortex-about`          | Show the About panel with version info and links.                |

---

## Settings

Open **Settings → Cortex** to configure:

| Setting                        | Default                | Description                                                                                                                                             |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude binary path             | *(auto-detect)*        | Full path to the `claude` executable. Leave blank to auto-detect from PATH and common install locations.                                                |
| Context file path              | `_claude-context.md`   | Vault-relative path to the context file injected at session start.                                                                                      |
| Export folder                  | `Cortex Exports`       | Default folder for **Export session to vault**. Created automatically if it doesn't exist. Leave blank to save at the vault root.                       |
| Vault tree depth               | 3 levels               | How many levels of folder/file names to inject at session start. 0 = off, 1 = root only, -1 = unlimited. Names only — no file contents are read.        |
| Send on Enter                  | On                     | Press Enter to send a message. Shift+Enter always inserts a newline.                                                                                    |
| Resume last session on startup | On                     | Automatically resume the most recent session when the Cortex panel opens.                                                                               |
| Autonomous memory              | On                     | Claude will autonomously update the context file as it learns about your vault. Disable if you prefer to manage it manually or if your vault is shared. |
| Permission mode                | Standard               | Controls which vault operations Claude is allowed to perform. See [Permissions](#permissions) below.                                                    |
| Command Allowlist              | `switcher:open`, `daily-notes`, `editor:open-search` | Found under **UI Bridge & Commands**. Obsidian commands Claude is allowed to run via the UI Bridge. Allowlisted commands execute immediately. Search and check commands to add more. |
| Prompt for unlisted commands   | On                     | When Claude tries a command not in the allowlist, show a confirmation prompt. Allow + "Don't ask again" adds to allowlist. Deny + "Don't ask again" adds to denylist (silently hard-blocked in future). Allowlist always beats denylist. |
| Denied commands                | *(hidden until used)*  | Shows count of permanently denied commands with a **Clear denylist** button. To re-enable a specific denied command, add it to the allowlist via the command browser. |
| Enable debug log               | On                     | Write a debug log file. See [Logging](#logging) below.                                                                                                  |
| Log file path                  | `.obsidian/plugins/cortex/cortex-debug.log` | Vault-relative path for the log file. Defaults to the plugin folder so it stays out of your vault. The file is appended to — delete it manually to start fresh. |
| Log verbosity                  | Normal                 | Normal logs session events and errors. Verbose adds raw stream data and token breakdowns.                                                                |
| @-mention file types           | `md, fountain, txt`    | Comma-separated file extensions included in the `@` autocomplete dropdown. Add any text-based format your vault uses.                                    |
| Inject split-pane files        | On                     | When Obsidian is in split-pane view, include all visible file paths in the active note context. In stacked tabs, only the focused note is included.       |

---

## Permissions

Cortex runs Claude Code as a subprocess and controls what it's allowed to do via Claude Code's permission flags. The permission mode is set **per session** before any message is sent — it cannot change mid-response.

| Mode | What Claude can do |
|---|---|
| **Standard** *(recommended)* | Read and write files, use web search/fetch — Bash/shell commands blocked |
| **Read only** | Read files, search, fetch web — no writes or shell commands |
| **Full access** | Everything including shell commands (Bash, git, etc.) |

### Permission denials

When Claude attempts a blocked operation, a denial card appears in the chat after the response completes, listing what was blocked. You can click **Allow full access for this session** to upgrade to Full access and automatically retry the last message.

> **Note:** Permission granularity is at the **tool level**, not the command level. "Allow full access" unlocks all shell commands for the rest of the session — there is no way to approve `git status` while still blocking `rm`. This is a constraint of how Claude Code works in non-interactive (streaming) mode. If you need Bash access regularly, set Permission mode to **Full access** in settings rather than upgrading per-session each time.

The session override is cleared when you start a new session.

---

## Logging

Cortex can write a debug log. It is enabled by default and writes to `.obsidian/plugins/cortex/cortex-debug.log` — inside the plugin folder, not your vault, so it won't appear in Obsidian's file browser or your git history. Each Obsidian launch (or settings change) appends a `--- Cortex log started ---` marker so you can find session boundaries. Delete the file manually whenever you want to clear it.

**Verbosity levels:**

| Level | What's logged |
|---|---|
| **Normal** *(default)* | Session events, tool calls, spawns, errors — useful for everyday troubleshooting |
| **Verbose** | Everything above plus raw stream chunks and token breakdowns — for deep debugging; produces large files quickly |

All settings take effect immediately without restarting Obsidian.

> **Tip:** The log file lives inside the plugin folder and is not visible in Obsidian's file browser — no `.gitignore` entry needed.

---

## Known Limitations

- **Desktop only** — Obsidian mobile is not supported (Node.js APIs are unavailable on mobile)
- **Claude Code must be installed via a terminal** — the Obsidian desktop app or web app alone is not sufficient. On Windows this means PowerShell; on Mac/Linux use Terminal. See the [Claude Code install guide](https://code.claude.com/docs/en/overview#native-install-recommended) for platform-specific instructions.
- **One active session at a time** — concurrent sessions are not supported
- Claude operates with full vault access
- Sessions are stored in `.obsidian/cortex/sessions/` which is typically gitignored; sessions do not sync across devices

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

**Something unexpected happened and I want to investigate**
Check `.obsidian/plugins/cortex/cortex-debug.log` (or the path configured in settings). Each session is separated by a `--- Cortex log started ---` line. For more detail, switch **Log verbosity** to **Verbose** in settings — it takes effect immediately.
