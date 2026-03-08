TODO
----
- [x] Copy/paste not working in chat panel ✅ 2026-03-08
- [x] Show thinking indicator while waiting for response (spinner or "thinking..." text) ✅ 2026-03-08
- [ ] Frontmatter enforcement (FrontmatterGuard.ts) — readonly/protect/context:never
- [x] "send on enter" setting - make that default to true ✅ 2026-03-08
- [x] add a thin box around the right-aligned user input text in the panel. ✅ 2026-03-08
- [ ] bug: when I use shift-enter to enter multiline messages, the newlines are stripped out when the message is redisplayed in the chat panel.

In Progress
-----------
- [ ] .

Done ✓
------
- [X] Write design specs (notes/)
- [X] Write Claude.md and MEMORY.md project context
- [X] Scaffold plugin structure (manifest, package.json, tsconfig, esbuild, main.ts, src/)
- [X] npm install + npm run build passes
- [X] Test vault symlink created
- [X] Plugin loads in Obsidian — chat panel opens
- [X] Fix --no-update invalid flag
- [X] Add file logging (_cortex-debug.log)
- [X] Add spawn test fixture (test/spawn-test.mjs)
- [X] Fix --verbose required for stream-json + --print
- [X] Fix Windows/Electron spawn: use powershell.exe intermediary + stdin.end()
- [X] Fix stream-json message parser (assistant type, not content_block_delta)
- [X] End-to-end working: chat, read files, write files, tool use
- [X] Markdown rendering in assistant messages
- [X] Session persistence (--resume) + New session button + session indicator
- [X] Context injection — vault tree + context file on new session start
- [X] Send on Enter setting (toggle in Settings → Cortex)
- [X] Strip verbose env logging from ClaudeProcess.ts
- [X] Install Hot Reload plugin in test vault for faster iteration

Not Gonna Do
------------
- [x] bug: ctrl-enter doesn't work to send messages, even when "send on enter" is enabled. ✅ 2026-03-08
	-  ctrl-enter is gobbled up by a system level user setting - skip it
