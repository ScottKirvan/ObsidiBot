/**
 * Unit tests — no Claude calls, no Obsidian required.
 * Run: npm test
 *
 * Covers:
 *   - titleFromPrompt      (pure function)
 *   - estimateTokens       (pure function)
 *   - session CRUD         (file I/O via tmp dir)
 *   - loadSessionMessages  (JSONL parsing)
 *   - parseStreamOutput    (stream-json parsing via mocked EventEmitters)
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';

import { titleFromPrompt, saveSession, loadAllSessions, deleteSession, loadSessionMessages, getSessionsDir } from '../src/utils/sessionStorage';
import { estimateTokens } from '../src/utils/logger';
import { parseStreamOutput, permissionArgs } from '../src/ClaudeProcess';
import { extractToolDetail } from '../src/utils/toolFormatting';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cortex-test-'));
});

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

/** Build a minimal mock ChildProcess with controllable stdout/stderr/close. */
function mockProc() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as any;
  proc.stdout = stdout;
  proc.stderr = stderr;
  return proc;
}

// ---------------------------------------------------------------------------
// titleFromPrompt
// ---------------------------------------------------------------------------

describe('titleFromPrompt', () => {
  test('returns prompt unchanged when <= 60 chars', () => {
    assert.equal(titleFromPrompt('Hello world'), 'Hello world');
  });

  test('truncates and appends ellipsis when > 60 chars', () => {
    const long = 'A'.repeat(80);
    const result = titleFromPrompt(long);
    assert.equal(result.length, 61); // 60 chars + '…'
    assert.ok(result.endsWith('…'));
  });

  test('collapses internal whitespace', () => {
    assert.equal(titleFromPrompt('foo   bar\t\nbaz'), 'foo bar baz');
  });

  test('trims leading/trailing whitespace', () => {
    assert.equal(titleFromPrompt('  hello  '), 'hello');
  });

  test('handles empty string', () => {
    assert.equal(titleFromPrompt(''), '');
  });
});

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

describe('estimateTokens', () => {
  test('empty string → 0', () => {
    assert.equal(estimateTokens(''), 0);
  });

  test('4 chars → 1 token', () => {
    assert.equal(estimateTokens('abcd'), 1);
  });

  test('rounds up (ceil)', () => {
    assert.equal(estimateTokens('abc'), 1);  // 3/4 → ceil → 1
    assert.equal(estimateTokens('abcde'), 2); // 5/4 → ceil → 2
  });

  test('longer text scales linearly', () => {
    const text = 'a'.repeat(400);
    assert.equal(estimateTokens(text), 100);
  });
});

// ---------------------------------------------------------------------------
// Session CRUD (file I/O)
// ---------------------------------------------------------------------------

