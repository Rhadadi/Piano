#!/usr/bin/env bash
# Run from any computer on your home network, from the repo root:  ./deploy/deploy.sh
# Copies the app to the server and installs/updates the web server there.
set -euo pipefail
HOST="${HOST:-rumi@192.168.1.51}"
cd "$(dirname "$0")/.."

node tools/build.mjs
ssh "$HOST" 'rm -rf /tmp/pianonotes-upload && mkdir -p /tmp/pianonotes-upload'
scp index.html deploy/install.sh "$HOST:/tmp/pianonotes-upload/"
ssh -t "$HOST" 'sudo bash /tmp/pianonotes-upload/install.sh /tmp/pianonotes-upload'
