#!/bin/bash

# ============================================================
# 数据库表结构检查脚本（简化版）
# ============================================================
# 用法：./check-db-schema.sh [db_host] [db_name]
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 从 .env 文件加载配置
ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
    DB_HOST=$(grep -E "^DB_HOST=" "$ENV_FILE" | cut -d'=' -f2 | tr -d ' \r\n')
    DB_NAME=$(grep -E "^DB_NAME=" "$ENV_FILE" | cut -d'=' -f2 | tr -d ' \r\n')
    DB_USER=$(grep -E "^DB_USER=" "$ENV_FILE" | cut -d'=' -f2 | tr -d ' \r\n')
    DB_PORT=$(grep -E "^DB_PORT=" "$ENV_FILE" | cut -d'=' -f2 | tr -d ' \r\n')
    DB_PASSWORD=$(grep -E "^DB_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2 | tr -d ' \r\n')
fi

# 默认值
DB_HOST=${DB_HOST:-localhost}
DB_NAME=${DB_NAME:-family_migration}
DB_USER=${DB_USER:-postgres}
DB_PORT=${DB_PORT:-5432}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# PSQL 命令封装
run_sql() {
    PGPASSWORD="${DB_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$1" 2>/dev/null | tr -d ' \n'
}

run_sql_table() {
    PGPASSWORD="${DB_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$1" 2>/dev/null
}

echo ""
echo "============================================================"
echo "           数据库表结构检查"
echo "============================================================"
echo "数据库：$DB_NAME @ $DB_HOST:$DB_PORT"
echo "时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. 检查连接
log_info "检查数据库连接..."
if run_sql "SELECT 1" | grep -q "1"; then
    log_success "数据库连接成功"
else
    log_error "数据库连接失败"
    echo ""
    echo "请检查："
    echo "  - 数据库服务是否运行"
    echo "  - .env 配置是否正确"
    echo "  - 防火墙设置"
    exit 1
fi

# 2. 检查必需表
echo ""
log_info "检查必需表..."

REQUIRED_TABLES="users,family_profiles,persons,migrations,relationships,places,historical_events,stories,story_chapters,story_outputs,chat_sessions"

for table in $(echo $REQUIRED_TABLES | tr ',' ' '); do
    result=$(run_sql "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');")
    if [ "$result" = "t" ]; then
        count=$(run_sql_table "SELECT COUNT(*) FROM $table;" | tr -d ' ')
        log_success "表 $table 存在 ($count 条记录)"
    else
        log_error "表 $table 缺失"
    fi
done

# 3. 检查关键字段
echo ""
log_info "检查关键字段..."

# 检查 story_chapters 新增字段
NEW_COLUMNS="migration_ids:JSONB,is_group_event:BOOLEAN,participant_count:INTEGER,participant_roles:TEXT[]"

for col_spec in $(echo $NEW_COLUMNS | tr ',' ' '); do
    col_name=$(echo $col_spec | cut -d: -f1)
    col_type=$(echo $col_spec | cut -d: -f2)
    result=$(run_sql "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'story_chapters' AND column_name = '$col_name');")
    if [ "$result" = "t" ]; then
        log_success "story_chapters.$col_name ($col_type) 存在"
    else
        log_warning "story_chapters.$col_name ($col_type) 缺失"
    fi
done

# 检查 persons.generation
result=$(run_sql "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'persons' AND column_name = 'generation');")
if [ "$result" = "t" ]; then
    log_success "persons.generation 存在"
else
    log_error "persons.generation 缺失"
fi

# 4. 数据质量检查
echo ""
log_info "数据质量检查..."

# 重复人物检查
dup_count=$(run_sql_table "SELECT COUNT(*) FROM (SELECT name, family_id, COUNT(*) FROM persons GROUP BY name, family_id HAVING COUNT(*) > 1) dup;" | tr -d ' ')
if [ "$dup_count" -gt 0 ] 2>/dev/null; then
    log_warning "发现 $dup_count 个重复人物记录"
else
    log_success "无重复人物记录"
fi

# 未知 relationType 检查
unknown_count=$(run_sql_table "SELECT COUNT(*) FROM migrations WHERE relation_type = 'unknown';" | tr -d ' ')
if [ "$unknown_count" -gt 0 ] 2>/dev/null; then
    log_warning "发现 $unknown_count 条迁徙记录 relationType=unknown"
else
    log_success "所有迁徙记录 relationType 正常"
fi

# 5. 数据库大小
echo ""
log_info "数据库大小..."
db_size=$(run_sql_table "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" | tr -d ' ')
log_info "数据库 $DB_NAME 大小：$db_size"

echo ""
echo "============================================================"
echo "检查完成"
echo "============================================================"
echo ""
