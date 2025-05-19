#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/home/server/backups"
DB_FILE="/home/server/database/tutorials.sqlite"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 复制数据库文件
cp $DB_FILE "$BACKUP_DIR/tutorials_$TIMESTAMP.sqlite"

# 删除7天以上的备份
find $BACKUP_DIR -name "tutorials_*.sqlite" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/tutorials_$TIMESTAMP.sqlite" 