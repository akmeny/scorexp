#!/bin/bash
set -euo pipefail

ROOT="/var/www/scorexp"
FRONTEND_DIR="$ROOT/frontend"

echo "🚀 Deploy başlıyor..."
cd "$ROOT"

echo "📥 Git pull..."
git fetch origin main
git reset --hard origin/main

echo "🛠 Frontend build..."
cd "$FRONTEND_DIR"

# Paketleri kur (lock varsa ci kullan)
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

npm run build

echo "🔗 Dist symlink güncelleniyor..."
ln -sfn "$FRONTEND_DIR/dist" "$ROOT/dist"

echo "🔄 Backend restart (PM2)..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart scorexp-backend || pm2 start npm --name "scorexp-backend" -- run start
else
  echo "⚠️ PM2 bulunamadı, yüklemek için: npm i -g pm2"
fi

echo "✅ Deploy tamamlandı!"
