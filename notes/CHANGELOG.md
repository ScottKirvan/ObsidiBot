# Changelog

## [0.4.0](https://github.com/ScottKirvan/Cortex/compare/v0.3.1...v0.4.0) (2026-03-17)


### Features

* added an interrupt/stop button for interrupting long or unwanted tasks. ([3df5318](https://github.com/ScottKirvan/Cortex/commit/3df5318f6cdbfeb840832a66d03c0bc705ac7107))
* UI Bridge: allow Claude to trigger Obsidian UI actions [#32](https://github.com/ScottKirvan/Cortex/issues/32) - automatically open notes, focus on a section, etc. ([e16af56](https://github.com/ScottKirvan/Cortex/commit/e16af56b0242fee5247efcae02a3a6755e8f6c15))

## [0.3.1](https://github.com/ScottKirvan/Cortex/compare/v0.3.0...v0.3.1) (2026-03-17)


### Bug Fixes

* add layer 0 context to give the agent some "you are here" context ([0bb37af](https://github.com/ScottKirvan/Cortex/commit/0bb37afb9dd96487174aab163ad5ef2521363607))

## [0.3.0](https://github.com/ScottKirvan/Cortex/compare/v0.2.1...v0.3.0) (2026-03-17)


### Features

* [#21](https://github.com/ScottKirvan/Cortex/issues/21) Vault context file auto-generation on first launch ([7329009](https://github.com/ScottKirvan/Cortex/commit/7329009f76998e218b7f95cac516bc5c987246ad))
* [#7](https://github.com/ScottKirvan/Cortex/issues/7)  Improve "thinking" feedback (better spinner/status while waiting) ([b15790f](https://github.com/ScottKirvan/Cortex/commit/b15790fbe824f313d5236d9cc5c7bf93abc81f6a))
* [#8](https://github.com/ScottKirvan/Cortex/issues/8)  Up/down arrow to scroll through previous input messages ([92d198b](https://github.com/ScottKirvan/Cortex/commit/92d198b4c6c2343927785043e69fce7525483ad4))
* added vault tree (context) depth settings ([5248300](https://github.com/ScottKirvan/Cortex/commit/5248300b9aa0bb1ca319dd0ef92edfebd48ae9cb))
* UI updates - new icons, access to online help, discord, settings, etc, from the chat panel ([6b988fb](https://github.com/ScottKirvan/Cortex/commit/6b988fb0b37fdd6bd9d847e89eef3ab045db9c53))


### Bug Fixes

* bug[#4](https://github.com/ScottKirvan/Cortex/issues/4) add unicode curly quotes support (smart-quoted text) ([c27e89d](https://github.com/ScottKirvan/Cortex/commit/c27e89dd956a26012553f952abcdf48519de2a0a))
* bug[#6](https://github.com/ScottKirvan/Cortex/issues/6) Include markdown in command-copied data from the chat-panel (plus a file size refactor) ([c3af74b](https://github.com/ScottKirvan/Cortex/commit/c3af74b25acf89d4dc41fdc359170ec74496825e))
* release-please version updating support for package.json ([c42fb94](https://github.com/ScottKirvan/Cortex/commit/c42fb944ef6be9369aa5f5f2198bc7e361936b60))
* replace the phrase, "Ask Claude..." with "Ask Cortex..." ([0000322](https://github.com/ScottKirvan/Cortex/commit/00003225043d7f1b17cd7b3f18231acd454ebbfb))
* text parsing of doublequotes - included unit test ([96c5b52](https://github.com/ScottKirvan/Cortex/commit/96c5b52240152fcb93489584c6406092297cc87d))

## [0.2.1](https://github.com/ScottKirvan/Cortex/compare/v0.2.0...v0.2.1) (2026-03-10)


### Bug Fixes

* test checkin - ignore ([b199bef](https://github.com/ScottKirvan/Cortex/commit/b199bef8f1757560d85d3f6bbd2ada60813df480))

## [0.2.0](https://github.com/ScottKirvan/Cortex/compare/v0.1.0...v0.2.0) (2026-03-10)


### Features

* Markdown rendering of responses in the panel ([5856475](https://github.com/ScottKirvan/Cortex/commit/5856475a3b620237b91242737b42181681978f69))
* plugin bootstrapped - beginning testing/debugging of basic systems ([5c4d024](https://github.com/ScottKirvan/Cortex/commit/5c4d024cc87cef6cf792f087e348f51d72db36ca))
* send-on-enter option added to settings and functionality.  Plus, lots of visual cleanup - looking sexy ([b9acdf8](https://github.com/ScottKirvan/Cortex/commit/b9acdf831532eb676dbdabcf94cb36d19d6f52b5))
* session history UI, command palette, UI polish, and token logging ([c37d65a](https://github.com/ScottKirvan/Cortex/commit/c37d65ac79e02d4347fb2a737e12d4d2d36d9a11))
* session, context, and memory management ([16d288b](https://github.com/ScottKirvan/Cortex/commit/16d288bc1b0dbcb8d47d243fe93bb07768d16f9c))
* support built-in, configurable context: _claude-context.md ([66f777a](https://github.com/ScottKirvan/Cortex/commit/66f777ac7df88cb4d0bb34b3f1f478fb7af3ee31))


### Bug Fixes

* added session persistence - claude will remember your name now ([dd76ab9](https://github.com/ScottKirvan/Cortex/commit/dd76ab96e533b12c9331fbbfc753e8c2b17f459b))
* adding the code workspace to the project ([78f9d16](https://github.com/ScottKirvan/Cortex/commit/78f9d16acfa4e3dbd4e1430ef00435c831c560c5))
* claude initialization ([7759e80](https://github.com/ScottKirvan/Cortex/commit/7759e8090705f88c00f2cc5a1b6853557ae2d543))
* cleanup verbose logging ([4c691ba](https://github.com/ScottKirvan/Cortex/commit/4c691ba8969713c907bd418bef32085aa4ed9a39))
* copy/paste working ([8cdd637](https://github.com/ScottKirvan/Cortex/commit/8cdd637bcf489c6ffba98040fd4691dd5d865a07))
* first working version - read/write files in the vault ([b635aa9](https://github.com/ScottKirvan/Cortex/commit/b635aa9ee707a5cde8614c92ea42bbc33d2699f9))
* multiline input text now displays correctly in the chat panel ([2f0b5ad](https://github.com/ScottKirvan/Cortex/commit/2f0b5adc280ad6466b3022145b456d7ff8550917))
* remove obsidian data files from the repo - oops ([32020e9](https://github.com/ScottKirvan/Cortex/commit/32020e96cf48784feac119ad31d599da2289e6b7))
* sendOnEnter defaults to true now. Added a css box around the user message in the chat panel. ([ed2eb6b](https://github.com/ScottKirvan/Cortex/commit/ed2eb6be9bfff52ad4ba20f899c022299c158224))

## 1.0.0 (2026-03-09)


### Features

* Markdown rendering of responses in the panel ([5856475](https://github.com/ScottKirvan/Cortex/commit/5856475a3b620237b91242737b42181681978f69))
* plugin bootstrapped - beginning testing/debugging of basic systems ([5c4d024](https://github.com/ScottKirvan/Cortex/commit/5c4d024cc87cef6cf792f087e348f51d72db36ca))
* send-on-enter option added to settings and functionality.  Plus, lots of visual cleanup - looking sexy ([b9acdf8](https://github.com/ScottKirvan/Cortex/commit/b9acdf831532eb676dbdabcf94cb36d19d6f52b5))
* session, context, and memory management ([16d288b](https://github.com/ScottKirvan/Cortex/commit/16d288bc1b0dbcb8d47d243fe93bb07768d16f9c))
* support built-in, configurable context: _claude-context.md ([66f777a](https://github.com/ScottKirvan/Cortex/commit/66f777ac7df88cb4d0bb34b3f1f478fb7af3ee31))


### Bug Fixes

* added session persistence - claude will remember your name now ([dd76ab9](https://github.com/ScottKirvan/Cortex/commit/dd76ab96e533b12c9331fbbfc753e8c2b17f459b))
* adding the code workspace to the project ([78f9d16](https://github.com/ScottKirvan/Cortex/commit/78f9d16acfa4e3dbd4e1430ef00435c831c560c5))
* claude initialization ([7759e80](https://github.com/ScottKirvan/Cortex/commit/7759e8090705f88c00f2cc5a1b6853557ae2d543))
* cleanup verbose logging ([4c691ba](https://github.com/ScottKirvan/Cortex/commit/4c691ba8969713c907bd418bef32085aa4ed9a39))
* copy/paste working ([8cdd637](https://github.com/ScottKirvan/Cortex/commit/8cdd637bcf489c6ffba98040fd4691dd5d865a07))
* first working version - read/write files in the vault ([b635aa9](https://github.com/ScottKirvan/Cortex/commit/b635aa9ee707a5cde8614c92ea42bbc33d2699f9))
* multiline input text now displays correctly in the chat panel ([2f0b5ad](https://github.com/ScottKirvan/Cortex/commit/2f0b5adc280ad6466b3022145b456d7ff8550917))
* remove obsidian data files from the repo - oops ([32020e9](https://github.com/ScottKirvan/Cortex/commit/32020e96cf48784feac119ad31d599da2289e6b7))
* sendOnEnter defaults to true now. Added a css box around the user message in the chat panel. ([ed2eb6b](https://github.com/ScottKirvan/Cortex/commit/ed2eb6be9bfff52ad4ba20f899c022299c158224))

## Changelog
>[!NOTE]
> This file and it's version format is automatically 
> generated by [Please-Release](https://github.com/googleapis/release-please-action), 
> and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
