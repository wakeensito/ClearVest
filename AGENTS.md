# Agent instructions — ClearVest

Several people (and their agents) work on this repo in parallel, each on a
different slice. `docs/handoffs/` is how context moves between them.

## Before starting work

1. Read `docs/handoffs/README.md`.
2. Read the newest handoff(s) for your area:
   `ls docs/handoffs/ | sort | tail -n 10`
3. Start from that handoff's **Next steps** unless the user says otherwise.

## After finishing a PR or milestone

Write a new handoff in the **same PR** as the work:
`docs/handoffs/YYYY-MM-DD-<team>-<slug>.md`, copied from
`docs/handoffs/_TEMPLATE.md`, every section filled. Write it for someone who
has never seen this code. Never edit another person's handoff — write a new
one and link it under **Follows**.

## House rules

- `main` is protected: branch + PR only; `ci-ok` must be green.
- Label issues/PRs with a `team:*` label.
- Never commit secrets, AWS account IDs, or ARNs.
