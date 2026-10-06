# labs-web

The website for **cappylabs.uk** — a static site baked into a self-contained
Docker image, built by GitHub Actions and published to GHCR.

Served in production by the front-door `cl-caddy` reverse proxy, which
terminates TLS and routes `cappylabs.uk` to this container.

## Layout

```
labs-web/
├── site/                    # static content (edit here)
│   └── index.html
├── Caddyfile                # internal :80 server (no TLS)
├── Dockerfile               # bakes site/ into a caddy:2-alpine image
├── compose.yaml             # VPS deploy — pulls the GHCR image
└── .github/workflows/build.yml
```

## Image

```
ghcr.io/cappytech/labs-web:latest      # always-lowercase (GHCR requirement)
ghcr.io/cappytech/labs-web:<git-sha>   # immutable, per-commit
```

## Pipeline

Push to `main` → Actions runs `npm test` → builds the image → pushes `:latest`
and `:<sha>` to GHCR → deploys to the edge server over SSH. No PAT needed for
the push; the built-in `GITHUB_TOKEN` has `packages: write`.

The deploy job copies `compose.yaml` to `DEPLOY_DIR` (default
`/docker/labs-web`, set in `.github/workflows/build.yml`), then runs
`docker compose pull` and `up -d --force-recreate` for `labs-web` only, so
Mongo keeps running. It stops without changing anything if
`DEPLOY_DIR/.compose.env` is missing. `.compose.env` is managed on the
server by hand and never synced.

Repo secrets (the same edge server as Cairn):

| Secret | Value |
|---|---|
| `EDGE_SSH_HOST` | Edge server hostname or IP |
| `EDGE_SSH_USER` | SSH user that can run `docker compose` |
| `EDGE_SSH_KEY` | Private key for that user |

## Deploy (VPS, one time)

```bash
docker network create edge          # shared with cl-caddy
docker compose pull
docker compose up -d
```

Front-door `cl-caddy` routes to it:

```
cappylabs.uk {
    reverse_proxy labs-web:80
}
```

## Update

```bash
# edit site/, commit, push to main — Actions rebuilds :latest, then on the VPS:
docker compose pull && docker compose up -d
```

## Run it standalone (no proxy)

```bash
docker run --rm -p 8080:80 ghcr.io/cappytech/labs-web:latest
# → http://localhost:8080
```
