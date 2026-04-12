# 生产环境发布脚本说明

## 文件结构说明

### 目录结构

```
wangzu-map/
├── backend/
│   ├── utils/              # 后端工具（Node.js 使用）
│   │   ├── kinship-db.js   # 亲属关系库（后端版）
│   │   └── nlp-service.js  # NLP 服务（后端版）
│   ├── server.js           # 主服务器
│   └── ...
├── frontend/
│   ├── js/                 # 前端工具（浏览器使用）
│   │   ├── kinship-db.js   # 亲属关系库（前端版，导出到 window）
│   │   └── visualization.js # 家族树可视化
│   └── public/             # 静态页面
└── sql/                    # 数据库脚本
```

**注意：** `backend/utils/kinship-db.js` 和 `frontend/js/kinship-db.js` 是两个不同的文件：
- **后端版**：使用 `module.exports`，供 `server.js` 通过 `require()` 引用
- **前端版**：使用 `window.KinshipDB`，供浏览器通过 `<script>` 标签加载

---

本次创建了以下发布相关的脚本和配置文件：

### 1. 核心脚本

| 文件 | 用途 | 命令 |
|------|------|------|
| `backend/check-db-schema.sh` | 检查数据库表结构 | `./check-db-schema.sh` |
| `backend/deploy-release.sh` | 完整发布流程（打包+检查） | `./deploy-release.sh` |
| `backend/quick-deploy.sh` | 快速部署（开发/生产） | `./quick-deploy.sh all` |

### 2. 配置文件

| 文件 | 用途 |
|------|------|
| `backend/.env.prod.example` | 生产环境变量模板 |
| `backend/wangzu-api.service` | systemd 服务配置 |
| `backend/DEPLOY_GUIDE.md` | 详细部署指南 |

### 3. 辅助文件

| 文件 | 用途 |
|------|------|
| `releases/README.md` | 发布包说明 |
| `backend/DEPLOY_CHECKLIST.md` | 部署检查清单（由脚本生成） |

---

## 使用方法

### 方式一：仅检查数据库

```bash
cd backend
./check-db-schema.sh
```

**输出示例：**
```
============================================================
           数据库表结构检查
============================================================
[OK] 数据库连接成功
[OK] 表 users 存在 (0 条记录)
[OK] 表 persons 存在 (33 条记录)
[OK] 表 migrations 存在 (46 条记录)
...
[WARN] story_chapters.migration_ids (JSONB) 缺失
[OK] persons.generation 存在
```

### 方式二：完整发布流程

```bash
cd backend
./deploy-release.sh
```

**执行步骤：**
1. 检查数据库连接
2. 检查必需表结构
3. 检查关键字段
4. 数据质量检查
5. 创建发布包（`releases/release_YYYYMMDD_HHMMSS.tar.gz`）
6. 生成部署报告

### 方式三：快速部署（开发环境）

```bash
cd backend
./quick-deploy.sh all
```

**执行步骤：**
1. 检查环境（Node.js, PostgreSQL, Nginx）
2. 检查数据库
3. 打包发布文件
4. 部署到本地（启动服务、配置 Nginx）

---

## 发布包内容

```
release_YYYYMMDD_HHMMSS.tar.gz
└── temp_YYYYMMDD_HHMMSS/
    ├── backend/
    │   ├── server.js              # 主服务器
    │   ├── package.json           # 依赖配置
    │   ├── .env.example           # 环境变量模板
    │   ├── utils/                 # 后端工具（Node.js 使用）
    │   │   ├── kinship-db.js      # 亲属关系库（后端版）
    │   │   └── nlp-service.js     # NLP 服务（后端版）
    │   ├── check-db-schema.sh     # 数据库检查
    │   ├── DEPLOY_GUIDE.md        # 部署指南
    │   └── wangzu-api.service     # systemd 配置
    ├── frontend/
    │   ├── js/                    # 前端工具（浏览器使用）
    │   │   ├── kinship-db.js      # 亲属关系库（前端版）
    │   │   └── visualization.js   # 家族树可视化
    │   └── public/                # 静态页面
    │       ├── mobile-chat.html
    │       ├── story-timeline.html
    │       ├── family-tree.html
    │       └── story.html
    ├── sql/
    │   ├── schema.sql             # 建库脚本
    │   ├── deploy.sql             # 预置数据
    │   └── *.sql                  # 增量迁移
    ├── nginx.conf                 # Nginx 配置
    ├── README.md                  # 项目说明
    └── DEPLOY_CHECKLIST.md        # 检查清单
```

