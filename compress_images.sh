#!/bin/bash

# Créer un dossier pour les images compressées
mkdir -p medias/compressed

# Trouver toutes les images JPG qui dépassent 300ko
find medias -type f -name "*.jpg" -size +300k | while read -r image; do
    # Obtenir le nom du fichier
    filename=$(basename "$image")
    
    # Compresser l'image avec une qualité de 50% et réduire sa taille de 10%
    convert "$image" -resize 90% -quality 50 "medias/compressed/$filename"
    
    echo "Image compressée: $filename"
done

# Remplacer les images originales par les versions compressées
mv medias/compressed/* medias/
rmdir medias/compressed

echo "Compression terminée !" 