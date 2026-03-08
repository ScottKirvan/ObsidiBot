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
  <a href="CONTRIBUTING.md">Contributing</a>
</h4>
</div>

---

> **Status:** Early development — not yet available in the Obsidian community plugin browser.

---

## What is Cortex?

Cortex is an Obsidian plugin that puts a Claude Code agent inside your vault. You chat with Claude in a side panel; Claude can read, write, create, move, and organize your notes — the same way Claude Code works in a code project, applied to your Obsidian vault.

**No API key required.** Cortex runs the `claude` CLI binary as a subprocess, riding your existing Claude Pro or Max subscription. The same approach used by Cline and Zed.

## Features

- **Chat panel** — a persistent side panel for back-and-forth conversation with Claude
- **Full vault access** — Claude can read, write, create, and move notes; the vault root is Claude's working directory
- **Context system** — inject a context file, pin specific notes, or highlight a selection before asking Claude a question
- **Per-note frontmatter controls** — mark notes as `readonly`, permanently `context: always` (pinned), or `context: never` (excluded)
- **Session persistence** — resume previous conversations; sessions stored in `.obsidian/claude/sessions/` (gitignored)
- **No API key** — uses your Claude Pro/Max subscription via the `claude` CLI

## Requirements

- Obsidian desktop (Windows, Mac, or Linux — **desktop only**, no mobile)
- [Claude Code CLI](https://claude.ai/code) installed and authenticated
  - **Windows users:** must be installed natively in PowerShell, not just in WSL
  - Verify: `claude --version` works in a terminal

## Installation

Cortex is not yet in the Obsidian community plugin browser. To install manually:

1. Download the latest release from [Releases](https://github.com/ScottKirvan/Cortex/releases)
2. Extract into `<your-vault>/.obsidian/plugins/cortex/`
3. In Obsidian: Settings → Community Plugins → enable **Cortex**

See the [User Guide](notes/USER_README.md) for full setup and configuration details.

## Quick Start

1. Open the Cortex panel from the ribbon (message-square icon) or Command Palette
2. Type a message and press **Enter** (or click Send). Use Shift+Enter for a newline.
3. Claude has access to your full vault — ask it to summarize a note, find related ideas, or draft new content

See the [User Guide](notes/USER_README.md) for context files, frontmatter controls, and session management.

## Project Layout

```
Cortex/
  main.ts                 ← plugin entry point
  manifest.json           ← plugin metadata
  src/
    ClaudeView.ts         ← chat panel UI
    ClaudeSession.ts      ← session persistence
    ClaudeProcess.ts      ← binary detection, spawn, stream parsing
    ContextManager.ts     ← context file and pinned note injection
    FrontmatterGuard.ts   ← per-note access controls
    settings.ts           ← settings schema and UI
    utils/
      shellEnv.ts         ← shell environment resolution
      fileTree.ts         ← vault tree builder
      sessionStorage.ts   ← session read/write
  notes/                  ← design docs, TODO, user guide
  .github/                ← CI, release-please, issue templates
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commit conventions, and PR process.

## License

MIT — see [LICENSE.md](LICENSE.md)

---

Project Link: [Cortex](https://github.com/ScottKirvan/Cortex)
[CHANGELOG](notes/CHANGELOG.md) · [TODO](notes/TODO.md) · [User Guide](notes/USER_README.md)
