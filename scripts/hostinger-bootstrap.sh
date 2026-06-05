#!/usr/bin/env bash
# ShopOS — Hostinger VPS bootstrap (Supabase Cloud, no self-hosted DB).
# Run on the VPS as root after: apt install -y git curl
#
# Required environment variables before running:
#   GITHUB_TOKEN          — GitHub PAT with repo read (private ShopOS repo)
#   APP_URL               — e.g. http://89.116.38.200 or https://yourdomain.com
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   DATABASE_URL
#   DIRECT_URL
#   AUTH_SECRET
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/shopos}"
REPO="${REPO:-https://${GITHUB_TOKEN}@github.com/MdRashidunnabi/ShopOS.git}"

for v in GITHUB_TOKEN APP_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY DATABASE_URL DIRECT_URL AUTH_SECRET; do
  if [ -z "${!v:-}" ]; then
    echo "Missing required env var: $v" >&2
    exit 1
  fi
done

echo "==> Installing Docker (if needed)..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Cloning ShopOS..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> Writing .env.production..."
cat > .env.production <<EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
DATABASE_URL=${DATABASE_URL}
DIRECT_URL=${DIRECT_URL}
NEXT_PUBLIC_APP_URL=${APP_URL}
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_DEFAULT_LOCALE=en-IE
NEXT_PUBLIC_DEFAULT_CURRENCY=EUR
NEXT_PUBLIC_DEFAULT_TIMEZONE=Europe/Dublin
NEXT_PUBLIC_DEFAULT_COUNTRY=IE
AUTH_SECRET=${AUTH_SECRET}
EMAIL_FROM=ShopOS <noreply@shopos.local>
EOF

echo "==> Nginx config (HTTP)..."
mkdir -p nginx/conf.d nginx/ssl
cat > nginx/conf.d/shopos.conf <<'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass         http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    client_max_body_size 10m;
}
NGINX

echo "==> Firewall..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw --force enable || true
fi

echo "==> Building Docker image (5-10 min first time)..."
set -a
source .env.production
set +a
docker compose -f docker-compose.prod.yml build --no-cache app

echo "==> Starting stack..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "==> Done. Open: ${APP_URL}"
echo "    Demo login: owner@susu552813.shopos.local / DemoPass123!"
echo "    Storefront: ${APP_URL}/shop/susu552813"
echo ""
echo "    Add to Supabase Auth → URL configuration:"
echo "      Site URL: ${APP_URL}"
echo "      Redirect: ${APP_URL}/auth/callback"
docker compose -f docker-compose.prod.yml ps
