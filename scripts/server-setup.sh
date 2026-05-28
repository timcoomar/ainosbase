#!/bin/bash
set -e

#############################################
# ainosbase.gr — Server Setup Script
# Run as root on a fresh Ubuntu 24.04 (ARM64)
# Hetzner CAX11
#############################################

DOMAIN="ainosbase.gr"
SITE_DIR="/var/www/ainosbase.gr"
DEPLOY_USER="deploy"
PHP_VERSION="8.4"
CERTBOT_EMAIL="tim.coomar@gmail.com"
REPO="timcoomar/ainosbase"

LOCAL_SSH_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ6YawD5fXhsXpyRITqVEe7r4GmEMVOpCkfKDhbVKg7k tim.coomar@gmail.com"
ACTIONS_SSH_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEJ5hvJOOQ5Yh4XsHltLPnlEm/ufKA5AJRfbow8+l4xo github-actions-deploy"

echo "Enter your GitHub Personal Access Token:"
read -s GITHUB_PAT
echo ""

# ── System ────────────────────────────────
echo "→ Updating system packages..."
apt update && apt upgrade -y
apt install -y git curl wget unzip software-properties-common ufw

echo "→ Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── PHP ───────────────────────────────────
echo "→ Adding Ondrej PHP PPA..."
add-apt-repository ppa:ondrej/php -y
apt update

echo "→ Installing PHP ${PHP_VERSION} and extensions..."
apt install -y \
    php${PHP_VERSION}-fpm \
    php${PHP_VERSION}-cli \
    php${PHP_VERSION}-bcmath \
    php${PHP_VERSION}-curl \
    php${PHP_VERSION}-gd \
    php${PHP_VERSION}-gmp \
    php${PHP_VERSION}-intl \
    php${PHP_VERSION}-mbstring \
    php${PHP_VERSION}-mysql \
    php${PHP_VERSION}-opcache \
    php${PHP_VERSION}-redis \
    php${PHP_VERSION}-soap \
    php${PHP_VERSION}-sqlite3 \
    php${PHP_VERSION}-xml \
    php${PHP_VERSION}-zip

# ── Nginx ─────────────────────────────────
echo "→ Installing Nginx..."
apt install -y nginx

# ── Composer ──────────────────────────────
echo "→ Installing Composer..."
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# ── Node.js ───────────────────────────────
echo "→ Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# ── Deploy user ───────────────────────────
echo "→ Creating deploy user..."
adduser --disabled-password --gecos "" ${DEPLOY_USER}
usermod -aG www-data ${DEPLOY_USER}

echo "→ Setting up SSH keys for deploy user..."
mkdir -p /home/${DEPLOY_USER}/.ssh
echo "${LOCAL_SSH_KEY}" >> /home/${DEPLOY_USER}/.ssh/authorized_keys
echo "${ACTIONS_SSH_KEY}" >> /home/${DEPLOY_USER}/.ssh/authorized_keys
chmod 700 /home/${DEPLOY_USER}/.ssh
chmod 600 /home/${DEPLOY_USER}/.ssh/authorized_keys
chown -R ${DEPLOY_USER}:${DEPLOY_USER} /home/${DEPLOY_USER}/.ssh

# ── Site directory & repo ─────────────────
echo "→ Creating site directory..."
mkdir -p ${SITE_DIR}
chown -R ${DEPLOY_USER}:${DEPLOY_USER} /var/www

echo "→ Cloning repository..."
su - ${DEPLOY_USER} -c "git clone https://${GITHUB_PAT}@github.com/${REPO}.git ${SITE_DIR}"
su - ${DEPLOY_USER} -c "git -C ${SITE_DIR} remote set-url origin https://${GITHUB_PAT}@github.com/${REPO}.git"

# ── .env ──────────────────────────────────
echo "→ Placing .env file..."
# The .env file must be copied to the server before running this script:
#   scp ~/Desktop/ainosbase.env root@<server-ip>:/root/ainosbase.env
if [ -f /root/ainosbase.env ]; then
    cp /root/ainosbase.env ${SITE_DIR}/.env
    chown ${DEPLOY_USER}:${DEPLOY_USER} ${SITE_DIR}/.env
    chmod 640 ${SITE_DIR}/.env
    echo "  .env copied successfully."
