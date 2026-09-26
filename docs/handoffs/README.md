# Handoffs

Everyone on ClearVest works on different slices at different hours. A handoff
lets the next person (or agent) pick up your work **without reading your code
or pinging you**.

## When to write one

- **Every merged PR** that changes behavior, setup, or what's next.
- **Every milestone** (MVP flow works, deploy wired, demo freeze, etc.).
- **Before you log off** mid-task — push the branch, write the handoff there.

Skip it only for typo/format-only PRs.

## How

1. Copy the template:
   `cp docs/handoffs/_TEMPLATE.md docs/handoffs/$(date +%Y-%m-%d)-<team>-<slug>.md`
   e.g. `2026-10-04-backend-auth-endpoints.md`
2. Fill it in **in the same PR** as the work — it merges with the code.
3. One file per handoff. Never edit someone else's handoff — write a new one
   that links to it. (One file each = no merge conflicts.)

## Picking up work

```bash
ls docs/handoffs/ | sort | tail -n 10          # newest last
ls docs/handoffs/ | grep -- '-backend-'         # one team's trail
grep -l "Status: in-progress" docs/handoffs/*.md  # unfinished work
```

Read the newest handoff for your area, then start from its **Next steps**.
