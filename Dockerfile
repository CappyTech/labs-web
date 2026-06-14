FROM caddy:2-alpine

# Static site baked in — the image is self-contained and runs anywhere:
#   docker run --rm -p 8080:80 ghcr.io/cappytech/labs-web:latest
COPY site/ /srv/
COPY Caddyfile /etc/caddy/Caddyfile
