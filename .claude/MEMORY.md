# MEMORY.md — Cortex Project

Persistent cross-session notes for Claude Code. Keep concise.

---

## Project Identity

- **Name:** Cortex
- **What:** Obsidian plugin — brings Claude Code agentic file management into Obsidian vaults
- **Plugin ID:** `cortex` (manifest.json id)
- **Repo path:** `d:/1/GitRepos/ScottKirvan/Vaults/sk/07_GitRepos/Cortex`
- **GitHub:** ScottKirvan/Cortex (release-please + conventional commits)

## Current Status (as of 2026-03-08)

- **Phase:** Active development. Core features working and committed.
- **Working:** chat panel, session persistence (--resume), markdown rendering, context injection (vault tree + context file), Send-on-Enter setting
- **Test vault:** `D:\2\deleteme` (symlinked to plugin dir)
- **Remaining:** copy/paste in panel, thinking indicator, frontmatter enforcement (FrontmatterGuard.ts)

## Known Gotchas

- **Claude Code must be installed AND logged in natively in Windows (PowerShell), not just in WSL.** Install: `winget install Anthropic.ClaudeCode`. Then: `claude login`. WSL auth does not carry over.
- **Windows/Electron spawn fix:** `child_process.spawn` with `stdio:pipe` silently swallows stdout from Obsidian/Electron. Fix: spawn via `powershell.exe -NonInteractive -Command "& 'claude.exe' ..."` AND call `proc.stdin?.end()` after spawn. See `src/ClaudeProcess.ts`.
- **`--verbose` required:** `--output-format stream-json` requires `--verbose` with `--print`.
- **`CLAUDECODE` env var:** must be deleted from spawn env or claude refuses to run nested.

## Key Architecture Decisions (Locked)

- Spawns `claude` CLI via subprocess — NOT the API, NOT the Agent SDK
- No API key — rides Pro/Max subscription
- Windows: spawn via `powershell.exe -NonInteractive` + `proc.stdin.end()`
- Vault root = `cwd` for all spawns
- Context injected once at new session start (vault tree + `_claude-context.md`)
- Sessions tracked by ID; `--resume <id>` for continuity; "New session" button to clear
- **Desktop only** — `isDesktopOnly: true`

## Scott's Preferences

- Conventional commits + release-please (he commits, I write code)
- Scott moves between machines — keep notes complete enough to resume cold
- Not yet fluent in TypeScript — I do the implementation writing
- No auto-commit or push
- Project and plugin both called "Cortex"

## Key Files

| File | Purpose |
|------|---------|
| `Claude.md` | Project instructions (in repo) |
| `.claude/MEMORY.md` | This file |
| `src/ClaudeView.ts` | Chat panel UI, session tracking, context injection |
| `src/ClaudeProcess.ts` | Binary detection, spawn, stream-json parsing |
| `src/ContextManager.ts` | Vault tree + context file assembly |
| `src/settings.ts` | Settings schema + tab |
| `test/spawn-test.mjs` | Standalone spawn test (run with node, no Obsidian needed) |
| `notes/obsidian-claude-plugin-design.md` | Full architecture spec |

## Remaining Work (prioritized)

1. Copy/paste in chat panel (likely CSS `user-select` issue)
2. Thinking indicator (spinner/animation while waiting)
3. FrontmatterGuard.ts — readonly/protect/context:never enforcement
4. Styles polish (styles.css is nearly empty)
