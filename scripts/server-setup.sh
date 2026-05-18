#!/usr/bin/env bash
# ============================================================
#  ShopOS - Hostinger KVM4 VPS bootstrap script
#
#  Run this ONCE on a fresh Hostinger KVM4 VPS after you
#  SSH in as root. It will:
#    1. Update the system
#    2. Install Git, jq, pwgen (Docker is pre-installed)
#    3. Set up self-hosted Supabase in ~/supabase
#    4. Clone your app repo into ~/shopos
#    5. Prompt you to fill in the env files
#    6. Issue SSL certificates (Certbot)
#    7. Start everything
#
#  BEFORE RUNNING:
#    a) Point your DNS records to the VPS IP (see PART 1 below)
#    b) Have your GitHub repo URL ready
#    c) Have your domain name ready
#
#  USAGE:
#    chmod +x scripts/server-setup.sh
#    sudo bash scripts/server-setup.sh
# ============================================================

set -euo pipefail

# ---- colour helpers ----------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---- collect configuration ---------------------------------
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  ShopOS VPS Setup - Hostinger KVM4${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
read -rp "Your main domain (e.g. shopos.ie):           " APP_DOMAIN
read -rp "Supabase subdomain (e.g. db.shopos.ie):      " DB_DOMAIN
read -rp "Your GitHub repo URL (SSH or HTTPS):         " REPO_URL
read -rp "Your email (for Let's Encrypt certs):        " CERT_EMAIL
echo ""

APP_DIR="$HOME/shopos"
SB_DIR="$HOME/supabase"

# ---- 1. System update ----------------------------------------
info "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq git curl jq pwgen ufw fail2ban
success "System packages updated."

# ---- 2. UFW firewall ----------------------------------------
info "Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
success "Firewall configured."

# ---- 3. Fail2ban (basic brute-force protection) -------------
info "Enabling fail2ban..."
systemctl enable fail2ban --quiet
systemctl start  fail2ban
success "fail2ban enabled."

# ---- 4. Self-hosted Supabase --------------------------------
info "Setting up self-hosted Supabase in $SB_DIR ..."
if [ ! -d "$SB_DIR" ]; then
  git clone --depth=1 https://github.com/supabase/supabase "$SB_DIR"
fi
cd "$SB_DIR/docker"

# Generate secrets if they don't exist yet.
if [ ! -f .env ]; then
  cp .env.example .env

  JWT_SECRET=$(pwgen -s 64 1)
  POSTGRES_PASSWORD=$(pwgen -s 32 1)
  DASHBOARD_PASSWORD=$(pwgen -s 24 1)

  # Patch the .env with generated values.
  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
  sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}|" .env

  # Update the API URL so Supabase knows it lives at DB_DOMAIN.
  sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${DB_DOMAIN}|" .env
  sed -i "s|SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=https://${DB_DOMAIN}|" .env

  # Supabase Studio URL (optional — set if you expose the studio).
  sed -i "s|SITE_URL=.*|SITE_URL=https://${APP_DOMAIN}|" .env
  sed -i "s|ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=https://${APP_DOMAIN}/auth/callback|" .env

  success "Supabase .env generated."

  # Print the generated credentials - SAVE THESE.
  echo ""
  echo -e "${YELLOW}============================================================${NC}"
  echo -e "${YELLOW}  SAVE THESE CREDENTIALS - they will NOT be shown again!${NC}"
  echo -e "${YELLOW}============================================================${NC}"
  echo "  POSTGRES_PASSWORD  = ${POSTGRES_PASSWORD}"
  echo "  JWT_SECRET         = ${JWT_SECRET}"
  echo "  DASHBOARD_PASSWORD = ${DASHBOARD_PASSWORD}"
  echo ""
  echo "  You still need to copy the ANON_KEY and SERVICE_ROLE_KEY"
  echo "  from the Supabase .env file into your app .env.production"
  echo "  Run:  cat $SB_DIR/docker/.env | grep -E 'ANON_KEY|SERVICE_ROLE_KEY'"
  echo -e "${YELLOW}============================================================${NC}"
  echo ""
  read -rp "Press ENTER once you have saved the credentials above..."
fi

