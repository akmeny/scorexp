#!/bin/bash
set -e

# Commit mesajı argüman olarak alınır, yoksa "quick deploy"
COMMIT_MSG=${1:-"quick deploy"}

echo "💾 Commit & Push..."
git add .
git commit -m "$COMMIT_MSG"
git push origin main

echo "🌐 Remote Deploy başlıyor..."
ssh root@31.97.59.87 'cd /var/www/scorexp && ./deploy.sh'

echo "✅ Deploy tamamlandı! scorexp.com güncellendi."
