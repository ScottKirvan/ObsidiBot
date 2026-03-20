# Changelog

## [1.1.0](https://github.com/ScottKirvan/Cortex/compare/v1.0.0...v1.1.0) (2026-03-20)


### Features

* Attachment button: open up the paperclip to add files, URLs, and other content to the context stack ([d644f89](https://github.com/ScottKirvan/Cortex/commit/d644f892381c6b8c2956df3f2a5bcd1db22b7b05))
* current note is pre-selected in @ mention context injection & additional file types (pdf, fountain - configurable) are now supported ([a107623](https://github.com/ScottKirvan/Cortex/commit/a10762312bda06474977309e1e9a832f8ad1832f))
* frontmatter context injection and active note awareness ([#15](https://github.com/ScottKirvan/Cortex/issues/15)) ([c12aeea](https://github.com/ScottKirvan/Cortex/commit/c12aeea19d392eb40a64651883b559f7bd963e77))
* logginpg settings, verbosity settings, start/stop, file location, etc. ([169084e](https://github.com/ScottKirvan/Cortex/commit/169084e59f88b8ebe321e2c91f3c9b91a57b2d42))
* session context gas gauge added - warns about auto compaction ([6efa27b](https://github.com/ScottKirvan/Cortex/commit/6efa27b87c5fbc5268cae310692ad8b17688c2e0))
* Session-scoped pins: add a 📌 pin button next to the × on pending context items so pinned items survive send and stay in the stack for every subsequent message (see [#16](https://github.com/ScottKirvan/Cortex/issues/16)) ([83503c4](https://github.com/ScottKirvan/Cortex/commit/83503c4afd78b4e0224813ff71fe47b896ce8c8e))
* when using the @ mention context injection, pre-select the current note ([4b4775a](https://github.com/ScottKirvan/Cortex/commit/4b4775a6c2e4ffee764101c1cf9d7fa3635d6015))

## [1.0.0](https://github.com/ScottKirvan/Cortex/compare/v0.6.0...v1.0.0) (2026-03-20)


### ⚠ BREAKING CHANGES

* default permission mode is now 'standard' (acceptEdits). Users who relied on unrestricted Bash access should set Permission Mode to "Full access" in settings.

### Features

* [#40](https://github.com/ScottKirvan/Cortex/issues/40) using @ to inject full notes as context ([75f8cf0](https://github.com/ScottKirvan/Cortex/commit/75f8cf025ec9806913520e3c0b1a9777f70288c2))
* native permission modes, replace --dangerously-skip-permissions ([#18](https://github.com/ScottKirvan/Cortex/issues/18)) ([3c41827](https://github.com/ScottKirvan/Cortex/commit/3c4182799d683a1025ab74e72a0e0db0efde82ab))
* replace dangerously-skip-permissions with native permission modes ([#18](https://github.com/ScottKirvan/Cortex/issues/18)) ([1e986d8](https://github.com/ScottKirvan/Cortex/commit/1e986d824b1bcbf3edff7d43134dc9581940ea5b))
* tool call visibility, selection context injection, session replay fix ([#38](https://github.com/ScottKirvan/Cortex/issues/38), [#39](https://github.com/ScottKirvan/Cortex/issues/39), [#17](https://github.com/ScottKirvan/Cortex/issues/17)) ([61d91ef](https://github.com/ScottKirvan/Cortex/commit/61d91ef629d8e0f57ce4ac11bfe0723966a5099a))


### Bug Fixes

* fixes to tool use messages and selected text context injection ([54a2384](https://github.com/ScottKirvan/Cortex/commit/54a2384bb4e90fd749dc80d646f2027cb97904e4))

## [0.6.0](https://github.com/ScottKirvan/Cortex/compare/v0.5.0...v0.6.0) (2026-03-18)


### Features

* add Focus input, Open context file, and About commands ([3dcd5c1](https://github.com/ScottKirvan/Cortex/commit/3dcd5c1f36d8a6bee909b30e6aa8edc249038b56))
* gracefully handle and walk the user through setting up a broken claude CLI setup ([c507df8](https://github.com/ScottKirvan/Cortex/commit/c507df806d4f18e1c999ab949e3b27a4c1cca880))


### Bug Fixes

* better, but not great, handling of logged-out users ([19102b9](https://github.com/ScottKirvan/Cortex/commit/19102b91a14869d6d3fc87a11ab3ed5ecf62f536))
* move session history out of the plugin folder to fix symlink dev conflicts ([bcc42f2](https://github.com/ScottKirvan/Cortex/commit/bcc42f2f062ea4c844b114a4382b246b41c1f873))
* session focus/renaming issues ([b40c069](https://github.com/ScottKirvan/Cortex/commit/b40c069c097c22102c8ab1246265a53c32eabcb4))

## [0.5.0](https://github.com/ScottKirvan/Cortex/compare/v0.4.0...v0.5.0) (2026-03-18)


### Features

* BRAT/publication compatible build ([ba0229a](https://github.com/ScottKirvan/Cortex/commit/ba0229a1a6389989bf49a4381204b98dbd1d1041))

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