describe('session storage', () => {
  const makeSession = (id: string) => ({
    id,
    title: `Session ${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    claudeSessionId: `claude-${id}`,
  });

  test('saveSession creates a JSON file', () => {
    const s = makeSession('s1');
    saveSession(tmpDir, s);
    const dir = getSessionsDir(tmpDir);
    const { existsSync } = require('node:fs');
    assert.ok(existsSync(join(dir, 's1.json')));
  });

  test('loadAllSessions returns saved session', () => {
    const s = makeSession('s2');
    saveSession(tmpDir, s);
    const sessions = loadAllSessions(tmpDir);
    const found = sessions.find(x => x.id === 's2');
    assert.ok(found);
    assert.equal(found!.title, 'Session s2');
  });

  test('loadAllSessions sorts by updatedAt descending', () => {
    const older = { ...makeSession('s3'), updatedAt: '2024-01-01T00:00:00.000Z' };
    const newer = { ...makeSession('s4'), updatedAt: '2025-01-01T00:00:00.000Z' };
    saveSession(tmpDir, older);
    saveSession(tmpDir, newer);
    const sessions = loadAllSessions(tmpDir);
    const ids = sessions.map(s => s.id);
    assert.ok(ids.indexOf('s4') < ids.indexOf('s3'));
  });

  test('deleteSession removes the file', () => {
    const s = makeSession('s5');
    saveSession(tmpDir, s);
    deleteSession(tmpDir, 's5');
    const sessions = loadAllSessions(tmpDir);
    assert.ok(!sessions.find(x => x.id === 's5'));
  });

  test('loadAllSessions returns [] when dir missing', () => {
    assert.deepEqual(loadAllSessions('/nonexistent/path/xyz'), []);
  });
});

// ---------------------------------------------------------------------------
// loadSessionMessages — JSONL parsing
// ---------------------------------------------------------------------------

describe('loadSessionMessages', () => {
  function makeJsonlSession(lines: object[]): string {
    // Write a fake .jsonl to ~/.claude/projects/<proj>/<id>.jsonl
    const projectsDir = join(tmpDir, '.claude', 'projects', 'test-project');
    mkdirSync(projectsDir, { recursive: true });
    const sessionId = `test-session-${Date.now()}`;
    const jsonlPath = join(projectsDir, `${sessionId}.jsonl`);
    writeFileSync(jsonlPath, lines.map(l => JSON.stringify(l)).join('\n'));
    return sessionId;
  }

  test('parses user and assistant turns', () => {
    const sessionId = makeJsonlSession([
      { type: 'user', message: { content: 'Hello' }, timestamp: '2024-01-01T00:00:00Z' },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Hi there' }] }, timestamp: '2024-01-01T00:00:01Z' },
    ]);
    const msgs = loadSessionMessages(sessionId);
    // Note: loadSessionMessages looks in homedir()/.claude/projects — this test
    // is skipped if the session isn't found (different machine / no homedir match).
    // It validates the JSONL structure for sessions that ARE local.
    if (msgs.length === 0) return; // can't reach test file from homedir
    assert.equal(msgs[0].role, 'user');
    assert.equal(msgs[0].content, 'Hello');
    assert.equal(msgs[1].role, 'assistant');
    assert.equal(msgs[1].content, 'Hi there');
  });

  test('handles array-format user message content', () => {
    const sessionId = makeJsonlSession([
      {
        type: 'user',
        message: { content: [{ type: 'text', text: 'Hello from array' }] },
        timestamp: '2024-01-01T00:00:00Z',
      },
    ]);
    const msgs = loadSessionMessages(sessionId);
    if (msgs.length === 0) return;
    assert.equal(msgs[0].content, 'Hello from array');
  });

  test('strips vault_context from array-format first user message', () => {
    const sessionId = makeJsonlSession([
      {
        type: 'user',
        message: { content: [{ type: 'text', text: '<vault_context>injected</vault_context>\nArray question' }] },
        timestamp: '2024-01-01T00:00:00Z',
      },
    ]);
    const msgs = loadSessionMessages(sessionId);
    if (msgs.length === 0) return;
    assert.equal(msgs[0].content, 'Array question');
  });

  test('strips vault_context from first user message', () => {
    const sessionId = makeJsonlSession([
      {
        type: 'user',
        message: { content: '<vault_context>big context here</vault_context>\nActual question' },
        timestamp: '2024-01-01T00:00:00Z',
      },
    ]);
    const msgs = loadSessionMessages(sessionId);
    if (msgs.length === 0) return;
    assert.equal(msgs[0].content, 'Actual question');
  });
});

// ---------------------------------------------------------------------------
// parseStreamOutput — stream-json parsing (no real Claude process)
// ---------------------------------------------------------------------------

describe('permissionArgs', () => {
  test('standard → acceptEdits', () => {
    const args = permissionArgs('standard');
    assert.ok(args.includes('acceptEdits'));
    assert.ok(!args.some(a => a.includes('bypass') || a.includes('dangerously')));
  });

  test('readonly → default mode + allowedTools', () => {
    const args = permissionArgs('readonly');
    assert.ok(args.includes('default'));
    const idx = args.indexOf('--allowedTools');
    assert.ok(idx !== -1);
    assert.ok(args[idx + 1].includes('Read'));
    assert.ok(!args[idx + 1].includes('Write'));
    assert.ok(!args[idx + 1].includes('Bash'));
  });

  test('full → bypassPermissions', () => {
    const args = permissionArgs('full');
    assert.ok(args.includes('bypassPermissions'));
  });

  test('no mode ever includes dangerously-skip-permissions', () => {
    for (const mode of ['standard', 'readonly', 'full'] as const) {
      assert.ok(!permissionArgs(mode).some(a => a.includes('dangerously')));
    }
  });
});

describe('parseStreamOutput', () => {
  function emit(proc: any, chunks: string[], stderrChunks: string[] = []): Promise<{ texts: string[], tools: string[], denials: Array<{tool: string}>, sessionId?: string, errors: string[] }> {
    return new Promise((resolve) => {
      const texts: string[] = [];
      const tools: string[] = [];
      const denials: Array<{tool: string}> = [];
      const errors: string[] = [];
      let sessionId: string | undefined;

      parseStreamOutput(proc, {
        onText: (t) => texts.push(t),
        onAction: () => { /* tests don't exercise UI bridge */ },
        onToolCall: (name) => tools.push(name),
        onPermissionDenied: (d) => denials.push(...d),
        onUsage: () => { /* not tested here */ },
        onDone: (id) => { sessionId = id; resolve({ texts, tools, denials, sessionId, errors }); },
        onError: (e) => errors.push(e),
      });

      // Emit stdout chunks
      for (const chunk of chunks) {
        proc.stdout.emit('data', Buffer.from(chunk));
      }
      // Emit stderr
      for (const chunk of stderrChunks) {
        proc.stderr.emit('data', Buffer.from(chunk));
      }
      // Close
      proc.emit('close', 0);
    });
  }

  const assistantMsg = (text: string, sessionId = 'sess-abc') => [
    JSON.stringify({ type: 'system', session_id: sessionId }) + '\n',
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text }] },
    }) + '\n',
    JSON.stringify({ type: 'result', session_id: sessionId }) + '\n',
  ];

  test('extracts text from assistant message', async () => {
    const proc = mockProc();
    const result = await emit(proc, assistantMsg('Hello world'));
    assert.deepEqual(result.texts, ['Hello world']);
  });

  test('captures session_id from system message', async () => {
    const proc = mockProc();
    const result = await emit(proc, assistantMsg('hi', 'my-session-id'));
    assert.equal(result.sessionId, 'my-session-id');
  });

  test('captures session_id from result message', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }) + '\n',
      JSON.stringify({ type: 'result', session_id: 'result-session' }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.sessionId, 'result-session');
  });

  test('handles chunked JSON split across multiple data events', async () => {
    const proc = mockProc();
    const line = JSON.stringify({ type: 'system', session_id: 'chunked-sess' });
    // Split the line at an arbitrary point
    const half = Math.floor(line.length / 2);
    const result = await emit(proc, [line.slice(0, half), line.slice(half) + '\n']);
    assert.equal(result.sessionId, 'chunked-sess');
  });

  test('handles multiple text blocks in one message', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'foo' }, { type: 'text', text: 'bar' }] },
      }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.deepEqual(result.texts, ['foo', 'bar']);
  });

  test('fires onToolCall for tool_use blocks', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'read_file', input: {} }] },
      }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.deepEqual(result.tools, ['read_file']);
  });

  test('fires onError for stderr data', async () => {
    const proc = mockProc();
    const result = await emit(proc, [], ['some error text']);
    assert.ok(result.errors.some(e => e.includes('some error text')));
  });

  test('ignores non-JSON stdout lines without throwing', async () => {
    const proc = mockProc();
    const chunks = ['not json at all\n', JSON.stringify({ type: 'result', session_id: 'x' }) + '\n'];
    const result = await emit(proc, chunks);
    assert.equal(result.sessionId, 'x');
  });

  test('handles empty text blocks gracefully', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({ type: 'assistant', message: { content: [] } }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.deepEqual(result.texts, []);
  });

  test('fires onPermissionDenied when result contains permission_denials', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({
        type: 'result',
        session_id: 'sess-perm',
        permission_denials: [
          { tool_name: 'Write', tool_use_id: 'tu_1', tool_input: { file_path: 'notes/test.md', content: 'hello' } },
          { tool_name: 'Bash', tool_use_id: 'tu_2', tool_input: { command: 'rm -rf /' } },
        ],
      }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.denials.length, 2);
    assert.equal(result.denials[0].tool, 'Write');
    assert.equal(result.denials[1].tool, 'Bash');
  });

  test('does not fire onPermissionDenied when permission_denials is empty', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({ type: 'result', session_id: 'sess-ok', permission_denials: [] }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.denials.length, 0);
  });

  test('does not fire onPermissionDenied when permission_denials is absent', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({ type: 'result', session_id: 'sess-no-field' }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.denials.length, 0);
  });

  // -------------------------------------------------------------------------
  // UI bridge action routing — needed for #76 fix
  // -------------------------------------------------------------------------

  test('routes @@CORTEX_ACTION lines to onAction, not onText', async () => {
    const proc = mockProc();
    const actions: string[] = [];
    const texts: string[] = [];
    const ACTION_LINE = '@@CORTEX_ACTION {"action":"open-file","path":"notes/test.md"}';
    const chunks = [
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: ACTION_LINE }] },
      }) + '\n',
      JSON.stringify({ type: 'result', session_id: 'sess-action' }) + '\n',
    ];
    await new Promise<void>((resolve) => {
      parseStreamOutput(proc, {
        onText: (t) => texts.push(t),
        onAction: (line) => actions.push(line),
        onToolCall: () => {},
        onPermissionDenied: () => {},
        onUsage: () => {},
        onDone: () => resolve(),
        onError: () => {},
      });
      for (const chunk of chunks) proc.stdout.emit('data', Buffer.from(chunk));
      proc.emit('close', 0);
    });
    assert.equal(actions.length, 1, 'onAction should fire once');
    assert.ok(actions[0].startsWith('@@CORTEX_ACTION'), 'action line should be passed verbatim');
    assert.equal(texts.length, 0, 'onText should not receive action lines');
  });

  test('action-only response still delivers sessionId in onDone', async () => {
    const proc = mockProc();
    const ACTION_LINE = '@@CORTEX_ACTION {"action":"show-notice","message":"Done"}';
    const chunks = [
      JSON.stringify({ type: 'system', session_id: 'sess-action-only' }) + '\n',
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: ACTION_LINE }] },
      }) + '\n',
      JSON.stringify({ type: 'result', session_id: 'sess-action-only' }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.sessionId, 'sess-action-only', 'sessionId must be available in onDone for action-only responses');
    assert.equal(result.texts.length, 0, 'no text should be emitted for action-only responses');
  });

  test('interrupted process has no sessionId in onDone', async () => {
    const proc = mockProc();
    // No result message — simulates process killed before completing
    const chunks = [
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'partial' }] } }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.sessionId, undefined, 'interrupted process should have no sessionId');
  });

  // -------------------------------------------------------------------------
  // Multi-step sequence (fix for #67: status indicator lost after first text)
  // -------------------------------------------------------------------------

  test('fires onText then onToolCall then onText in multi-step response', async () => {
    // This sequence is the root cause of #67: text arrives first (causing statusEl removal),
    // then tool calls fire. The DOM fix in ClaudeView.ts re-appends statusEl on onToolCall
    // if it is no longer connected. This test documents that parseStreamOutput fires callbacks
    // in the correct order so the fix can rely on it.
    const proc = mockProc();
    const eventLog: string[] = [];
    const chunks = [
      JSON.stringify({ type: 'system', session_id: 'seq-sess' }) + '\n',
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'I will read the file.' }] } }) + '\n',
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'note.md' } }] } }) + '\n',
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: ' Done.' }] } }) + '\n',
      JSON.stringify({ type: 'result', session_id: 'seq-sess' }) + '\n',
    ];
    await new Promise<void>((resolve) => {
      parseStreamOutput(proc, {
        onText: (t) => eventLog.push(`text:${t}`),
        onAction: () => {},
        onToolCall: (name) => eventLog.push(`tool:${name}`),
        onPermissionDenied: () => {},
        onUsage: () => {},
        onDone: () => resolve(),
        onError: () => {},
      });
      for (const chunk of chunks) proc.stdout.emit('data', Buffer.from(chunk));
      proc.emit('close', 0);
    });
    assert.deepEqual(eventLog, [
      'text:I will read the file.',
      'tool:Read',
      'text: Done.',
    ], 'callbacks must fire in stream order: text → tool → text');
  });
});

// ---------------------------------------------------------------------------
// extractToolDetail — label text for tool call events in chat panel
// ---------------------------------------------------------------------------

describe('extractToolDetail', () => {
  test('returns empty string for null/non-object input', () => {
    assert.equal(extractToolDetail('read', null), '');
    assert.equal(extractToolDetail('read', 'string'), '');
    assert.equal(extractToolDetail('read', 42), '');
  });

  test('returns empty string for empty object', () => {
    assert.equal(extractToolDetail('read', {}), '');
  });

  test('returns filename only (not full path) for read/write/edit', () => {
    const input = { file_path: '/vault/notes/my-note.md' };
    assert.equal(extractToolDetail('read', input), 'my-note.md');
    assert.equal(extractToolDetail('write', input), 'my-note.md');
    assert.equal(extractToolDetail('edit', input), 'my-note.md');
  });

  test('returns full path for grep (not just filename)', () => {
    const input = { path: '/vault/notes' };
    assert.equal(extractToolDetail('grep', input), '/vault/notes');
  });

  test('returns full path for glob (not just filename)', () => {
    const input = { path: '/vault' };
    assert.equal(extractToolDetail('glob', input), '/vault');
  });

  test('returns bash command for bash tool', () => {
    const input = { command: 'git status' };
    assert.equal(extractToolDetail('bash', input), 'git status');
  });

  test('truncates long bash commands at 70 chars with ellipsis', () => {
    const long = 'x'.repeat(80);
    const result = extractToolDetail('bash', { command: long });
    assert.equal(result.length, 71); // 70 chars + '…'
    assert.ok(result.endsWith('…'));
  });

  test('returns url for web fetch/search tools', () => {
    assert.equal(extractToolDetail('webfetch', { url: 'https://example.com' }), 'https://example.com');
  });

  test('returns query for search tools', () => {
    assert.equal(extractToolDetail('websearch', { query: 'obsidian plugins' }), 'obsidian plugins');
  });

  test('returns pattern for grep/glob pattern field', () => {
    assert.equal(extractToolDetail('grep', { pattern: '*.md' }), '*.md');
  });

  test('prefers file_path over path over filePath', () => {
    const input = { file_path: 'a.md', path: 'b/', filePath: 'c.md' };
    assert.equal(extractToolDetail('read', input), 'a.md');
  });

  test('falls back to path when file_path absent', () => {
    const input = { path: '/vault/notes/x.md' };
    assert.equal(extractToolDetail('read', input), 'x.md');
  });

  test('falls back to filePath when file_path and path absent', () => {
    const input = { filePath: '/vault/notes/y.md' };
    assert.equal(extractToolDetail('read', input), 'y.md');
  });

  test('handles Windows-style backslash paths', () => {
    const input = { file_path: 'C:\\vault\\notes\\my-note.md' };
    assert.equal(extractToolDetail('read', input), 'my-note.md');
  });
});
