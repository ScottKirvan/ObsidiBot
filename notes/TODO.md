TODO
----
### Bugs
*(none open)*

### Features — near term
- [ ] #10 Inline content generation (generate text at cursor in active note)
- [ ] #13 Login management (detect login state, surface login prompt)
- [ ] #15 FrontmatterGuard: per-note readonly/protect/instructions/context controls (FrontmatterGuard.ts stubbed)
- [ ] #16 Pinned context: permanent and session-scoped note pinning (backburned)
- [ ] #17 Inline selection context: send highlighted editor text to Cortex as context
- [ ] #18 Native permission dialog to replace --dangerously-skip-permissions
- [ ] #19 Compaction detection and user notification
- [ ] #20 Configurable session storage location
- [ ] #22 Setting: re-inject context on every turn (not just session start)
- [ ] #29 Image/PDF support

### Features — low priority / post-v1
- [ ] #23 Dataview / metadata graph awareness
- [ ] #24 Template integration (Templater/core Templates)
- [ ] #25 Git integration: commit messages, branch summaries, change review
- [ ] #26 Multi-context profiles: saved pin sets for different workflow modes
- [ ] #27 Slash commands: custom Cortex commands from vault files
- [ ] #28 Canvas integration: read and generate Obsidian Canvas files

Done ✓
------
- [x] #7  Improve "thinking" feedback — dynamic status label in assistant bubble ✅ 2026-03-17
- [x] #8  Up/down arrow to scroll through previous input messages ✅ 2026-03-17
- [x] #21 Vault context file auto-generation on first launch (modal + Claude-generated or blank) ✅ 2026-03-17
- [x] #30 Use Lucide icons for all app icons ✅ 2026-03-17
- [x] #4  Smart quote / special char bug breaks input stream ✅ 2026-03-17
- [x] #6  Copy/Export only copies text content, not full markdown ✅ 2026-03-17
- [x] #12 Add Cortex Command: Open Settings ✅ 2026-03-17
- [x] #14 Ctrl+P command names out of date in USER_README.md ✅ 2026-03-17
- [x] #9  Replace "Ask Claude..." with "Ask Cortex..." in input box ✅ 2026-03-12
- [x] #5  Renaming a session not seeing keyboard input ✅ 2026-03-09
- [x] Add standard plugin commands (New session, Clear session, Toggle panel, Session history, Export, Copy last) ✅ 2026-03-09
- [x] Session history: delete, search/filter, New Session button, named sessions ✅ 2026-03-09
- [x] Option B session architecture: --resume on session load only ✅ 2026-03-09
- [x] Configurable vault tree depth (0=off, 1-10 levels, -1=unlimited) ✅ 2026-03-17
- [x] release-please: package.json version bump on release ✅ 2026-03-17
- [x] release-please: build + zip artifact uploaded to GitHub release ✅ 2026-03-17
- [x] Icon buttons + bottom input toolbar (send, paperclip stub, slash stub) ✅ 2026-03-17
- [x] Help/About modal with logo, version, docs + Discord links ✅ 2026-03-17
- [x] Context file setup modal on first launch (generate with Claude / blank / skip) ✅ 2026-03-17
- [x] README updated for public beta + Discord + correct install steps ✅ 2026-03-17
- [x] Internal dev docs moved to notes/dev/ ✅ 2026-03-17
- [x] Fix Windows/Electron spawn: stdin-based prompt delivery (fixes smart-quote bugs) ✅ 2026-03-17
- [x] End-to-end working: chat, read files, write files, tool use
- [x] Markdown rendering in assistant messages
- [x] Session persistence (--resume) + session indicator
- [x] Context injection — vault tree + context file on new session start
- [x] Send on Enter setting; Shift+Enter for newline
- [x] Copy/paste working in chat panel
- [x] Thinking indicator while waiting for response

Not Gonna Do
------------
- ctrl-enter to send — gobbled up by system-level user setting, skip it
