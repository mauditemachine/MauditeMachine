# CLAUDE.md - mauditemachine.com

Claude Code charge ce fichier automatiquement au debut de chaque session (sur Mac comme dans le cloud).
Les regles completes du projet et le protocole de **travail simultane avec Antigravity (Gemini)** sont dans les deux fichiers importes ci-dessous : les lire en entier et les appliquer a chaque tache, sans exception.

@AGENTS.md
@contexte.md

## Specificites Claude Code

- **Cohabitation temps reel avec Antigravity / Gemini** :
  Avant de toucher au moindre fichier ou de changer de branche, toujours verifier `git status -s -- ':!dist'` et `git worktree list`. Si Antigravity a des modifications en cours dans le dossier principal (ou si Mika fait travailler les deux agents en meme temps), travailler exclusivement dans un **worktree isole** (`.claude/worktrees/<sujet>` ou `/tmp/mm-worktrees/claude-<sujet>`) sur une branche `claude/<sujet>`, puis ouvrir et fusionner une PR propre sur `main`.
- **Session dans le cloud (`claude.ai/code`, app Claude)** :
  - Le conteneur est neuf a chaque session : installer avec `npm ci` avant le build.
  - Les chemins Mac (`iCloud`, `.nosync`, `gh auth switch`) ne concernent que les sessions locales sur le Mac de Mika.
  - Apres fusion sur `main`, GitHub Actions (`.github/workflows/pages.yml`) met environ 60 a 90 secondes pour publier le nouveau build sur `https://mauditemachine.com/`.
- **Memoire durable** :
  Une session ne se souvient pas des precedentes. Toute nouvelle decision durable de Mika va dans `AGENTS.md` (regle permanente) ou `contexte.md` (etat en ligne et chantiers actifs) dans la meme PR.
