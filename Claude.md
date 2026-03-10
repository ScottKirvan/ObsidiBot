# Claude.md — Cortex
## What
Obsidian plugin. Claude Code CLI as subprocess (NOT API, NOT Agent SDK). No API key — rides Pro/Max sub. Desktop only.

## Architecture (locked — don't revisit without discussion)
- `child_process.spawn` → `powershell.exe -NonInteractive -Command "& 'claude.exe' ..."` (Windows/Electron stdout fix)
- `proc.stdin.end()` after spawn (required or claude hangs)
- Flags: `--output-format stream-json --verbose --print --dangerously-skip-permissions`
- `--verbose` required with `stream-json` + `--print` or claude errors
- Delete `CLAUDECODE` from spawn env or claude refuses nested launch
- `--resume <sessionId>` on every turn after first; uses cache_read_input_tokens (~10x cheaper)
- Do NOT prepend history manually — that costs MORE than --resume
- Vault root = cwd for all spawns
- Sessions: `.obsidian/plugins/cortex/.claude/sessions/<id>.json` (metadata only; actual history in `~/.claude/projects/`)

## Current status
Working: chat panel, markdown rendering, session persistence + history UI, session resume + history display, context injection (vault tree + context file + memory instruction), send-on-enter, command palette (8 cmds), export/copy, token logging, autonomous memory setting, remote session detection.

Remaining: FrontmatterGuard.ts (stubbed), pinned context files (backburned), permission dialog (currently using --dangerously-skip-permissions; future: native Obsidian modal).

Test vault: `D:\2\deleteme` (symlinked to plugin dir).

## Key files
| File                          | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `main.ts`                     | Plugin entry, 8 commands, activateView                      |
| `src/ClaudeView.ts`           | Chat UI, session state, context injection, history modal    |
| `src/ClaudeProcess.ts`        | Binary detect, spawn (PowerShell on Win), stream-json parse |
| `src/ContextManager.ts`       | Vault tree + context file + memory instruction assembly     |
| `src/settings.ts`             | Settings schema + tab UI                                    |
| `src/utils/sessionStorage.ts` | Session CRUD, .jsonl parse, canResumeLocally                |
| `src/utils/logger.ts`         | File + console logging, estimateTokens                      |
| `src/utils/fileTree.ts`       | Vault folder tree builder                                   |
| `test/spawn-test.mjs`         | Standalone spawn test (node, no Obsidian)                   |
| `notes/USER_README.md`        | User-facing guide                                           |
| `notes/COMMIT_DRAFT.md`       | Commit msg staging (gitignored)                             |

## Scott's prefs
- Conventional commits + release-please. Scott commits, I write code.
- No auto-commit/push.
- Not fluent in TS — I do implementation.
- Multi-machine (Windows). Keep notes resumable cold.
- Project = "Cortex" (not "Cortex plugin", not "obsidian-claude").

## Build
```bash
npm install && npm run build   # one-shot
npm run dev                    # watch mode
```

## Windows gotchas
- Claude Code must be installed AND logged in natively in PowerShell. `winget install Anthropic.ClaudeCode` + `claude login`.
- Spawn via `powershell.exe -NonInteractive` — cmd.exe (shell:true) and direct spawn (shell:false) both silently swallow stdout in Electron.
- `proc.stdin.end()` is required after spawn.

## Commits
`feat:` / `fix:` / `docs:` / `chore:` / `refactor:` / `test:`. Breaking: `feat!:` or `BREAKING CHANGE:` footer. release-please handles CHANGELOG + version bumps.
