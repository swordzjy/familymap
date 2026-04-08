# Nginx 部署说明

## 快速部署

### 1. 复制配置文件

```bash
sudo cp /Users/jianyu/Documents/feisu/xungen/wangzu-map/nginx.conf /etc/nginx/sites-available/wangzu-map
```

### 2. 创建软链接

```bash
sudo ln -s /etc/nginx/sites-available/wangzu-map /etc/nginx/sites-enabled/
```

### 3. 测试配置

```bash
sudo nginx -t
```

### 4. 重载 Nginx

```bash
sudo nginx -s reload
```

## 访问流程

```
用户访问 /wangzu/ 或 /wangzu/index.html
    ↓
Nginx 返回 index.html
    ↓
index.html 自动跳转到 mobile-chat.html
    ↓
用户看到聊天界面
```

## URL 说明

| URL | 说明 |
|-----|------|
| `/wangzu/` | 入口，自动跳转到 mobile-chat.html |
| `/wangzu/mobile-chat.html` | 聊天页面（移动端） |
| `/wangzu/story-timeline.html?familyId=xxx` | 迁徙时间线页面 |
| `/wangzu/mobile.html?familyId=xxx` | 地图展示页面 |
| `/amapapi/*` | 后端 API 代理 |

## 修改配置

如需修改域名，编辑 `nginx.conf`：

```nginx
server_name localhost;  # 改为你的域名，如 family.example.com
```

如需修改静态文件路径，编辑 `nginx.conf` 中的 `root` 和 `alias`：

```nginx
location / {
    root   /path/to/frontend/public;
}

location /wangzu/ {
    alias /path/to/frontend/public/;
}
```

## 后端服务

确保后端服务在运行：

```bash
cd /Users/jianyu/Documents/feisu/xungen/wangzu-map/backend
node server.js
```

后端默认运行在 `http://localhost:3005`

## 测试

访问 `http://localhost/wangzu/` 应该自动跳转到 `http://localhost/wangzu/mobile-chat.html`
