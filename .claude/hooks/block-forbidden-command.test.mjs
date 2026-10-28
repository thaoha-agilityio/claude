// Run with: node --test .claude/hooks/*.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { check, checkTool, isSecretGlob, isSecretPath, splitCommands } from './block-forbidden-command.mjs'

const onBranch = (branch) => ({ currentBranch: () => branch })
const blocked = (command, branch = 'feat/x') => assert.ok(check(command, onBranch(branch)), `expected "${command}" to be blocked`)
const allowed = (command, branch = 'feat/x') => assert.equal(check(command, onBranch(branch)), null, `expected "${command}" to run`)

test('splits on separators but keeps quoted text together', () => {
  assert.deepEqual(splitCommands(`cd app && git commit -m "fix: a && b"; echo 'x | y'`), [
    ['cd', 'app'],
    ['git', 'commit', '-m', 'fix: a && b'],
    ['echo', 'x | y'],
  ])
  assert.deepEqual(splitCommands('echo $(git push)'), [['echo'], ['git', 'push']])
})

test('blocks pushing and history rewrites in any position', () => {
  for (const command of [
    'git push',
    'git push -u origin feat/x',
    'cd expense-tracker && git push origin HEAD',
    'npm test; git push --force',
    'git -C /home/thaoha/claude push',
    'git -c core.editor=true rebase -i main',
    'git reset --hard HEAD~1',
    'GIT_TRACE=1 git push',
    'bash -c "git push origin main"',
    'echo ok | xargs git push',
    'git branch -f feat/practice origin/feat/practice',
    'git checkout -B feat/practice',
    'git switch -C main',
    'git commit --amend --no-edit',
    'git commit -n -m "skip checks"',
    'git commit --no-verify -m "x"',
  ]) {
    blocked(command)
  }
})

test('blocks commits on protected branches unless the command creates a branch first', () => {
  blocked('git commit -m "docs: x"', 'feat/practice')
  blocked('git add . && git commit -m "x"', 'main')
  allowed('git checkout -b feat/new && git commit -m "x"', 'feat/practice')
  allowed('git switch -c fix/9-csrf && git commit -m "x"', 'main')
  allowed('git commit -m "x"', 'fix/9-csrf')
})

test('blocks rm -rf on the repo, home or root, but not on build output', () => {
  for (const command of ['rm -rf /', 'rm -rf ~', 'rm -fr .', 'rm -r -f ..', 'rm --recursive --force .git', 'sudo rm -rf $HOME']) {
    blocked(command)
  }
  allowed('rm -rf dist node_modules/.vite test-results')
  allowed('rm -f ./notes.txt')
})

test('allows everyday commands, including ones that only mention forbidden words', () => {
  for (const command of [
    'git status',
    'git diff HEAD',
    'git log --oneline -5',
    'git fetch origin',
    'git checkout -b feat/new origin/feat/practice',
    'git branch --format="%(refname)"',
    'git commit -m "docs: explain why we never git push here"',
    'echo "git push"',
    'npm test && npm run lint',
    'grep -rn "reset" src',
  ]) {
    allowed(command)
  }
})

test('blocks approving and merging pull requests with gh, but not other PR commands', () => {
  for (const command of [
    'gh pr review 3 --approve',
    'gh pr review -a',
    'gh pr review 3 --approve --body "ship it"',
    'cd x && gh pr merge 3 --squash',
    'bash -c "gh pr merge 3"',
  ]) {
    blocked(command)
  }
  allowed('gh pr review 3 --comment -b "looks fine"')
  allowed('gh pr review 3 --request-changes -b "see thread"')
  allowed('gh pr view 3')
  allowed('gh pr create --base main --head release/v0.1.0')
  allowed('echo "gh pr merge"')
})

