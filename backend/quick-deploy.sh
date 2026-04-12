#!/bin/bash

# ============================================================
# 快速部署脚本
# ============================================================
# 用法：
#   ./quick-deploy.sh check     - 检查环境和数据库
#   ./quick-deploy.sh package   - 打包发布文件
#   ./quick-deploy.sh deploy    - 部署到本地（开发环境）
#   ./quick-deploy.sh all       - 完整流程
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RELEASES_DIR="$PROJECT_ROOT/releases"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
ok() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查环境
check_env() {
    log "检查环境..."

    # Node.js
    if command -v node &>/dev/null; then
        ok "Node.js: $(node --version)"
    else
        err "Node.js 未安装"
        return 1
    fi

    # PostgreSQL
    if command -v psql &>/dev/null; then
        ok "PostgreSQL: $(psql --version | head -1)"
    else
        err "PostgreSQL 未安装"
        return 1
    fi

    # Nginx
    if command -v nginx &>/dev/null; then
        ok "Nginx: $(nginx -v 2>&1 | head -1)"
    else
        warn "Nginx 未安装（如仅开发可忽略）"
    fi

    # npm 依赖
    if [ -f "$SCRIPT_DIR/node_modules" ]; then
        ok "npm 依赖已安装"
    else
        warn "npm 依赖未安装，运行 npm install..."
        cd "$SCRIPT_DIR" && npm install --production
    fi
}

# 检查数据库
check_db() {
    log "检查数据库..."

    # 加载 .env 配置
    if [ -f "$SCRIPT_DIR/.env" ]; then
        export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
    fi

    DB_HOST=${DB_HOST:-localhost}
    DB_NAME=${DB_NAME:-family_migration}
    DB_USER=${DB_USER:-postgres}

    # 测试连接
    if PGPASSWORD="${DB_PASSWORD:-}" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null; then
        ok "数据库连接成功：$DB_NAME"

        # 检查表
        local tables=$(PGPASSWORD="${DB_PASSWORD:-}" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
                      "SELECT string_agg(tablename, ',') FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null | tr -d ' \n')

        if [ -n "$tables" ]; then
            ok "现有表：$tables"
        else
            warn "数据库为空，需要运行 schema.sql"
        fi

        # 运行详细检查
        log "运行详细表结构检查..."
        "$SCRIPT_DIR/check-db-schema.sh"
    else
        err "数据库连接失败"
        echo ""
        echo "请确认："
        echo "  1. PostgreSQL 服务已启动"
        echo "  2. 数据库 $DB_NAME 已创建"
        echo "  3. .env 配置正确"
        echo ""
        echo "创建数据库命令："
        echo "  createdb $DB_NAME"
        return 1
    fi
}

# 打包
do_package() {
    log "打包发布文件..."

    mkdir -p "$RELEASES_DIR"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local temp_dir="$RELEASES_DIR/temp_$timestamp"
    local package="$RELEASES_DIR/release_$timestamp.tar.gz"

    # 复制文件
    mkdir -p "$temp_dir"

    log "复制后端文件..."
    cp -r "$SCRIPT_DIR" "$temp_dir/backend"
    rm -rf "$temp_dir/backend/node_modules"
    rm -f "$temp_dir/backend/server.js.bak"
    rm -f "$temp_dir/backend/server.log"
    rm -f "$temp_dir/backend/server.pid"

    log "复制 SQL 脚本..."
    cp -r "$PROJECT_ROOT/sql" "$temp_dir/sql"

    log "复制配置文件..."
    cp "$PROJECT_ROOT/nginx.conf" "$temp_dir/" 2>/dev/null || true
    cp "$PROJECT_ROOT/README.md" "$temp_dir/" 2>/dev/null || true

    # 创建版本信息
    cat > "$temp_dir/VERSION" << EOF
Release: $timestamp
Git: $(cd "$PROJECT_ROOT" && git log -1 --format="%h" 2>/dev/null || echo "unknown")
Date: $(date '+%Y-%m-%d %H:%M:%S')
EOF

    # 打包
    cd "$RELEASES_DIR"
    tar -czf "$package" "temp_$timestamp"
    rm -rf "$temp_dir"

    ok "发布包：$package ($(du -h "$package" | cut -f1))"
}

# 本地部署（开发环境）
do_deploy() {
    log "部署到本地环境..."

    # 启动后端
    log "启动后端服务..."
    cd "$SCRIPT_DIR"

    # 检查是否已在运行
    if [ -f "server.pid" ] && kill -0 $(cat server.pid) 2>/dev/null; then
        warn "服务已在运行 (PID: $(cat server.pid))"
        read -p "是否重启？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill $(cat server.pid)
            sleep 2
        else
            return
        fi
    fi

    # 启动
    nohup npm start > server.log 2>&1 &
    echo $! > server.pid
    sleep 2

    # 验证
    if curl -s http://localhost:3005/amapapi/health | grep -q "ok"; then
        ok "服务已启动 (PID: $(cat server.pid))"
        ok "健康检查通过"
    else
        err "服务启动失败，查看日志：tail -f server.log"
        return 1
    fi

    # Nginx 配置
    if [ -f "$PROJECT_ROOT/nginx.conf" ]; then
        log "配置 Nginx..."

        if [ ! -f "/etc/nginx/sites-available/wangzu-map" ]; then
            sudo cp "$PROJECT_ROOT/nginx.conf" /etc/nginx/sites-available/wangzu-map
            ok "Nginx 配置已复制"
        fi

        if [ ! -L "/etc/nginx/sites-enabled/wangzu-map" ]; then
            sudo ln -s /etc/nginx/sites-available/wangzu-map /etc/nginx/sites-enabled/
            ok "Nginx 软链接已创建"
        fi

        if sudo nginx -t 2>&1 | grep -q "successful"; then
            ok "Nginx 配置测试通过"
            sudo nginx -s reload 2>/dev/null || ok "Nginx 未运行，跳过重载"
        else
            err "Nginx 配置测试失败"
        fi
    fi
}

# 显示使用方法
show_usage() {
    echo "用法：$0 {check|package|deploy|all}"
    echo ""
    echo "命令:"
    echo "  check    - 检查环境和数据库"
    echo "  package  - 打包发布文件"
    echo "  deploy   - 部署到本地（开发环境）"
    echo "  all      - 完整流程 (check + package + deploy)"
    echo ""
    echo "示例:"
    echo "  $0 check     # 只检查"
    echo "  $0 package   # 只打包"
    echo "  $0 all       # 完整部署"
}

# 主流程
case "${1:-}" in
    check)
        check_env
        check_db
        ;;
    package)
        do_package
        ;;
    deploy)
        do_deploy
        ;;
    all)
        check_env
        check_db
        do_package
        do_deploy
        ok "部署完成！"
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
