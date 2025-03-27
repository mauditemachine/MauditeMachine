#!/bin/bash

# Configuration FTP
FTP_HOST="ftp.mauditemachine.com"
FTP_USER="admin@mauditemachine.com"

echo "Prouteuu999"
read -s FTP_PASS

echo "📤 Upload des fichiers en cours..."
export LFTP_PASSWORD="$FTP_PASS"

# Upload des fichiers et définir les permissions
lftp -u $FTP_USER,$FTP_PASS $FTP_HOST -e "set ssl:verify-certificate no; mirror -R --verbose --delete ./ ./; chmod -R 755 ./; bye"

echo "✅ Upload terminé!"