---

## 部署到生产服务器

### 1. 本地打包

```bash
cd backend
./deploy-release.sh
```

### 2. 传输到生产服务器

```bash
scp releases/release_*.tar.gz user@prod-server:/opt/wangzu-map/
```

### 3. 解压部署

```bash
ssh user@prod-server
cd /opt/wangzu-map
tar -xzf release_*.tar.gz
cd temp_*

# 按照检查清单执行
cat DEPLOY_CHECKLIST.md
```

---

## 数据库迁移

如果检查发现缺失字段，执行相应的迁移脚本：

```bash
cd sql
psql -d family_migration -f add-story-chapters-unique-constraint.sql
psql -d family_migration -f alter-story-chapters.sql
psql -d family_migration -f add-story-outputs-table.sql
```

---

## systemd 服务部署

### 1. 复制服务配置

```bash
sudo cp backend/wangzu-api.service /etc/systemd/system/
```

### 2. 启用服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable wangzu-api
sudo systemctl start wangzu-api
```

### 3. 查看状态

```bash
sudo systemctl status wangzu-api
journalctl -u wangzu-api -f
```

---

## 常见问题

### Q1: 数据库连接失败

**检查项：**
- PostgreSQL 服务是否运行：`sudo systemctl status postgresql`
- `.env` 配置是否正确
- 防火墙是否开放 5432 端口

### Q2: 端口被占用

```bash
# 查找占用进程
lsof -ti:3005

# 终止进程
kill -9 $(lsof -ti:3005)
```

### Q3: 缺失表字段

运行对应的 SQL 迁移脚本：

```bash
psql -d family_migration -f sql/alter-story-chapters.sql
```

---

## 验证清单

部署完成后，逐项检查：

- [ ] 数据库连接正常
- [ ] 所有必需表存在
- [ ] 后端服务运行（`curl http://localhost:3005/amapapi/health`）
- [ ] Nginx 配置正确（`sudo nginx -t`）
- [ ] 前端页面可访问（`http://your-domain/wangzu/`）
- [ ] API 调用正常（家族成员、迁徙地图等）

---

## 回滚方案

如需回滚到旧版本：

```bash
# 1. 停止服务
sudo systemctl stop wangzu-api

# 2. 备份当前版本
cd /opt/wangzu-map
tar -czf backup_$(date +%Y%m%d).tar.gz backend

# 3. 恢复旧版本
tar -xzf backup_20260411.tar.gz
cp -r backend/* /opt/wangzu-map/backend/

# 4. 重启服务
sudo systemctl start wangzu-api
```

---

## 文件清单

本次创建的发布相关文件：

```
backend/
├── check-db-schema.sh          # 新增：数据库检查
├── deploy-release.sh           # 新增：发布打包
├── quick-deploy.sh             # 新增：快速部署
├── .env.prod.example           # 新增：生产环境模板
├── wangzu-api.service          # 新增：systemd 配置
├── DEPLOY_GUIDE.md             # 新增：详细部署指南
└── utils/                      # 后端工具（Node.js 使用）
    ├── kinship-db.js           # 亲属关系库（后端版）
    └── nlp-service.js          # NLP 服务（后端版）

frontend/
└── js/                         # 前端工具（浏览器使用）
    ├── kinship-db.js           # 亲属关系库（前端版）
    └── visualization.js        # 家族树可视化

releases/
└── README.md                   # 新增：发布包说明

docs/
└── deploy-scripts-summary.md   # 本文档
```

---

## 下一步

1. 在测试环境验证部署脚本
2. 根据实际需求调整配置
3. 首次生产部署建议在白天进行
4. 部署后密切监控日志
