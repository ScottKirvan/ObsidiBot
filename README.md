# Cortex [![starline](https://starlines.qoo.monster/assets/ScottKirvan/Cortex)](https://github.com/qoomon/starline)
<div align="center">

  <img src="assets/media/logo.jpg" alt="logo" width="200" height="auto" />
  <h1><a href="https://github.com/ScottKirvan/Cortex">ScottKirvan/Cortex</a></h1>
  <h3>Claude agentic file management inside Obsidian</h3>

<!-- Badges -->
<p>
  <a href="https://github.com/ScottKirvan/Cortex/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/ScottKirvan/Cortex" alt="contributors" />
  </a>
  <a href="">
    <img src="https://img.shields.io/github/last-commit/ScottKirvan/Cortex" alt="last update" />
  </a>
  <a href="https://github.com/ScottKirvan/Cortex/network/members">
    <img src="https://img.shields.io/github/forks/ScottKirvan/Cortex" alt="forks" />
  </a>
  <a href="https://github.com/ScottKirvan/Cortex/stargazers">
    <img src="https://img.shields.io/github/stars/ScottKirvan/Cortex" alt="stars" />
  </a>
  <a href="https://github.com/ScottKirvan/Cortex/issues/">
    <img src="https://img.shields.io/github/issues/ScottKirvan/Cortex" alt="open issues" />
  </a>
  <a href="https://github.com/ScottKirvan/Cortex/blob/main/LICENSE.md">
    <img src="https://img.shields.io/github/license/ScottKirvan/Cortex.svg" alt="license" />
  </a>
</p>

<h4>
  <a href="https://github.com/ScottKirvan/Cortex/issues/new?template=bug_report.md">Report Bug</a>
  <span> · </span>
  <a href="https://github.com/ScottKirvan/Cortex/issues/new?template=feature_request.md">Request Feature</a>
  <span> · </span>
  <a href="https://www.scottkirvan.com/Cortex/notes/USER_README.html">User Guide</a>
  <span> · </span>
  <a href="https://discord.gg/TN6XJSNK5Y">Discord</a>
  <span> · </span>
  <a href="https://www.scottkirvan.com/Cortex/CONTRIBUTING.html">Contributing</a>
</h4>
</div>

---

