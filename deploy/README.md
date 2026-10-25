
## Hosting at home (pianonotes.duckdns.org)

The app is one static file, so any web server works. `deploy/` sets up Caddy, which gets a free HTTPS
certificate automatically.

1. Point the DuckDNS record at your public IP (a cron job or the DuckDNS page can do this).
2. On your router, forward TCP ports **80** and **443** to `192.168.1.51`. Caddy needs both to issue the certificate.
3. From a computer on your network, in this repo: `./deploy/deploy.sh`.
   It builds, copies `index.html` to `rumi@192.168.1.51`, installs Caddy (Debian/Ubuntu/Raspberry Pi OS) and serves the site.
   Set `HOST=user@address` to deploy somewhere else. Re-run it any time to publish changes.

Then open https://pianonotes.duckdns.org. HTTPS is also what lets browsers allow MIDI keyboards.
