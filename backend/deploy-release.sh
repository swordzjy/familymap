#!/bin/bash

# ============================================================
# 家族迁徙平台 - 生产环境发布脚本
# ============================================================
# 功能：
# 1. 检查数据库表结构是否正确
# 2. 打包必要的发布文件
# 3. 生成部署报告
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
SQL_DIR="$PROJECT_ROOT/sql"
RELEASE_DIR="$PROJECT_ROOT/releases"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RELEASE_PACKAGE="$RELEASE_DIR/release_$TIMESTAMP.tar.gz"

# 数据库配置（从 .env 读取）
if [ -f "$BACKEND_DIR/.env" ]; then
    source "$BACKEND_DIR/.env"
else
    echo -e "${YELLOW}警告：未找到 .env 文件，使用默认配置${NC}"
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_NAME=${DB_NAME:-family_migration}
    DB_USER=${DB_USER:-postgres}
fi

# ============================================================
# 函数定义
# ============================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查数据库连接
check_db_connection() {
    log_info "检查数据库连接..."

    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
        log_success "数据库连接成功：$DB_NAME@$DB_HOST:$DB_PORT"
        return 0
    else
        log_error "数据库连接失败"
        echo ""
        echo "请检查："
        echo "  1. 数据库服务是否运行"
        echo "  2. .env 文件中的数据库配置是否正确"
        echo "  3. 防火墙设置"
        echo ""
        echo "测试连接命令："
        echo "  PGPASSWORD=xxx psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
        return 1
    fi
}

# 检查必需表
check_required_tables() {
    log_info "检查必需表结构..."

    local required_tables=(
        "users"
        "family_profiles"
        "persons"
        "migrations"
        "relationships"
        "places"
        "historical_events"
        "stories"
        "story_chapters"
        "story_outputs"
        "chat_sessions"
    )

    local missing_tables=()

    for table in "${required_tables[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
           "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null | grep -q "t"; then
            log_success "表 $table 存在"
        else
            log_error "表 $table 缺失"
            missing_tables+=("$table")
        fi
    done

    if [ ${#missing_tables[@]} -gt 0 ]; then
        echo ""
        log_warning "缺失以下表："
        for table in "${missing_tables[@]}"; do
            echo "  - $table"
        done
        echo ""
        log_info "运行以下 SQL 文件创建缺失的表："
        echo "  psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f $SQL_DIR/schema.sql"
        return 1
    else
        log_success "所有必需表已存在"
        return 0
    fi
}

# 检查表字段
check_table_columns() {
    log_info "检查关键字段..."

    # 检查 story_chapters 表的关键字段
    local story_chapters_columns=(
        "migration_ids"
        "is_group_event"
        "participant_count"
        "participant_roles"
    )

    for column in "${story_chapters_columns[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
           "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'story_chapters' AND column_name = '$column');" 2>/dev/null | grep -q "t"; then
            log_success "story_chapters.$column 存在"
        else
            log_warning "story_chapters.$column 缺失 - 需要运行迁移脚本"
        fi
    done

    # 检查 persons.generation 字段
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
       "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'persons' AND column_name = 'generation');" 2>/dev/null | grep -q "t"; then
        log_success "persons.generation 存在"
    else
        log_error "persons.generation 缺失"
    fi
}

# 检查数据健康度
check_data_health() {
    log_info "检查数据健康度..."

    # 统计各表记录数
    local tables=("family_profiles" "persons" "migrations" "relationships" "stories" "story_chapters")

    for table in "${tables[@]}"; do
        local count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
                     "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ')
        if [ -n "$count" ]; then
            log_info "表 $table: $count 条记录"
        fi
    done

    # 检查重复数据
    local dup_persons=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
                       "SELECT COUNT(*) FROM (SELECT name, family_id, COUNT(*) FROM persons GROUP BY name, family_id HAVING COUNT(*) > 1) dup;" 2>/dev/null | tr -d ' ')
    if [ "$dup_persons" -gt 0 ] 2>/dev/null; then
        log_warning "发现 $dup_persons 个重复的人物记录"
    fi

    # 检查未知 relationType 的迁徙
    local unknown_rel=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
                       "SELECT COUNT(*) FROM migrations WHERE relation_type = 'unknown';" 2>/dev/null | tr -d ' ')
    if [ "$unknown_rel" -gt 0 ] 2>/dev/null; then
        log_warning "发现 $unknown_rel 条迁徙记录的 relationType 为 unknown"
    fi
}

