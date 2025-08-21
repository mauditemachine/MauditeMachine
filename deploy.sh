#!/bin/bash

# Script de déploiement automatique pour mauditemachine.com
# Usage: ./deploy.sh [message]

PROJECT="/Users/mauditemachine/Library/Mobile Documents/com~apple~CloudDocs/Dev/Maudite Machine 2025"
WORKTREE="/Users/mauditemachine/Library/Mobile Documents/com~apple~CloudDocs/Dev/_mm-gh-pages"
COMMIT_MSG="${1:-Update: Déploiement automatique}"

echo "🚀 Déploiement automatique de mauditemachine.com"
echo "📁 Projet: $PROJECT"
echo "📁 Worktree: $WORKTREE"
echo "💬 Message: $COMMIT_MSG"
echo ""

# 1. Build du projet
echo "🔨 Build du projet..."
cd "$PROJECT"
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build"
    exit 1
fi

# 2. Préparation du worktree
echo "📦 Préparation du déploiement..."
git fetch origin

# Supprimer et recréer le worktree si nécessaire
git worktree remove -f "$WORKTREE" 2>/dev/null || true
git worktree add -B gh-pages "$WORKTREE"

# 3. Nettoyage automatique (sans confirmation)
echo "🧹 Nettoyage du worktree..."
cd "$WORKTREE"
find . -maxdepth 1 -not -name '.' -not -name '.git' -not -name '.github' -exec rm -rf {} + 2>/dev/null || true

# 4. Copie des fichiers
echo "📋 Copie des fichiers..."
rsync -a "$PROJECT/dist/" "$WORKTREE/"
rsync -a "$PROJECT/medias/" "$WORKTREE/medias/"

# 5. Configuration GitHub Pages
echo "⚙️  Configuration GitHub Pages..."
echo "mauditemachine.com" > "$WORKTREE/CNAME"
touch "$WORKTREE/.nojekyll"

# 6. Git commit et push
echo "🚀 Déploiement vers GitHub Pages..."
git add -A
git commit -m "$COMMIT_MSG"
git push -f origin gh-pages

echo ""
echo "✅ Déploiement terminé !"
echo "🌐 Site disponible sur: https://mauditemachine.com"
echo "⏰ Attendre 1-2 minutes pour la propagation..."
