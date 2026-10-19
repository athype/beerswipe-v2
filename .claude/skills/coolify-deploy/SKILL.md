---
name: coolify-deploy
description: Use when deploying beerswipe-v2 to Coolify, changing docker-compose deploy files, promoting or rolling back a GHCR image, or debugging a production deploy on the VPS. Covers the image pipeline, Coolify webhooks, proxy topology, required env vars, and post-deploy verification.
---

# Deploy on Coolify

## Production facts

- Public URL: `https://beer.sv-ada.nl`
- Host: the VPS, with Coolify's own reverse proxy terminating TLS. Coolify owns ports 80 and 443.
- Images: `ghcr.io/athype/beerswipe-backend` and `ghcr.io/athype/beerswipe-frontend`, unless the repository variables override the registry or namespace.
- The frontend builds with a relative `/api/v1` path and nginx proxies to the backend through `API_UPSTREAM`, so one image works on any host. Do not bake a backend URL into the frontend image.

## Pick the right compose file

| File | Use when |
| --- | --- |
| `docker-compose.deploy-host-proxy.yml` | Host already has a proxy (Coolify, Traefik, nginx). No Caddy, does not bind 80/443, frontend exposes 80. |
| `docker-compose.deploy.yml` | Host has no proxy. Runs Caddy and binds 80/443. |
| `docker-compose.yml` | Builds images from source on the host. Not the Coolify path. |
| `docker-compose.dev.yml` | Local development only. |

For Coolify, the host-proxy file is the matching shape: point the Coolify proxy at `http://frontend:80`, or set `WEBPORT` if the proxy is host-level and cannot reach the Docker network.

The repo cannot tell you how the Coolify resource is configured. Check the resource in the Coolify UI:

- If it is a Compose resource, confirm the Compose file path is `docker-compose.deploy-host-proxy.yml`.
- If it is a Docker-image resource for backend and another for frontend, the compose files are only for manual hosts and changes to them will not affect production.

Do not assume; the deploy workflow deploys backend and frontend separately, which is consistent with either shape.

## Deploy pipeline

1. Pull request to `master` runs `.github/workflows/ci.yml` (backend, frontend, kiosk jobs).
2. Merge to `master` runs `docker-build-push.yml`. It builds both images and pushes tags:
   - branch name (`master`)
   - `sha-xxxxxxx` (short commit)
   - `latest` on the default branch
3. When that workflow completes successfully, `deploy-new-images.yml` runs on `workflow_run` and POSTs to two Coolify deploy webhooks:
   - backend: `COOLIFY_API_DEPLOY_WEBHOOK`
   - frontend: `COOLIFY_FRONTEND_DEPLOY_WEBHOOK`
4. Coolify pulls the new `latest` images and recreates the containers.

Required GitHub configuration:

- Secret `COOLIFY_API_TOKEN`
- Repository variables `COOLIFY_API_DEPLOY_WEBHOOK` and `COOLIFY_FRONTEND_DEPLOY_WEBHOOK`

There is no SSH deploy and no build on the VPS. If the image build fails, nothing deploys. If a webhook variable is missing, the deploy job exits non-zero.

Feature-branch builds do not deploy: the workflow only fires for `workflow_run.head_branch == "master"` or a manual dispatch on `master`.

## Pin a rollout or roll back

`latest` moves on every merge to `master`. To pin:

1. Open the Coolify application, then Environment Variables.
2. Set `IMAGE_TAG=sha-xxxxxxx` to the commit you want.
3. Redeploy.

To roll back, set `IMAGE_TAG` to the previous known-good sha and redeploy. Do not retag or delete images. Fix forward in a new commit, then remove the pin or move it to the new sha.

## Required environment

Set these in Coolify, not in the compose file and not in git:

| Variable | Production value |
| --- | --- |
| `JWT_SECRET` | long random secret |
| `DB_PASSWORD` | database password |
| `DB_NAME`, `DB_USER`, `DB_HOST`, `DB_PORT` | database connection; `DB_HOST=postgres` when the database is in the same stack |
| `DOMAIN` | `beer.sv-ada.nl` |
| `FEURL` | `https://beer.sv-ada.nl` |
| `FEPORT` | `443` |
| `RP_ID` | `beer.sv-ada.nl` |
| `ORIGIN` | `https://beer.sv-ada.nl` |
| `API_UPSTREAM` | `http://backend:8080` on the same network; a reachable backend URL if frontend and backend are separate Coolify resources |

`RP_ID` must match the site origin or passkey registration and login break. `ENABLE_API_DOCS` is off in production by default; set it to `true` only deliberately.

## Schema changes during a deploy

The backend applies `backend/src/migrate.js` at boot before `sequelize.sync()` and before it listens. A throwing migration blocks startup, so Coolify's health check fails and the new container does not serve traffic.

- Prefer backward-compatible, idempotent steps; see the `beerswipe-migrations` skill.
- Check the backend deployment log for `[migrate] applied` or `[migrate] up to date` lines.
- If a deploy fails on a migration, roll back `IMAGE_TAG` first, then fix the step in a new commit. Do not edit the database by hand unless the rollback cannot wait.

## Verify after deploying

1. Coolify shows both applications deployed and healthy, with no restart loop.
2. `curl -I https://beer.sv-ada.nl` returns 200 with a valid certificate.
3. The login page loads and password login works.
4. Passkey login works (`RP_ID` and `ORIGIN` are the usual culprits if it does not).
5. Sell one drink, confirm credits and stock changed, then undo it.
6. Backend logs contain no `column ... does not exist` and no repeated `[migrate] failed`.
7. If the frontend loads but API calls return 502, check `API_UPSTREAM` and backend health before touching nginx.

## Coolify UI workflow

1. Applications, select the backend or frontend application.
2. Environment Variables: change `IMAGE_TAG` or any runtime value.
3. Deploy (or Redeploy) and watch the Deployments tab.
4. Open the Terminal tab only for a read-only check such as `node src/migrate.js --help` or inspecting env; prefer redeploying over editing files inside the container.
5. If the Compose file is sourced from git, change it in the repository and redeploy. Edits made only in the UI drift from the repo.

## Pitfalls

- Do not add Caddy to the host-proxy stack or bind 80/443. Coolify's proxy already owns them and the deploy will conflict.
- Both webhooks must exist. A missing repository variable fails the deploy job; it does not silently skip.
- `latest` is not a stable version. Pin `IMAGE_TAG` for a reproducible rollout.
- The comment in `docker-compose.deploy.yml` about migrations running after sync is stale. The code runs them before sync.
- Secrets belong in Coolify's environment, never in compose, `.env.example`, or the repository.
- Frontend and backend may be separate Coolify resources with separate domains. If so, the backend must be reachable from the frontend container and `API_UPSTREAM` must use that reachable URL, not `http://backend:8080`.

## Other Coolify apps

The same rules apply to the ADA Website (Rails 8.1, Solid Cache, Queue and Cable on four PostgreSQL databases) and any other app on the same VPS: Coolify owns TLS and routing, secrets live in the UI, and each app has its own resources and environment. Do not copy beerswipe variable names or compose files into ADA; only the proxy and deployment principles carry over.
