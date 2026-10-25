#!/usr/bin/env bash
# Runs ON the server (as root). Installs Caddy if needed and serves /var/www/pianonotes
# at https://pianonotes.duckdns.org with an automatic Let's Encrypt certificate.
set -euo pipefail

DOMAIN="${DOMAIN:-pianonotes.duckdns.org}"
SRC="${1:-/tmp/pianonotes-upload}"
WEBROOT=/var/www/pianonotes

if ! command -v caddy >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
  else
    echo "This script installs Caddy with apt (Debian, Ubuntu, Raspberry Pi OS)." >&2
    echo "On another system, install Caddy yourself, then re-run this script." >&2
    exit 1
  fi
fi

mkdir -p "$WEBROOT"
install -m 644 "$SRC/index.html" "$WEBROOT/index.html"

cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	root * $WEBROOT
	encode gzip
	file_server
}
CADDY

systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy
echo "Done. Site files: $WEBROOT. Check: https://$DOMAIN"
