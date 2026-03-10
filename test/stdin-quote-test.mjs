/**
 * Tests that prompts containing smart/curly quotes are delivered intact to claude.
 * Runs via: node test/stdin-quote-test.mjs
 *
 * Validates the stdin-based prompt passing approach in ClaudeProcess.ts.
 * Uses the same spawn logic as the plugin (PowerShell on Windows, direct on others).
 */

import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ---------------------------------------------------------------------------
// Test cases — prompts that previously broke via CLI arg quoting
// ---------------------------------------------------------------------------
const TESTS = [
  {
    name: 'Smart single quotes (contractions)',
    prompt: 'Reply with only the word: it\u2019s',  // right single quote U+2019
    expect: "it's",
  },
  {
    name: 'Smart double quotes',
    prompt: 'Reply with only the word: \u201Cgot it\u201D',  // left+right double quotes U+201C/201D
    expect: 'got it',
  },
  {
    name: 'Mixed smart quotes',
    prompt: 'Reply with only the text: I\u2019m saying \u201Chello\u201D',
    expect: "I'm saying",  // just check it doesn't truncate
  },
  {
    name: 'Plain ASCII (control)',
    prompt: 'Reply with only the word: hello',
    expect: 'hello',
  },
];

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------
function findClaudeBinary() {
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
    const result = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0];
    if (result && existsSync(result)) return result;
  } catch { /* not in PATH */ }

  const home = homedir();
  const candidates = [
    join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
    join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
    join(home, 'AppData', 'Roaming', 'npm', 'claude'),
    join(home, '.local', 'bin', 'claude.exe'),
    join(home, '.local', 'bin', 'claude'),
    '/usr/local/bin/claude',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Spawn (mirrors ClaudeProcess.ts)
// ---------------------------------------------------------------------------
function spawnClaude(binary, prompt) {
  const args = [
    '--output-format', 'stream-json',
    '--verbose',
    '--print',
    '--dangerously-skip-permissions',
  ];

  const env = { ...process.env };
  delete env['CLAUDECODE'];

  let proc;

  if (process.platform === 'win32') {
    const ps = (s) => `'${s.replace(/'/g, "''")}'`;
    const psCmd = `& ${ps(binary)} ${args.map(ps).join(' ')}`;
    proc = spawn('powershell.exe', ['-NonInteractive', '-Command', psCmd], {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
  } else {
    proc = spawn(binary, args, {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
  }

  // Write prompt via stdin — the approach under test
  proc.stdin?.write(prompt, 'utf8');
  proc.stdin?.end();

  return proc;
}

// ---------------------------------------------------------------------------
// Run one test
// ---------------------------------------------------------------------------
function runTest(binary, testCase) {
  return new Promise((resolve) => {
    console.log(`\n[TEST] ${testCase.name}`);
    console.log(`  prompt : ${JSON.stringify(testCase.prompt)}`);
    console.log(`  expect : contains "${testCase.expect}"`);

    const proc = spawnClaude(binary, testCase.prompt);
    let buffer = '';
    let receivedText = '';
    let stderrLines = [];
    const startMs = Date.now();

    proc.stdout?.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'assistant') {
            const content = msg.message?.content ?? [];
            for (const block of content) {
              if (block.type === 'text') receivedText += block.text;
            }
          }
        } catch { /* non-JSON */ }
      }
    });

    proc.stderr?.on('data', (chunk) => {
      stderrLines.push(chunk.toString().trim());
    });

    proc.on('close', (code) => {
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      const pass = receivedText.toLowerCase().includes(testCase.expect.toLowerCase());
      const status = pass ? 'PASS' : 'FAIL';
      console.log(`  response: ${JSON.stringify(receivedText.trim())}`);
      if (stderrLines.length > 0) {
        console.log(`  stderr  : ${stderrLines.slice(0, 3).join(' | ')}`);
      }
      console.log(`  result  : ${status} (${elapsed}s, exit ${code})`);
      resolve({ name: testCase.name, pass, response: receivedText.trim() });
    });

    proc.on('error', (err) => {
      console.log(`  ERROR: ${err.message}`);
      resolve({ name: testCase.name, pass: false, response: '' });
    });

    // Timeout
    setTimeout(() => {
      console.log(`  TIMEOUT after 30s`);
      proc.kill();
      resolve({ name: testCase.name, pass: false, response: 'TIMEOUT' });
    }, 30_000);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const binary = findClaudeBinary();
if (!binary) {
  console.error('ERROR: claude binary not found');
  process.exit(1);
}

console.log('Binary:', binary);
console.log('Platform:', process.platform);
console.log('Running', TESTS.length, 'tests sequentially (each calls Claude)...');

let passed = 0;
for (const test of TESTS) {
  const result = await runTest(binary, test);
  if (result.pass) passed++;
}

console.log(`\n==============================`);
console.log(`Results: ${passed}/${TESTS.length} passed`);
console.log(`==============================`);
process.exit(passed === TESTS.length ? 0 : 1);