> **Status:** Public beta — not yet in the Obsidian community plugin browser. Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat) or from [Releases](https://github.com/ScottKirvan/Cortex/releases). Feedback welcome on [Discord](https://discord.gg/TN6XJSNK5Y) or [GitHub Issues](https://github.com/ScottKirvan/Cortex/issues).

---

## An AI agent working inside your vault — not chatting from the sidelines

Cortex puts a full Claude Code agent in Obsidian's sidebar — powered by the Claude Code CLI included in your Claude Pro/Max subscription. You type; Cortex acts. It reads, writes, reorganizes, and creates notes. When it's done, it opens the result in your editor.

```
"Find all notes tagged #meeting from last week and create a summary note"
"Rename everything in 03_Cards that starts with 'Untitled' based on its content"
"Search for independent printers near New York City that can help me publish my 200 page coffeetable book, then write up a comparative summary for me"
```


---

## What makes Cortex different

Most Obsidian AI plugins are chatbots — text in, text out, no file access. Other plugins reach a bit further, but none of them match Cortex's depth of Obsidian integration, vault-native memory, and per-note control.

|                                        | Cortex  | Copilot Plus    | Claudian | Agent Client |
| -------------------------------------- | ------- | --------------- | -------- | ------------ |
| Session persistence                    | **Yes** | No              | Yes      | No           |
| Vault-native memory (syncs with vault) | **Yes** | No              | No       | No           |
| Obsidian UI control                    | **Yes** | No              | No       | No           |
| Execute any Obsidian command           | **Yes** | No              | No       | No           |
| Properties/Frontmatter config          | **Yes** | No              | No       | No           |
| Configurable safety modes              | **Yes** | No              | Yes      | No           |
| Required API key                       | **No**  | Yes ($14.99/mo) | Optional | No           |

**Already using Claude Code in a terminal?** Cortex uses the same binary — no new setup, no new costs. What you gain is the integration layer: automatic context and memory management, Obsidian UI control, and a session history that travels with your vault. The terminal stays available for everything else.

---
## Features
### A context stack built for how you actually work

Context is the information Cortex uses to understand your request — every note, file, image, or URL you add lives in a stack below the input — stackable, removable, individually pinnable. Pinned items (📌) survive send and stay attached for every subsequent message in the session.

**What you can stack:**
- **@** — type `@` in a message to attach a note; currently open note is selected by default
- **Selection snippet** — highlight text in any open note, send it as labeled context
- **Attachment (📎)** — files, PDFs, images, URLs; text read inline, binaries by path

**What Cortex injects automatically:**
- Vault folder structure at session start (configurable depth)
- Persistent, self-maintained context file — your naming conventions, ongoing projects, preferences — syncing with your vault across machines
- Notes pinned via Obsidian properties / frontmatter
- Per-note standing instructions via Obsidian properties / frontmatter
- Active note — Cortex always knows where you are

Cortex's session cache means you pay full price for this context once per session. Every subsequent turn is dramatically cheaper.

### Inside Obsidian, not alongside it

Cortex doesn't just edit files and leave you to find them. After completing a task it can open the result in your editor, split it beside your current file, scroll to a specific heading, or show a toast notification confirming what it did.

This is what separates Cortex from terminal-based Claude wrappers — Cortex is operating *inside* Obsidian. It has full read/write access to everything in your vault: notes, frontmatter, tags, templates, plugin config, Obsidian settings, and shell commands that go beyond simple file editing.

### Run any Obsidian command — without leaving chat

Claude can execute Obsidian commands directly from the chat panel. Open today's daily note, trigger a Templater template, run the file switcher, refresh a Dataview, invoke any command from any installed plugin — just ask.

```
"Open today's daily note"
"Refresh the Dataview on this page"
"Create a new note from my Weekly Review template"
```

Three commands are pre-approved by default. You control the rest through a searchable allowlist in Settings. Unapproved commands show a confirmation modal — approve with "Don't ask again" to always allow, deny to permanently block. Claude reads a generated command manifest at startup, so it always uses exact IDs — it never guesses.

No other Obsidian AI plugin does this.

### Configurable safety modes

Three levels — **readonly**, **standard** (default), and **full access** — so Cortex's reach matches what you're comfortable with. If a denied operation blocks a task, an in-chat card shows exactly what was blocked and offers one-click upgrade + auto-retry.

### Context gauge

You've been there: Claude starts hedging, repeating itself, losing the thread. That's context exhaustion. Cortex shows you a live gauge of remaining session memory right below the input — and lets you compact with one click before things quietly fall apart.

### Per-note frontmatter controls

Use Obsidian's Properties panel to configure Cortex's behavior per note — no special UI, just YAML:

- `cortex-context: always` — pin this note's full content to every new session. Ideal for project briefs, style guides, vault conventions.
- `cortex-instructions: "..."` — inject standing rules at session start. Cortex follows them without you repeating yourself every session.

**Partial file protection:** `cortex-instructions: "Read this file for reference only. Do not edit it."` works reliably in practice — Cortex respects it as part of its context. Convention, not hard enforcement; keep a backup or use git for truly critical files.

### Session history and tool call visibility

Named sessions, resume any conversation, rename and delete — browsable at no token cost. Drag sessions into your preferred order; the currently active session is always marked. As Cortex works, labeled events appear inline — *Reading: notes/archive*, *Writing: Q2-goals.md* — collapsing to a tidy summary when the response is done.

---

## Requirements

- Obsidian desktop (Windows, Mac, or Linux — **desktop only**, no mobile)
- [Claude Code CLI](https://code.claude.com/docs/en/overview#native-install-recommended) installed and authenticated — included in Claude Pro/Max subscriptions
  - **Windows:** must be installed natively in **PowerShell** (not WSL). Verify: `claude --version` in PowerShell
  - **Mac/Linux:** `curl -fsSL https://claude.ai/install.sh | bash`

## Installation

Cortex is not yet in the Obsidian community plugin browser.

### Via BRAT (recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs and auto-updates beta plugins from GitHub.

1. Install **BRAT** from the Obsidian community plugin browser
2. In BRAT settings → **Add Beta Plugin** → enter: `ScottKirvan/Cortex`
3. Done — BRAT keeps Cortex updated automatically

### Manually

1. Download `cortex-<version>.zip` from [Releases](https://github.com/ScottKirvan/Cortex/releases)
2. Extract to get a `cortex/` folder with `main.js`, `manifest.json`, `styles.css`
3. Move `cortex/` into `<your-vault>/.obsidian/plugins/`
4. **Settings → Community Plugins** → enable **Cortex**
---

## Quick Start

1. Open the Cortex panel from the ribbon (wave icon) or Command Palette: `Cortex: Open agent panel`
2. Type a message and press **Enter** (or click Send). Use Shift+Enter for a newline.
3. Cortex has full access to your vault — ask it to summarize, organize, find, or create notes

See the [User Guide](notes/USER_README.md) for context files, session management, and settings.


## Support the Project

Cortex is free, open source, and maintained in spare time. If it saves you hours of manual note organization, consider sponsoring:

[![GitHub Sponsors](https://img.shields.io/github/sponsors/ScottKirvan?style=social)](https://github.com/sponsors/ScottKirvan)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for project layout, development setup, commit conventions, and PR process.

## License

MIT — see [LICENSE.md](LICENSE.md)

---

Project Link: [Cortex](https://github.com/ScottKirvan/Cortex)  
[CHANGELOG](notes/CHANGELOG.md) · [TODO](notes/TODO.md) · [User Guide](notes/USER_README.md)
