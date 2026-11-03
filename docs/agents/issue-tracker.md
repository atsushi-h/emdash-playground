# Issue tracker: GitHub

Issues and specs live in `atsushi-h/emdash-playground`.
Use the `gh` CLI from this repository.

## Conventions

- Before the first issue creation in a session, verify the target with
  `gh repo view --json nameWithOwner`.
  The expected repository is `atsushi-h/emdash-playground`.
- Create: `gh issue create --title "..." --body-file <file>`.
  For multiline bodies and comments, write the exact text to a temporary
  file and pass it with `--body-file`.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels`.
- Comment: `gh issue comment <number> --body-file <file>`.
- Apply/remove labels:
  `gh issue edit <number> --add-label "..." --remove-label "..."`.
- Close: post an explanation as a comment, then `gh issue close <number>`.
- Prefer GitHub native sub-issues and issue dependencies.
  Where unavailable, put `Part of #<parent>` and
  `Blocked by: #<number>` at the top of the child issue body.
  A ticket is unblocked when all blockers are closed.
- File issues only in the user's repository, never in the upstream
  skills repository.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill instructions

When a skill says "publish to the issue tracker", create a GitHub issue.
When a skill says "fetch the relevant ticket", read the GitHub issue.
