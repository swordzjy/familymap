# 生产环境部署指南

## 目录

- [快速部署](#快速部署)
- [详细步骤](#详细步骤)
- [数据库迁移](#数据库迁移)
- [验证检查](#验证检查)
- [故障排查](#故障排查)

---

## 快速部署

### 1. 检查数据库表结构

```bash
cd backend
./check-db-schema.sh
```

### 2. 打包发布文件

```bash
./deploy-release.sh
```

### 3. 部署到生产服务器

```bash
# 复制发布包到生产服务器
scp releases/release_*.tar.gz user@prod-server:/opt/wangzu-map/

# 解压
ssh user@prod-server
cd /opt/wangzu-map
tar -xzf release_*.tar.gz
cd temp_*
```

---

## 详细步骤

### 步骤 1：环境准备

#### 1.1 系统要求

- **Node.js**: >= 14.0.0
- **PostgreSQL**: >= 14
- **Nginx**: >= 1.18
- **Git**: 用于版本控制

#### 1.2 检查已安装软件

```bash
# 检查 Node.js
node --version

# 检查 PostgreSQL
psql --version

# 检查 Nginx
nginx -v
```

### 步骤 2：数据库部署

#### 2.1 创建数据库

```bash
# 创建数据库
createdb family_migration

# 或使用 psql
psql -U postgres
CREATE DATABASE family_migration;
\q
```

#### 2.2 执行建库脚本

```bash
cd sql
psql -d family_migration -f schema.sql
```

#### 2.3 执行增量迁移

```bash
# 检查是否需要迁移
./check-db-schema.sh

# 执行迁移（如有缺失字段）
psql -d family_migration -f add-story-chapters-unique-constraint.sql
psql -d family_migration -f alter-story-chapters.sql
psql -d family_migration -f add-story-outputs-table.sql
```

#### 2.4 预置历史事件数据

```bash
psql -d family_migration -f deploy.sql
```

### 步骤 3：后端部署

#### 3.1 安装依赖

```bash
cd backend
npm install --production
```

#### 3.2 配置环境变量

```bash
# 复制配置模板
cp .env.prod.example .env

# 编辑配置文件
vim .env
```

**必需配置项：**

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `AMAP_KEY` | 高德 Web 服务 API Key | https://lbs.amap.com |
| `AMAP_JSCODE` | 高德安全密钥 | 同上 |
| `DASHSCOPE_API_KEY` | 阿里云 AI API Key | https://dashscope.console.aliyun.com |
| `DB_PASSWORD` | 数据库密码 | 自行设置 |

#### 3.3 启动服务

```bash
# 开发环境
npm start

# 生产环境（后台运行）
nohup npm start > server.log 2>&1 &

# 或使用 PM2（推荐）
npm install -g pm2
pm2 start server.js --name wangzu-api
pm2 save
pm2 startup
```

#### 3.4 设置开机自启

```bash
# 使用 systemd
sudo cp wangzu-api.service /etc/systemd/system/
sudo systemctl enable wangzu-api
sudo systemctl start wangzu-api
sudo systemctl status wangzu-api
```

### 步骤 4：Nginx 配置

#### 4.1 复制配置文件

```bash
sudo cp nginx.conf /etc/nginx/sites-available/wangzu-map
```

#### 4.2 修改配置（如需要）

```bash
sudo vim /etc/nginx/sites-available/wangzu-map
```

**需要修改的配置：**

```nginx
# 域名
server_name localhost;  # 改为你的域名，如 family.example.com

# 静态文件路径
root   /path/to/frontend/public;  # 改为实际路径

# API 代理地址
proxy_pass http://localhost:3005;  # 如端口不同需修改
```

#### 4.3 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/wangzu-map /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo nginx -s reload
```

---

## 验证检查

### 健康检查

```bash
# 检查后端服务
curl http://localhost:3005/amapapi/health

# 应返回
# {"status":"ok","timestamp":"..."}
```

### API 测试

```bash
# 测试家族成员 API
curl http://localhost:3005/amapapi/family-members/test-family-id

# 测试迁徙地图 API
curl http://localhost:3005/amapapi/migration-map/test-family-id
```

### 前端访问

```
http://your-domain/wangzu/
```

应自动跳转到 `mobile-chat.html` 并显示聊天界面。

### 数据库检查

```bash
cd backend
./check-db-schema.sh
```

---

## 故障排查

### 问题 1：数据库连接失败

**症状：**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方案：**

1. 检查 PostgreSQL 服务状态
   ```bash
   sudo systemctl status postgresql
   ```

2. 检查 pg_hba.conf 配置
   ```bash
   sudo vim /etc/postgresql/*/main/pg_hba.conf
   # 确保有：host all all 127.0.0.1/32 md5
   ```

3. 重启 PostgreSQL
   ```bash
   sudo systemctl restart postgresql
   ```

### 问题 2：端口被占用

**症状：**
```
Error: listen EADDRINUSE: address already in use :::3005
```

**解决方案：**

1. 查找占用端口的进程
   ```bash
   lsof -ti:3005
   ```

2. 终止进程
   ```bash
   kill -9 $(lsof -ti:3005)
   ```

3. 或修改端口
   ```bash
   vim .env
   PORT=3006  # 改为其他端口
   ```

### 问题 3：Nginx 502 Bad Gateway

**症状：**
访问页面显示 502 错误

**解决方案：**

1. 检查后端服务是否运行
   ```bash
   pm2 status
   # 或
   ps aux | grep node
   ```

2. 检查 Nginx 错误日志
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. 检查 Nginx 配置
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### 问题 4：AI API 调用失败

**症状：**
```
Error: API call failed
```

**解决方案：**

1. 检查 API Key 配置
   ```bash
   cat .env | grep DASHSCOPE
   ```

2. 测试 API 连通性
   ```bash
   curl -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
        https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
   ```

3. 检查额度是否充足
   登录 https://dashscope.console.aliyun.com 查看

---

## 附录

### A. 文件结构

```
wangzu-map/
├── backend/
│   ├── server.js              # 主服务器文件
│   ├── .env                   # 环境变量配置
│   ├── package.json           # 依赖配置
│   ├── utils/
│   │   ├── kinship-db.js      # 亲属关系库
│   │   └── nlp-service.js     # NLP 服务
│   ├── check-db-schema.sh     # 数据库检查脚本
│   └── deploy-release.sh      # 发布打包脚本
├── sql/
│   ├── schema.sql             # 建库脚本
│   ├── deploy.sql             # 预置数据
│   └── *.sql                  # 增量迁移脚本
├── frontend/public/
│   ├── mobile-chat.html       # 主聊天页面
│   ├── story-timeline.html    # 迁徙时间线
│   ├── family-tree.html       # 家族树
│   └── story.html             # 故事阅读
├── nginx.conf                 # Nginx 配置
└── releases/                  # 发布包目录
```

### B. 常用命令

```bash
# 查看服务日志
tail -f backend/server.log

# PM2 管理
pm2 logs wangzu-api
pm2 restart wangzu-api
pm2 stop wangzu-api

# 数据库备份
pg_dump -U postgres family_migration > backup_$(date +%Y%m%d).sql

# 数据库恢复
psql -U postgres family_migration < backup_20260412.sql
```

### C. 更新流程

```bash
# 1. 备份当前版本
cd /opt/wangzu-map
tar -czf backup_$(date +%Y%m%d).tar.gz backend frontend

# 2. 停止服务
pm2 stop wangzu-api

# 3. 部署新版本
scp releases/release_*.tar.gz user@prod-server:/opt/wangzu-map/
ssh user@prod-server
cd /opt/wangzu-map
tar -xzf release_*.tar.gz
cp -r temp_*/backend/* backend/
cp -r temp_*/frontend/* frontend/

# 4. 执行数据库迁移
cd backend
./check-db-schema.sh
psql -d family_migration -f ../sql/*.sql

# 5. 重启服务
pm2 start wangzu-api
```

---

## 联系支持

如遇问题，请查看：
- 项目文档：`README.md`
- 工作总结：`docs/2026-04-12-work-summary.md`
- Git 历史：`git log --oneline`
