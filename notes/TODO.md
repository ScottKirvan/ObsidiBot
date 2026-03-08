TODO
----
- [ ] Copy/paste not working in chat panel
- [ ] Markdown rendering in assistant messages (currently plain text)
- [ ] Session persistence — resume previous conversation with --resume <sessionId>
- [ ] Show thinking indicator while waiting for response (spinner or "thinking..." text)
- [ ] Context injection (ContextManager.ts) — vault tree + context file at session start
- [ ] Frontmatter enforcement (FrontmatterGuard.ts) — readonly/protect/context:never
- [ ] Install Hot Reload plugin in test vault for faster iteration
- [ ] Strip verbose env logging from ClaudeProcess.ts (PATH/APPDATA lines) once stable
- [ ] Commit current working state

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

Not Gonna Do
------------
- [ ] .