test('blocks approving reviews and every merge through the GitHub tools', () => {
  const review = (input) => checkTool('mcp__github__pull_request_review_write', { owner: 'o', repo: 'r', pullNumber: 3, ...input })
  assert.ok(review({ method: 'create', event: 'APPROVE' }))
  assert.ok(review({ method: 'submit_pending', event: 'APPROVE' }))
  assert.equal(review({ method: 'create', event: 'COMMENT', body: 'x' }), null)
  assert.equal(review({ method: 'create', event: 'REQUEST_CHANGES', body: 'x' }), null)
  assert.equal(review({ method: 'resolve_thread', threadId: 'PRRT_x' }), null)
  assert.ok(checkTool('mcp__github__merge_pull_request', { owner: 'o', repo: 'r', pullNumber: 3 }))
  assert.equal(checkTool('mcp__github__pull_request_read', { method: 'get', pullNumber: 3 }), null)
})

test('recognises secret files but not committed examples or ordinary files', () => {
  for (const path of ['.env', 'expense-tracker/.env.local', '/home/x/.env.production', '.dev.vars', 'certs/ca.pem', 'AuthKey_X.p8', 'release.keystore']) {
    assert.ok(isSecretPath(path), path)
  }
  for (const path of ['.env.example', '.env.sample', 'src/env.ts', 'environment.md', 'wrangler.jsonc', 'keys.ts']) {
    assert.equal(isSecretPath(path), false, path)
  }
})

test('blocks commands and file tools that touch secret files', () => {
  for (const command of ['cat .env', 'cd expense-tracker && grep TOKEN .env.local', 'cp .dev.vars /tmp/x', 'git add .env', 'bash -c "head -1 certs/ca.pem"']) {
    blocked(command)
  }
  allowed('cat .env.example')
  allowed('git commit -m "chore: ignore .env files"')
  assert.ok(checkTool('Read', { file_path: '/home/thaoha/claude/expense-tracker/.env' }))
  assert.ok(checkTool('Edit', { file_path: '.dev.vars', old_string: 'a', new_string: 'b' }))
  assert.ok(checkTool('Write', { file_path: 'certs/server.key', content: 'x' }))
  assert.ok(checkTool('Grep', { pattern: 'TOKEN', path: '.env.production' }))
  assert.equal(checkTool('Read', { file_path: 'expense-tracker/.env.example' }), null)
  assert.equal(checkTool('Read', { file_path: 'expense-tracker/src/App.tsx' }), null)
})

test('blocks globs aimed at secret files, but not globs that match ordinary files too', () => {
  for (const glob of ['.env*', '.env.*', 'certs/*.pem', '**/.dev.*', '*.p12', 'AuthKey_?.p8']) {
    assert.ok(isSecretGlob(glob), glob)
  }
  for (const glob of ['*', '*.ts', 'src/**/*', '*.md', '.env']) {
    assert.equal(isSecretGlob(glob), false, glob)
  }
  for (const command of ['cat .env*', 'ls certs/*.pem', 'cd expense-tracker && head .dev.*']) {
    blocked(command)
  }
  allowed('ls *')
  allowed('git add src/*.ts')
  allowed('rm -f *.log')
  assert.ok(checkTool('Grep', { pattern: 'TOKEN', glob: '.env*' }))
  assert.ok(checkTool('Grep', { pattern: 'BEGIN', glob: '**/*.pem' }))
  assert.equal(checkTool('Grep', { pattern: 'TOKEN', glob: '*.ts' }), null)
})

test('as a hook: denies with a reason on stdout, and stays silent otherwise', () => {
  const script = fileURLToPath(new URL('./block-forbidden-command.mjs', import.meta.url))
  const run = (input) => execFileSync('node', [script], { input: JSON.stringify(input), encoding: 'utf-8' })

  const denied = JSON.parse(run({ tool_name: 'Bash', tool_input: { command: 'cd x && git push' }, cwd: '/tmp' }))
  assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(denied.hookSpecificOutput.permissionDecisionReason, /does not push/)

  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'git status' }, cwd: '/tmp' }), '')
  assert.equal(run({ tool_name: 'Read', tool_input: { file_path: '/etc/hosts' } }), '')

  const merge = JSON.parse(run({ tool_name: 'mcp__github__merge_pull_request', tool_input: { pullNumber: 3 } }))
  assert.equal(merge.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(merge.hookSpecificOutput.permissionDecisionReason, /does not merge/)
  const comment = { method: 'create', event: 'COMMENT', pullNumber: 3 }
  assert.equal(run({ tool_name: 'mcp__github__pull_request_review_write', tool_input: comment }), '')
})
