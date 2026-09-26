# API keys added to SSM Parameter Store (Alpha Vantage, Plaid)

- **Date:** 2026-09-26
- **Author:** @MaxCadet
- **Team:** devops
- **Status:** done
- **PR / issue:** #9 (secrets handling), unblocks #3 and #18
- **Branch:** devops/ssm-api-keys
- **Follows:** 2026-09-26-backend-architecture-spec.md

## What changed

- Added three API keys to AWS Systems Manager Parameter Store in `us-east-1`
  as `SecureString`, Standard tier, default KMS key (`alias/aws/ssm`):
  `clearvest-alphavantage`, `clearvest-plaid-client-id`, `clearvest-plaid-secret`.
- Settled the naming question left open in the backend spec handoff: every key is
  **flat, lowercase, `clearvest-` prefixed** (no leading slash, no path hierarchy),
  matching the first key `clearvest-fmp`. Names are case-sensitive.
- Decided there will be **no `clearvest-fred` parameter** (see Decisions).

Parameter names now expected in SSM (names only, never values):

| Parameter | State | Owner |
|---|---|---|
| `clearvest-fmp` | exists (added by @wakeensito, per the backend spec handoff) | backend |
| `clearvest-alphavantage` | **added in this handoff** | devops |
| `clearvest-plaid-client-id` | **added in this handoff** (sandbox) | devops |
| `clearvest-plaid-secret` | **added in this handoff** (sandbox) | devops |
| `clearvest-elevenlabs` | still needed | ai / devops |
| `clearvest-sec-user-agent` | still needed (plain string, not a secret) | data |
| `clearvest-fred` | **will not exist**, FRED is keyless (see Decisions) | — |

## How to run / verify it

```bash
# Names, types and versions only. Never print the values.
aws ssm get-parameters --region us-east-1 \
  --names clearvest-alphavantage clearvest-plaid-client-id clearvest-plaid-secret \
  --query "Parameters[].[Name,Type,Version]" --output table

# List everything under the prefix (tier and KMS key, still no values):
aws ssm describe-parameters --region us-east-1 \
  --parameter-filters "Key=Name,Option=BeginsWith,Values=clearvest-" \
  --query "Parameters[].[Name,Tier,KeyId]" --output table

# Adding the next key (ElevenLabs). --no-overwrite fails if the name exists,
# so a typo never silently replaces someone else's key. Paste the value from a
# password manager, never from a file in this repo.
aws ssm put-parameter --region us-east-1 --name clearvest-elevenlabs \
  --type SecureString --tier Standard --no-overwrite --value '<paste>'
```

Expected output of the first command: three rows, each `SecureString`, version `1`.

## Decisions & why

- **Flat `clearvest-<provider>` names, not `/clearvest/<provider>`.** The first
  key (`clearvest-fmp`) was already flat, the spec makes every name a SAM
  template parameter so either style would work, and flat names need no
  `GetParametersByPath` IAM shape. Consistency with what exists beat the
  hierarchical form. Multi-word providers use hyphens: `clearvest-plaid-client-id`.
- **Region is `us-east-1`** for every key, matching the SAM stack region in the
  backend plan. A key in another region is invisible to the Lambdas.
- **SecureString, Standard tier, default KMS key.** Standard tier is free and
  4 KB is plenty for API keys. The account-default `alias/aws/ssm` key means the
  Lambda execution roles need only `ssm:GetParameter` plus the implicit
  `kms:Decrypt` on the AWS-managed key, no customer-managed key to provision.
- **FRED has no key and there will be no `clearvest-fred` parameter.** We could
  not register a FRED account, so FRED data comes from the keyless CSV endpoint:
  `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<SERIES_ID>`
  (e.g. `FEDFUNDS`, `CPIAUCSL`, `UNRATE`, `DGS10`). The backend spec's MarketFn
  expects a FRED API key; instead `providers/fred.py` should fetch this CSV URL
  and parse the two-column `DATE,<SERIES_ID>` body (missing values are `.`).
  The SAM template should drop `FredKeyParam` and the matching IAM grant and
  environment variable. Cache results in DynamoDB like every other provider;
  the CSV endpoint has no published rate limit but is not meant for hammering.
- **Plaid keys are sandbox credentials.** They only work against the Plaid
  sandbox environment. Production Plaid keys, if ever needed, get new parameter
  values (a new version of the same names), not new names.
- **Keys were created by hand with the CLI, not by the SAM template.** The stack
  must deploy with zero keys present (spec §6), and CloudFormation cannot create
  a SecureString parameter anyway. Hand-created keys also survive stack deletes.

## Gotchas

- **The account question is not settled.** These three parameters were created
  with the `default` AWS profile on @MaxCadet's machine. `clearvest-fmp` was
  created by @wakeensito with *their* `default` profile, and it does **not**
  show up in the account where the three new keys live, so the two sets are in
  different AWS accounts. The deploy pipeline is still the OIDC stub
  (`AWS_DEPLOY_ROLE_ARN` is unset), so nothing in the repo yet says which
  account is the ClearVest deploy account. Whichever account the SAM stack
  deploys into must hold **all** the keys. Re-running the `put-parameter`
  commands in that account takes a minute; the values live in the team's
  password manager, never in this repo.
- `put-parameter` without `--no-overwrite` silently bumps the version and
  replaces the value. Always pass `--no-overwrite` when adding a key.
- `get-parameter` on a SecureString returns the ciphertext unless you pass
  `--with-decryption`. That is what you want in the shell; never paste the
  decrypted output into a file, an issue, or a chat.
- The verify command uses `get-parameters` (plural). Its output lists only the
  names that exist; a missing name goes into `InvalidParameters` and does not
  error, so check the row count.
- No key values appear in this repo, this handoff, the commit, or the PR.
  `git grep` for a value before pushing anything that touches keys.

## Next steps

1. **Backend (#3, #22 area):** switch `providers/fred.py` to the keyless CSV
   endpoint above, drop `FredKeyParam` from `template.yaml`, `samconfig.toml`,
   the test fixtures in `docs/superpowers/plans/2026-09-26-backend.md`, and the
   MarketFn IAM policy. Cache the parsed series like every other provider.
2. **AI / devops:** add `clearvest-elevenlabs` (SecureString) with the
   `put-parameter` command above once the ElevenLabs key exists.
3. **Data:** add `clearvest-sec-user-agent` as a plain `String` (it is a
   contact string, not a secret) so the Lambdas stop depending on `.env`.
4. **Devops:** decide the ClearVest deploy account, wire `infra/cicd-role.yaml`
   and `AWS_DEPLOY_ROLE_ARN`, then make sure every `clearvest-*` name above
   exists in that account (re-create the missing ones there).
5. **Backend:** Plaid stays sandbox-only for the demo. Point the Plaid client
   at the sandbox host and do not request production access.

## Open questions / blockers

- @wakeensito: please confirm the FRED change in the backend spec. MarketFn
  drops the FRED key entirely and `providers/fred.py` reads
  `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<SERIES_ID>`. If you would
  rather keep a key path for later, say so and we will add `clearvest-fred`
  then, but nobody on the team could register for one today.
- @wakeensito: which AWS account is the deploy account? `clearvest-fmp` and the
  three keys from this handoff currently sit in two different accounts (see
  Gotchas). Once decided, the other side re-creates their keys there.
