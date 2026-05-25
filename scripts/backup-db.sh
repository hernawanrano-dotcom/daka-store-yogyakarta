#!/bin/bash
# Database backup script

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/daka_store_backup_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

echo "📀 Backing up database to $BACKUP_FILE..."

docker exec daka-postgres-prod pg_dump -U daka daka_store_prod > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $BACKUP_FILE"
    gzip $BACKUP_FILE
    echo "📦 Compressed: $BACKUP_FILE.gz"
    
    # Keep only last 30 backups
    ls -tp $BACKUP_DIR/*.gz | tail -n +31 | xargs -I {} rm -- {}
else
    echo "❌ Backup failed!"
    exit 1
fi