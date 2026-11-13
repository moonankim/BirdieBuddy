# Migration workflow

Supabase CLI applies SQL files in lexical timestamp order. Keep each migration focused on one schema, permission, or database behavior change and use a unique UTC timestamp in its filename.

After a migration is applied to a shared environment, do not edit or delete it. Add a forward migration that preserves existing data and remains compatible with the deployed application. Keep RLS, grants, functions, triggers, and indexes explicit in the migration that owns them.

Local development starts from `supabase db reset`, then generates `lib/supabase/database.types.ts` from the local schema. Run `supabase db lint` and `supabase test db` against the local stack. Remote application follows `docs/홍주P_plan.md` §13 and is separate from this local workflow.

## MCP-applied baseline history

The 2026-11-11 production baseline was applied with Supabase MCP. Its migration history `version` values are the server-side apply timestamps, while `name` retains the original local migration stem. The Supabase CLI compares migration timestamps only ([`migration list` reference](https://supabase.com/docs/reference/cli/supabase-migration-list)), so the local filenames use the recorded remote versions to prevent a later `db push` from treating the baseline as unapplied. SQL contents were not changed.

| Local filename prefix / remote `version` | `name` recorded by MCP |
| --- | --- |
| `20261111063044` | `20261111045736_core_schema` |
| `20261111063050` | `20261111045738_security_and_auth` |
| `20261111063056` | `20261111045739_game_rooms_rpc` |
| `20261111063102` | `20261111045740_messages_and_inbox_rpc` |
| `20261111063108` | `20261111045741_influencer_ops_ai` |
| `20261111063114` | `20261111045742_storage_and_realtime` |
| `20261111063224` | `20261111045743_initial_game_config` |
| `20261111063518` | `20261111045744_storage_buckets` |
| `20261111063520` | `20261111045745_foreign_key_indexes` |

After aligning the filenames, the local database was reset and its CLI migration list shows all nine local files match the local database history. The hosted rows were read through Supabase MCP and not edited; a CLI linked-remote list/dry-run remains pending protected CLI credentials. For a future MCP-applied migration, reconcile its local filename with the returned remote `version` before using CLI migration commands; prefer the CLI deployment path when its protected remote credentials are available.

`20261113011530_read_state_checkpoints.sql` is a later feature-branch migration. It is not part of the nine-file production baseline and has not been applied to local or hosted Supabase.
