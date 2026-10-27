# Loop tasks for thao.ha/claude

Used by `/loop` when it runs without a prompt. Each tick, go through these in order. Follow
`CLAUDE.md` for checks, commit messages and MR rules. If something needs a person, say what in one
line and move on; don't wait for an answer.

1. **Branch state.** `git fetch origin`, then compare the current branch with its remote. Report it
   if the remote moved, the branches diverged, or merged commits disappeared from the remote. Don't
   merge, rebase, reset or push to fix it: integrating a shared branch is a person's call.
2. **Merge request.** Find the open MR for the current branch on GitLab
   (`gitlab.asoft-python.com`, project `thao.ha/claude`, usually targeting `feat/practice`). Check its
   pipeline, unresolved review threads, and whether it is behind its target branch. Address review
   comments and real failures locally, run the checks, and commit. Then ask a person to push; Claude
   can't push in this repo.
3. **Checks.** If files or local commits changed since the last tick, run `npm test`,
   `npm run typecheck` and `npm run lint` in `expense-tracker/` and report any failure with its output.
4. **CI.** CI runs on GitHub Actions (`.github/workflows/ci.yml` on `thaoha-agilityio/claude`). Report the latest
   run for the current branch's PR, `feat/practice` and `main`, with the failing job and step if any. Don't re-run or
   cancel runs. There is no deploy environment yet, so there is nothing to deploy.
5. **Nothing to do.** Say so in one line, without listing what you checked.

Never on a tick: push or force-push, rebase, reset, delete branches, close or merge MRs, or post
comments on GitLab unless someone asked for that in the conversation.
