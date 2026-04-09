# 多家族迁徙故事演示部署说明

## 概述

`multi-stories.html` 是一个演示页面，展示 4 个不同历史时期的家族迁徙故事：

1. **林家** - 闯关东 (1890-1895)：山东→辽宁→黑龙江
2. **陈家** - 抗战西迁 (1937-1946)：南京→武汉→重庆→南京
3. **赵家** - 三线建设 (1964-1982)：上海→兰州→西安→上海
4. **周家** - 南下创业 (1985-2010)：沈阳→深圳→广州

## 部署步骤

### 1. 插入演示数据

```bash
cd /Users/jianyu/Documents/feisu/xungen/wangzu-map/sql
psql -h localhost -U aifeisu -d family_migration -f multi-stories-data.sql
```

### 2. 启动后端服务

```bash
cd /Users/jianyu/Documents/feisu/xungen/wangzu-map/backend
node server.js
```

### 3. 访问页面

- **本地访问**: http://localhost:3005/multi-stories.html
- **Nginx 部署**: http://localhost/wangzu/multi-stories.html

## 页面功能

### 故事选择器
- 顶部横向滚动条，可选择不同的家族故事
- 显示家族名称和时期（如：林家·清末）
- 选中状态高亮显示

### 地图动画
- 自动播放迁徙路径动画
- 每段迁徙前显示事件卡片（年份、事件、描述）
- 点击城市标记可查看详细信息

### 底部信息栏
- 显示当前家族的迁徙路径芯片
- 点击芯片可聚焦到对应路线

## 数据结构

### 数据库表依赖

| 表名 | 用途 |
|------|------|
| `family_profiles` | 家族档案（4 个家族） |
| `persons` | 家族成员（每个家族 2-4 人） |
| `migrations` | 迁徙事件（每个家族 2-3 次迁徙） |
| `places` | 地点信息（约 12 个城市） |

### API 端点

| 端点 | 说明 |
|------|------|
| `GET /amapapi/demo-stories` | 获取故事列表（摘要） |
| `GET /amapapi/migration-map/:familyId` | 获取具体家族的详细迁徙数据 |

## 备用模式

如果数据库中没有演示数据，页面会自动加载内置的备用数据（硬编码在 JavaScript 中），确保演示不受影响。

## 扩展新故事

要添加新的家族故事：

1. 在 `multi-stories-data.sql` 中添加新的家族数据
2. 在 `server.js` 的 `getStoryTitle()` 和 `getStoryPeriod()` 中添加标题和时期映射
3. 刷新页面即可看到新故事

## 视觉效果

每个故事的迁徙路径使用不同颜色：
- **生存型** (`survival`)：金色 `#c8a96e`
- **战争型** (`war`)：珊瑚色 `#e07258`
- **政策型** (`policy`)：青绿色 `#3ec9a0`
- **工作型** (`work`)：紫色 `#a890e0`
- **求学型** (`study`)：蓝色 `#6aabdc`

## 技术细节

- 使用高德地图 API v2.0
- 贝塞尔曲线绘制迁徙路径
- CSS 变量主题系统
- 响应式设计（支持移动端）