# Pull images and start Supabase.
info "Starting Supabase stack (this takes 2-3 minutes the first time)..."
docker compose pull --quiet
docker compose up -d
success "Supabase is running."

# ---- 5. Clone the ShopOS app --------------------------------
info "Cloning ShopOS repo into $APP_DIR ..."
if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ---- 6. Create the Nginx config from the template -----------
info "Creating Nginx config for $APP_DOMAIN and $DB_DOMAIN ..."
sed -e "s|YOUR_DOMAIN|${APP_DOMAIN}|g" \
    -e "s|DB_SUBDOMAIN|${DB_DOMAIN}|g" \
    nginx/conf.d/shopos.conf.template \
    > nginx/conf.d/shopos.conf
success "Nginx config created."

# ---- 7. Create .env.production from the example ------------
if [ ! -f .env.production ]; then
  cp .env.production.example .env.production

  # Get the anon/service keys from the Supabase .env.
  ANON_KEY=$(grep "^ANON_KEY=" "$SB_DIR/docker/.env" | cut -d= -f2-)
  SERVICE_ROLE_KEY=$(grep "^SERVICE_ROLE_KEY=" "$SB_DIR/docker/.env" | cut -d= -f2-)
  SB_DB_URL="postgresql://postgres:$(grep 'POSTGRES_PASSWORD=' $SB_DIR/docker/.env | cut -d= -f2-)@172.17.0.1:5432/postgres"

  sed -i "s|https://xxxxxxxxxxxxxxxxxxxx.supabase.co|https://${DB_DOMAIN}|g" .env.production
  sed -i "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}|" .env.production
  sed -i "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}|" .env.production
  sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://${APP_DOMAIN}|" .env.production
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${SB_DB_URL}|" .env.production
  sed -i "s|^DIRECT_URL=.*|DIRECT_URL=${SB_DB_URL}|" .env.production

  # Generate a random AUTH_SECRET.
  AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET}|" .env.production

  success ".env.production populated."
  warn "Review $APP_DIR/.env.production before continuing."
  warn "Make sure AUTH_SECRET and all keys look correct."
  echo ""
  read -rp "Press ENTER to continue once you have reviewed .env.production..."
fi

# ---- 8. Bootstrap SSL (HTTP-01 challenge needs port 80 free) -
info "Issuing SSL certificates for $APP_DOMAIN and $DB_DOMAIN ..."
# Temporarily serve ACME challenges on plain HTTP before the
# full Nginx stack is up (avoids chicken-and-egg with SSL).
docker run --rm \
  -v "$APP_DIR/nginx/ssl:/etc/letsencrypt" \
  -v "$APP_DIR/nginx/conf.d:/var/www/certbot" \
  -p 80:80 \
  certbot/certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$CERT_EMAIL" \
    -d "$APP_DOMAIN" \
    -d "www.$APP_DOMAIN" \
    -d "$DB_DOMAIN"
success "SSL certificates issued."

# ---- 9. Build and start the app stack -----------------------
info "Building the ShopOS Docker image (this takes ~3 minutes)..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml build --no-cache app
info "Starting Nginx + ShopOS..."
docker compose -f docker-compose.prod.yml up -d
success "ShopOS app stack is running."

# ---- 10. Run database migrations ----------------------------
info "Waiting 20s for Supabase to finish initialising..."
sleep 20
info "Running database migrations against local Supabase..."
cd "$APP_DIR"
npx supabase db push \
  --db-url "postgresql://postgres:$(grep 'POSTGRES_PASSWORD=' $SB_DIR/docker/.env | cut -d= -f2-)@127.0.0.1:5432/postgres"
success "Migrations applied."

# ---- Done! --------------------------------------------------
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  ShopOS is live!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "  App:     https://${APP_DOMAIN}"
echo "  Supabase API: https://${DB_DOMAIN}"
echo ""
echo "  Useful commands:"
echo "    View app logs:      docker compose -f $APP_DIR/docker-compose.prod.yml logs -f app"
echo "    View Supabase logs: docker compose -f $SB_DIR/docker/docker-compose.yml logs -f"
echo "    Restart app:        docker compose -f $APP_DIR/docker-compose.prod.yml restart app"
echo "    Update app:         cd $APP_DIR && git pull && docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml up -d"
echo ""
