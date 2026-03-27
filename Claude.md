# Claude.md — Cortex
## What
Obsidian plugin. Claude Code CLI as subprocess (NOT API, NOT Agent SDK). No API key — rides Pro/Max sub. Desktop only.

## Architecture (locked — don't revisit without discussion)
- `child_process.spawn` → `powershell.exe -NonInteractive -Command "& 'claude.exe' ..."` (Windows/Electron stdout fix)
- **Prompt is written to `proc.stdin`, NOT passed as a CLI arg.** `proc.stdin.write(prompt)` then `proc.stdin.end()`. This avoids all Windows shell-quoting issues (smart quotes, double quotes, special chars).
- `proc.stdin.end()` closes stdin so claude doesn't hang waiting for more input
- Flags: `--output-format stream-json --verbose --print --dangerously-skip-permissions`
- `--verbose` required with `stream-json` + `--print` or claude errors
- Delete `CLAUDECODE` from spawn env or claude refuses nested launch
- `--resume <sessionId>` on every turn after first; uses cache_read_input_tokens (~10x cheaper)
- Do NOT prepend history manually — that costs MORE than --resume
- Vault root = cwd for all spawns
- Sessions: `.obsidian/plugins/cortex/.claude/sessions/<id>.json` (metadata only; actual history in `~/.claude/projects/`)

## Current status
Working: chat panel, markdown rendering, session persistence + history UI, session resume + history display, context injection (vault tree + context file + per-note frontmatter), send-on-enter, command palette (10 cmds), export/copy, token logging, autonomous memory setting, remote session detection, configurable vault tree depth (0=off, 1-10=N levels, -1=unlimited), stdin-based prompt delivery (fixes smart-quote/special-char bugs on Windows), @-mention note injection, file/URL attachment, split-pane context awareness, permission modes (Standard/Read-only/Full access) with denial card + session upgrade, tool call visibility (collapsible), context gauge (SVG ring, click to compact), UI Bridge (@@CORTEX_ACTION protocol: open-file, open-file-split, navigate-heading, show-notice, focus-search, open-settings, run-command), command allowlist + denylist with settings browser + confirmation modal, mid-session allowlist injection, session context refresh command, command reference file (`.obsidian/plugins/cortex/commands.md` generated on layout ready — Claude reads it instead of guessing IDs), log file moved to plugin dir (`.obsidian/plugins/cortex/cortex-debug.log`), orphaned allowlist entry detection in settings UI, session manager (active session indicator, rename updates panel header on X-close, drag-and-drop reorder with sortOrder persistence, new sessions always inserted at top).

Remaining: FrontmatterGuard.ts write-protection (blocked: Claude Code doesn't support per-tool-call approval in --print mode), inline diff preview (same constraint), pinned context files UI (backburned).

Test vault: `D:\2\deleteme` (symlinked to plugin dir).

## Key files
| File                          | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `main.ts`                     | Plugin entry, 10 commands, activateView, notifyAllowlistChanged, generateCommandsFile |
| `src/ClaudeView.ts`           | Chat UI, session state, context injection, history modal, bridgeOptions, refreshSessionContext |
| `src/ClaudeProcess.ts`        | Binary detect, spawn (PowerShell on Win), stream-json parse |
| `src/ContextManager.ts`       | Vault tree + context file + allowlist assembly; all session-start context layers |
| `src/UIBridge.ts`             | @@CORTEX_ACTION parsing + execution; ConfirmCommandModal; allowlist/denylist enforcement |
| `src/settings.ts`             | Settings schema + tab UI; command browser (searchable checklist) |
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
