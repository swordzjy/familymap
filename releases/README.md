# 发布包说明

## 文件结构

```
temp_YYYYMMDD_HHMMSS/
├── backend/                 # 后端服务
│   ├── server.js           # 主服务器文件
│   ├── package.json        # 依赖配置
│   ├── .env.example        # 环境变量模板
│   ├── utils/              # 工具函数
│   ├── check-db-schema.sh  # 数据库检查脚本
│   ├── DEPLOY_GUIDE.md     # 详细部署指南
│   └── wangzu-api.service  # systemd 服务配置
├── sql/                     # 数据库脚本
│   ├── schema.sql          # 建库脚本
│   ├── deploy.sql          # 预置数据
│   └── *.sql               # 增量迁移
├── nginx.conf              # Nginx 配置
├── README.md               # 项目说明
└── DEPLOY_CHECKLIST.md     # 部署检查清单
```

## 快速部署

```bash
# 1. 检查数据库
cd backend
./check-db-schema.sh

# 2. 安装依赖
npm install --production

# 3. 配置环境变量
cp .env.example .env
vim .env  # 填入实际配置

# 4. 启动服务
npm start

# 5. 配置 Nginx
sudo cp ../../nginx.conf /etc/nginx/sites-available/wangzu-map
sudo ln -s /etc/nginx/sites-available/wangzu-map /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

## 详细文档

参见 `DEPLOY_GUIDE.md`

## 验证

```bash
# 健康检查
curl http://localhost:3005/amapapi/health

# 应返回 {"status":"ok",...}
```
