#!/usr/bin/env node
// PreToolUse hook for Bash: refuses commands this repo doesn't let Claude run (see "Git and merge requests" in
// CLAUDE.md). It backs up the deny patterns in .claude/settings.json, which only match a command's start and so
// miss `cd x && git push` or `git -C dir reset`.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const PROTECTED_BRANCHES = ['feat/practice', 'main']

/** Splits a shell command into simple commands, with quote-aware words. Good enough for policy checks, not a shell. */
export function splitCommands(command) {
  const commands = []
  let words = []
  let word = ''
  let inWord = false
  let quote = null
  const endWord = () => {
    if (inWord) words.push(word)
    word = ''
    inWord = false
  }
  const endCommand = () => {
    endWord()
    if (words.length) commands.push(words)
    words = []
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\' && quote === '"' && i + 1 < command.length) word += command[++i]
      else word += c
    } else if (c === "'" || c === '"') {
      quote = c
      inWord = true
    } else if (c === '\\' && i + 1 < command.length) {
      word += command[++i]
      inWord = true
    } else if (/\s/.test(c)) {
      if (c === '\n') endCommand()
      else endWord()
    } else if (';&|(){}`'.includes(c)) {
      // Separators: ; && || | & and the edges of subshells, command substitution and groups.
      endCommand()
    } else if (c === '$' && command[i + 1] === '(') {
      endCommand()
      i++
    } else {
      word += c
      inWord = true
    }
  }
  endCommand()
  return commands
}

const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path'])

/** For `git [global options] <subcommand> args…`, returns the subcommand, its args and any `-C` directory. */
function parseGit(words) {
  let i = 1
  let dir
  while (i < words.length && words[i].startsWith('-')) {
    if (words[i] === '-C') dir = words[i + 1]
    i += GIT_OPTIONS_WITH_VALUE.has(words[i]) ? 2 : 1
  }
  return { sub: words[i], args: words.slice(i + 1), dir }
}

/** Drops leading `VAR=value` assignments and wrappers like `sudo`, `env`, `command`, `nohup`, `time`. */
function stripPrefixes(words) {
  let i = 0
  while (i < words.length) {
    const w = words[i]
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || ['sudo', 'env', 'command', 'nohup', 'time', 'exec', 'xargs'].includes(w)) i++
    else break
  }
  return words.slice(i)
}

const DANGEROUS_RM_TARGETS = new Set(['/', '/*', '~', '~/', '$HOME', '${HOME}', '.', './', '..', '../', '*', '.git', '.git/'])

const hasFlag = (args, long, short) =>
  args.some((a) => a === long || a.startsWith(`${long}=`) || (short && /^-[A-Za-z]+$/.test(a) && a.includes(short)))

/**
 * Returns why `command` is forbidden, or null when it may run.
 * `currentBranch(dir)` reports the checked-out branch, used to refuse commits on protected branches.
 */
export function check(command, { currentBranch = () => null } = {}) {
  const commands = splitCommands(command)
  let switchedBranch = false

  for (const raw of commands) {
    const words = stripPrefixes(raw)
    const [name] = words
    if (!name) continue
    const program = name.split('/').pop()

    // Look inside `bash -c "…"` and `eval "…"`.
    if (['bash', 'sh', 'zsh'].includes(program)) {
      const at = words.indexOf('-c')
      if (at !== -1 && words[at + 1]) {
        const reason = check(words[at + 1], { currentBranch })
        if (reason) return reason
      }
      continue
    }
    if (program === 'eval') {
      const reason = check(words.slice(1).join(' '), { currentBranch })
      if (reason) return reason
      continue
    }

    if (program === 'rm') {
      const args = words.slice(1)
      const flags = args.filter((a) => a.startsWith('-') && a !== '--')
      const recursive = flags.some((f) => f === '--recursive' || (/^-[A-Za-z]+$/.test(f) && /[rR]/.test(f)))
      const force = flags.some((f) => f === '--force' || (/^-[A-Za-z]+$/.test(f) && f.includes('f')))
      const target = args.find((a) => DANGEROUS_RM_TARGETS.has(a))
      if (recursive && force && target) return `\`rm -rf ${target}\` would delete far more than intended.`
      continue
    }

    if (program !== 'git') continue
    const { sub, args, dir } = parseGit(words)

    if (sub === 'push') return 'Claude does not push in this repo; ask the user to run `git push` themselves.'
    if (sub === 'reset') return '`git reset` rewrites history or discards work; ask the user to run it if it is really needed.'
    if (sub === 'rebase') return '`git rebase` rewrites history; ask the user to run it if it is really needed.'
    if (sub === 'filter-branch' || sub === 'filter-repo') return 'Rewriting history is not allowed.'
    if (sub === 'branch' && hasFlag(args, '--force', 'f')) return 'Force-moving a branch rewrites it; ask the user.'
    if ((sub === 'checkout' && args.includes('-B')) || (sub === 'switch' && (args.includes('-C') || args.includes('--force-create')))) {
      return 'Force-resetting a branch with -B/-C rewrites it; ask the user.'
    }
    if ((sub === 'checkout' && args.includes('-b')) || (sub === 'switch' && (args.includes('-c') || args.includes('--create')))) {
      switchedBranch = true
    }
    if (sub === 'commit') {
      if (args.includes('--amend')) return '`git commit --amend` rewrites the last commit; make a new commit instead.'
      if (hasFlag(args, '--no-verify', 'n')) return '`--no-verify` skips the repo’s checks; fix what they report instead.'
      const branch = switchedBranch ? null : currentBranch(dir)
      if (branch && PROTECTED_BRANCHES.includes(branch)) {
        return `Don't commit on ${branch}; create a branch first (\`git checkout -b fix/<issue>-<slug>\` or \`feat/<slug>\`).`
      }
    }
  }
  return null
}

function gitBranch(cwd, dir) {
  try {
    const where = dir ? (dir.startsWith('/') ? dir : `${cwd}/${dir}`) : cwd
    return execFileSync('git', ['-C', where, 'branch', '--show-current'], { encoding: 'utf-8' }).trim() || null
  } catch {
    return null
  }
}

async function main() {
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  const { tool_name: tool, tool_input: toolInput = {}, cwd = process.cwd() } = JSON.parse(input || '{}')
  if (tool !== 'Bash' || typeof toolInput.command !== 'string') return

  const reason = check(toolInput.command, { currentBranch: (dir) => gitBranch(cwd, dir) })
  if (!reason) return
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Blocked by .claude/hooks/block-forbidden-command.mjs: ${reason}`,
      },
    }),
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
