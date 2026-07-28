#!/bin/bash
#
# Publication de mauditemachine.com
#
#   ./deploy.sh "message de commit"
#   ./deploy.sh --dry-run "message"   # montre ce qui serait fait, sans rien pousser
#
# Le site est servi par GitHub Actions depuis la branche main :
# .github/workflows/pages.yml rebuild et redeploie a chaque push. Publier se
# resume donc a committer et pousser main.
#
# NOTE : l'ancienne version de ce script copiait dist/ vers une branche
# gh-pages depuis /Users/mauditemachine/Documents/Dev/MauditeMachine2025.
# Ce chemin n'existe plus (le projet vit sur iCloud Drive), et gh-pages n'est
# plus ce qui est servi : sa derniere mise a jour date de fevrier 2026 alors
# que le site sert bien ce qui est pousse sur main. Ne pas restaurer.

set -euo pipefail
cd "$(dirname "$0")"

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
  shift
fi

COMMIT_MSG="${1:-Update: contenu du site}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "Publication de mauditemachine.com"
echo "  branche : $BRANCH"
echo "  message : $COMMIT_MSG"
[ "$DRY_RUN" = "1" ] && echo "  MODE    : dry-run, rien ne sera pousse"
echo ""

if [ "$BRANCH" != "main" ]; then
  echo "Tu es sur '$BRANCH', pas sur main. Le deploiement part de main."
  echo "Bascule avec : git checkout main"
  exit 1
fi

# Ce qui va etre publie, affiche avant de committer : pas de surprise.
if [ -n "$(git status --porcelain)" ]; then
  echo "Modifications a publier :"
  git status --short
  echo ""
else
  echo "Rien de modifie en local."
  echo ""
fi

# Build local avant le push : si le build casse, GitHub Actions echouera et
# rien ne sera deploye. Autant s'en apercevoir maintenant. Ca met aussi le
# dist/ versionne d'accord avec les sources.
echo "Build..."
if [ "$DRY_RUN" = "1" ]; then
  echo "  (dry-run : build saute)"
else
  npm run build
fi
echo ""

if [ -n "$(git status --porcelain)" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    echo "(dry-run) git add -A && git commit -m \"$COMMIT_MSG\""
  else
    git add -A
    git commit -m "$COMMIT_MSG"
  fi
else
  echo "Rien a committer."
fi
echo ""

if [ "$DRY_RUN" = "1" ]; then
  echo "(dry-run) git push origin main"
  echo ""
  echo "Dry-run termine, rien n'a ete pousse."
  exit 0
fi

echo "Push vers main..."
git push origin main
echo ""

echo "Pousse. GitHub Actions rebuild et deploie, environ 1 minute."
echo "  https://mauditemachine.com"
if command -v gh >/dev/null 2>&1; then
  echo ""
  echo "Suivre le deploiement :"
  echo "  gh run watch \$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')"
fi
