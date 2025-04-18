#!/bin/bash

# Tuer tous les processus Python existants
pkill -f python3

# Attendre que le port soit libéré
sleep 2

# Démarrer le serveur en arrière-plan avec nohup
nohup python3 -m http.server 8000 > server.log 2>&1 &

# Vérifier que le serveur est bien démarré
sleep 2
if pgrep -f "python3 -m http.server" > /dev/null; then
    echo "✅ Serveur démarré avec succès sur http://localhost:8000"
    echo "📝 Les logs sont dans server.log"
else
    echo "❌ Erreur: Le serveur n'a pas démarré"
fi 