# 打包发布文件
create_release_package() {
    log_info "创建发布包..."

    # 创建 releases 目录
    mkdir -p "$RELEASE_DIR"

    # 创建临时打包目录
    local temp_dir="$RELEASE_DIR/temp_$TIMESTAMP"
    mkdir -p "$temp_dir"

    # 复制必要文件
    log_info "复制后端文件..."
    cp -r "$BACKEND_DIR" "$temp_dir/backend"
    rm -rf "$temp_dir/backend/node_modules"
    rm -rf "$temp_dir/backend/agents"
    rm -f "$temp_dir/backend/server.js.bak"
    rm -f "$temp_dir/backend/server.log"
    rm -f "$temp_dir/backend/server.pid"

    log_info "复制前端文件..."
    mkdir -p "$temp_dir/frontend/js"
    cp "$PROJECT_ROOT/frontend/js/kinship-db.js" "$temp_dir/frontend/js/" 2>/dev/null || true
    cp "$PROJECT_ROOT/frontend/js/visualization.js" "$temp_dir/frontend/js/" 2>/dev/null || true
    cp -r "$PROJECT_ROOT/frontend/public" "$temp_dir/frontend/" 2>/dev/null || true

    log_info "复制 SQL 脚本..."
    cp -r "$SQL_DIR" "$temp_dir/sql"

    log_info "复制配置文件..."
    cp "$PROJECT_ROOT/nginx.conf" "$temp_dir/" 2>/dev/null || true
    cp "$PROJECT_ROOT/README.md" "$temp_dir/" 2>/dev/null || true

    # 创建部署清单
    cat > "$temp_dir/DEPLOY_CHECKLIST.md" << 'EOF'
# 部署检查清单

## 1. 环境准备

- [ ] Node.js >= 14 已安装
- [ ] PostgreSQL 14+ 已安装并运行
- [ ] Nginx 已安装

## 2. 数据库部署

```bash
# 创建数据库
createdb family_migration

# 执行建库脚本
psql -d family_migration -f sql/schema.sql

# 执行增量迁移（如有）
psql -d family_migration -f sql/add-story-chapters-unique-constraint.sql
psql -d family_migration -f sql/alter-story-chapters.sql
```

## 3. 后端部署

```bash
cd backend

# 安装依赖
npm install --production

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际配置

# 启动服务
npm start
# 或后台运行
nohup npm start > server.log 2>&1 &
```

## 4. Nginx 配置

```bash
# 复制配置文件
sudo cp nginx.conf /etc/nginx/sites-available/wangzu-map

# 创建软链接
sudo ln -s /etc/nginx/sites-available/wangzu-map /etc/nginx/sites-enabled/

# 测试并重载
sudo nginx -t
sudo nginx -s reload
```

## 5. 验证

- [ ] 访问 http://your-domain/wangzu/ 能正常显示
- [ ] API /amapapi/health 返回成功
- [ ] 数据库连接正常
EOF

    # 创建版本信息
    cat > "$temp_dir/VERSION" << EOF
发布日期：$(date '+%Y-%m-%d %H:%M:%S')
Git Commit: $(git log -1 --format="%h" 2>/dev/null || echo "unknown")
后端文件：$(find "$temp_dir/backend" -type f | wc -l | tr -d ' ') 个文件
SQL 脚本：$(find "$temp_dir/sql" -type f | wc -l | tr -d ' ') 个文件
EOF

    # 打包
    log_info "打包中..."
    cd "$RELEASE_DIR"
    tar -czf "release_$TIMESTAMP.tar.gz" "temp_$TIMESTAMP"
    rm -rf "$temp_dir"

    log_success "发布包已创建：$RELEASE_PACKAGE"

    # 显示包大小
    local size=$(du -h "$RELEASE_PACKAGE" | cut -f1)
    log_info "包大小：$size"
}

# 生成部署报告
generate_report() {
    echo ""
    echo "============================================================"
    echo "                    部署检查报告"
    echo "============================================================"
    echo ""
    echo "数据库：$DB_NAME@$DB_HOST:$DB_PORT"
    echo "检查时间：$(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "------------------------------------------------------------"
    echo "检查项目                          状态"
    echo "------------------------------------------------------------"

    # 数据库连接
    if check_db_connection >/dev/null 2>&1; then
        printf "%-32s %s\n" "数据库连接" "[OK]"
    else
        printf "%-32s %s\n" "数据库连接" "[FAIL]"
    fi

    # 必需表
    if check_required_tables >/dev/null 2>&1; then
        printf "%-32s %s\n" "必需表结构" "[OK]"
    else
        printf "%-32s %s\n" "必需表结构" "[FAIL]"
    fi

    echo ""
    echo "------------------------------------------------------------"
    echo "发布包信息"
    echo "------------------------------------------------------------"
    if [ -f "$RELEASE_PACKAGE" ]; then
        echo "包路径：$RELEASE_PACKAGE"
        echo "包大小：$(du -h "$RELEASE_PACKAGE" | cut -f1)"
        echo ""
        echo "部署命令："
        echo "  cd /path/to/production"
        echo "  tar -xzf $RELEASE_PACKAGE"
        echo "  cd temp_$TIMESTAMP"
        echo "  ./DEPLOY_CHECKLIST.md"
    else
        echo "发布包创建失败"
    fi
    echo ""
    echo "============================================================"
}

# ============================================================
# 主流程
# ============================================================

echo ""
echo "============================================================"
echo "     家族迁徙平台 - 生产环境发布脚本"
echo "============================================================"
echo ""

# 1. 检查数据库连接
if ! check_db_connection; then
    log_error "数据库连接失败，终止发布流程"
    exit 1
fi

# 2. 检查表结构
check_required_tables
check_table_columns

# 3. 数据健康检查
check_data_health

# 4. 创建发布包
create_release_package

# 5. 生成报告
generate_report

echo ""
log_success "发布检查完成！"
echo ""
