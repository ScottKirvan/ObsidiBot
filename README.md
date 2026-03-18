# Cortex [![starline](https://starlines.qoo.monster/assets/ScottKirvan/Cortex)](https://github.com/qoomon/starline)
<div align="center">

  <img src="assets/media/logo.jpg" alt="logo" width="200" height="auto" />
  <h1><a href="https://github.com/ScottKirvan/Cortex">ScottKirvan/Cortex</a></h1>
  <h3>Claude Code agentic file management inside Obsidian</h3>

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
  <a href="notes/USER_README.md">User Guide</a>
  <span> · </span>
  <a href="https://discord.gg/TN6XJSNK5Y">Discord</a>
  <span> · </span>
  <a href="CONTRIBUTING.md">Contributing</a>
</h4>
</div>

---

> **Status:** Public beta — not yet in the Obsidian community plugin browser. Install manually from [Releases](https://github.com/ScottKirvan/Cortex/releases). Feedback welcome on [Discord](https://discord.gg/TN6XJSNK5Y) or via [GitHub Issues](https://github.com/ScottKirvan/Cortex/issues).

---

## What is Cortex?

Cortex is an Obsidian plugin that puts a Claude Code agent inside your vault. You chat with Claude in a side panel; Claude can read, write, create, move, and organize your notes — the same way Claude Code works in a code project, applied to your Obsidian vault.

**No API key required.** Cortex is powered by Claude Code, Anthropic's desktop CLI tool included with Claude Pro and Max subscriptions — no separate API key needed.

## Features

- **Chat panel** — a persistent side panel for back-and-forth conversation with Claude
- **Full vault access** — Claude can read, write, create, and move notes; the vault root is Claude's working directory
- **Session persistence** — resume previous conversations; sessions stored in `.obsidian/plugins/cortex/.claude/sessions/`
- **Context system** — vault folder/file tree and persistent context file injected at session start; configurable depth
- **Autonomous memory** — Claude maintains a context file across sessions as it learns your vault
- **Session history** — named sessions, rename/delete, resume across restarts
- **No API key** — uses your Claude Pro/Max subscription via the `claude` CLI

## Requirements

- Obsidian desktop (Windows, Mac, or Linux — **desktop only**, no mobile)
- [Claude Code CLI](https://code.claude.com/docs/en/overview#native-install-recommended) installed and authenticated (included in Claude Pro/Max subscriptions)
  - **Windows users:** Claude Code must be installed natively in **PowerShell** — a WSL-only install will not work
  - Verify: `claude --version` in PowerShell should return a version number

## Installation

Cortex is not yet in the Obsidian community plugin browser.

### Via BRAT (recommended for beta)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) is a community plugin that installs and auto-updates beta plugins directly from GitHub.

1. Install **BRAT** from the Obsidian community plugin browser
2. In BRAT settings, click **Add Beta Plugin** and enter: `ScottKirvan/Cortex`
3. BRAT installs Cortex and keeps it updated automatically

### Manually

1. Download `cortex-<version>.zip` from [Releases](https://github.com/ScottKirvan/Cortex/releases)
2. Extract the zip — you should have a `cortex/` folder containing `main.js`, `manifest.json`, and `styles.css`
3. Move the `cortex/` folder into `<your-vault>/.obsidian/plugins/`
4. In Obsidian: **Settings → Community Plugins** → disable Safe Mode if prompted → enable **Cortex**

See the [User Guide](notes/USER_README.md) for full setup and configuration details.

## Quick Start

1. Open the Cortex panel from the ribbon (wave icon) or Command Palette
2. Type a message and press **Enter** (or click Send). Use Shift+Enter for a newline.
3. Claude has access to your full vault — ask it to summarize a note, find related ideas, or draft new content

See the [User Guide](notes/USER_README.md) for context files, session management, and settings.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for project layout, development setup, commit conventions, and PR process.

## License

MIT — see [LICENSE.md](LICENSE.md)

---

Project Link: [Cortex](https://github.com/ScottKirvan/Cortex)
[CHANGELOG](notes/CHANGELOG.md) · [TODO](notes/TODO.md) · [User Guide](notes/USER_README.md)
