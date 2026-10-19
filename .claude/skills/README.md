# Claude Code skills

Three project skills drafted from the repository at `cf92870` (`origin/master`). Claude Code discovers any subdirectory here that contains a `SKILL.md` at session start. No entry in `.claude/settings.json` is needed.

| Skill | Scope | Loads when |
| --- | --- | --- |
| `beerswipe-migrations` | This repo | A schema, column, table, enum or index change is requested |
| `kiosk-verify` | This repo | Kiosk code changes or someone is about to claim a kiosk change works |
| `coolify-deploy` | Cross-repo | Deploying, rolling back, or changing compose/proxy configuration |

## Placement

`beerswipe-migrations` and `kiosk-verify` belong in this repository. Commit them so the rules travel with the code.

`coolify-deploy` also applies to the ADA Website and any other app on the same VPS. It only loads in beerswipe sessions while it lives here. To use it everywhere, move it to the user-level skills directory:

```powershell
# Windows
Move-Item .claude\skills\coolify-deploy "$env:USERPROFILE\.claude\skills\"
```

```bash
# macOS / Linux
mv .claude/skills/coolify-deploy ~/.claude/skills/
```

Move it, do not copy it. Two copies will drift.

## Maintenance

The skills describe the code, so the code wins when they disagree. Update the relevant skill when any of these change:

- the order of `runMigrations()` and `sequelize.sync()` in `backend/src/config/database.js`
- the `MIGRATIONS` step contract or naming in `backend/src/migrate.js`
- the kiosk commands in `.github/workflows/ci.yml` or `kiosk/pyproject.toml`
- the image tags, webhooks or compose files used by `.github/workflows/docker-build-push.yml` and `deploy-new-images.yml`

The stale comment in `docker-compose.deploy.yml` about migration order is already called out in `beerswipe-migrations`. If that comment is fixed, remove the warning from the skill.
