// Run with: node --test .claude/hooks/*.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { check, splitCommands } from './block-forbidden-command.mjs'

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

test('as a hook: denies with a reason on stdout, and stays silent otherwise', () => {
  const script = fileURLToPath(new URL('./block-forbidden-command.mjs', import.meta.url))
  const run = (input) => execFileSync('node', [script], { input: JSON.stringify(input), encoding: 'utf-8' })

  const denied = JSON.parse(run({ tool_name: 'Bash', tool_input: { command: 'cd x && git push' }, cwd: '/tmp' }))
  assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(denied.hookSpecificOutput.permissionDecisionReason, /does not push/)

  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'git status' }, cwd: '/tmp' }), '')
  assert.equal(run({ tool_name: 'Read', tool_input: { file_path: '/etc/hosts' } }), '')
})
