#!/bin/bash

# Configuration FTP
FTP_HOST="ftp.mauditemachine.com"
FTP_USER="admin@mauditemachine.com"
FTP_PASS="Prouteuu999"
FTP_DIR="/public_html"

# Upload des fichiers avec lftp
lftp -u $FTP_USER,$FTP_PASS $FTP_HOST -e "set ssl:verify-certificate no; mirror -R --verbose --delete ./ ./; chmod -R 755 ./; bye"

echo "Déploiement terminé !"