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

Push to `main` → Actions builds the image → pushes `:latest` and `:<sha>` to GHCR.
No PAT needed for the push; the built-in `GITHUB_TOKEN` has `packages: write`.

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