else
    touch ${SITE_DIR}/.env
    chown ${DEPLOY_USER}:${DEPLOY_USER} ${SITE_DIR}/.env
    echo "  WARNING: /root/ainosbase.env not found. You must populate .env manually before the site will work."
fi

# ── Dependencies & build ──────────────────
echo "→ Installing Composer dependencies..."
su - ${DEPLOY_USER} -c "cd ${SITE_DIR} && composer install --no-dev --optimize-autoloader"

echo "→ Building frontend assets..."
su - ${DEPLOY_USER} -c "cd ${SITE_DIR} && npm ci && npm run build"

echo "→ Clearing caches..."
su - ${DEPLOY_USER} -c "cd ${SITE_DIR} && php artisan cache:clear && php artisan statamic:stache:clear"

# ── Permissions ───────────────────────────
echo "→ Setting storage permissions..."
chown -R ${DEPLOY_USER}:www-data ${SITE_DIR}/storage
chown -R ${DEPLOY_USER}:www-data ${SITE_DIR}/bootstrap/cache
chmod -R 775 ${SITE_DIR}/storage
chmod -R 775 ${SITE_DIR}/bootstrap/cache

# ── PHP-FPM pool ──────────────────────────
echo "→ Configuring PHP-FPM pool for deploy user..."
cat > /etc/php/${PHP_VERSION}/fpm/pool.d/deploy.conf << EOF
[deploy]
user = deploy
group = deploy
listen = /run/php/php${PHP_VERSION}-fpm-deploy.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = dynamic
pm.max_children = 5
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
EOF

mv /etc/php/${PHP_VERSION}/fpm/pool.d/www.conf /etc/php/${PHP_VERSION}/fpm/pool.d/www.conf.disabled
systemctl restart php${PHP_VERSION}-fpm

# ── Nginx config ──────────────────────────
echo "→ Configuring Nginx..."
cat > /etc/nginx/sites-available/${DOMAIN} << EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${SITE_DIR}/public;
    index index.php index.html;

    charset utf-8;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    location ~ \.php$ {
        try_files \$uri /index.php =404;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php${PHP_VERSION}-fpm-deploy.sock;
        fastcgi_buffers 16 16k;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT \$realpath_root;
        include fastcgi_params;
    }

    error_log /var/log/nginx/${DOMAIN}-error.log error;

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
EOF

ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── SSL ───────────────────────────────────
echo "→ Installing Certbot and issuing SSL certificate..."
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos -m ${CERTBOT_EMAIL}

# ── Content sync cron ─────────────────────
echo "→ Setting up content sync script and cron job..."
cat > /home/${DEPLOY_USER}/content-sync.sh << 'SYNCEOF'
#!/bin/bash
cd /var/www/ainosbase.gr

if [[ -n $(git status --porcelain content/ users/) ]]; then
    git add content/ users/
    git commit -m "Auto-sync content [$(date '+%Y-%m-%d %H:%M')]"
    git push origin main
fi
SYNCEOF

chmod +x /home/${DEPLOY_USER}/content-sync.sh
chown ${DEPLOY_USER}:${DEPLOY_USER} /home/${DEPLOY_USER}/content-sync.sh

su - ${DEPLOY_USER} -c "(crontab -l 2>/dev/null; echo '0 * * * * /bin/bash /home/deploy/content-sync.sh >> /home/deploy/content-sync.log 2>&1') | crontab -"

# ── Done ──────────────────────────────────
echo ""
echo "============================================"
echo " Setup complete!"
echo "============================================"
echo ""
echo "Site should be live at https://${DOMAIN}"
echo ""
echo "If the .env was missing, copy it now and run:"
echo "  su - deploy -c 'cd ${SITE_DIR} && php artisan cache:clear'"
echo ""
