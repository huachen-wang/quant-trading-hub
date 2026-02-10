# 量化军火库 - 管理后台使用指南

## 访问管理后台

### 1. 登录管理员账号

访问网站并使用OAuth登录(目前支持的登录方式)。

### 2. 设置管理员权限

管理员权限需要在数据库中手动设置。连接到数据库后,运行以下SQL:

```sql
-- 查看所有用户
SELECT id, name, email, role FROM users;

-- 将用户设置为管理员(替换YOUR_USER_ID为实际用户ID)
UPDATE users SET role = 'admin' WHERE id = YOUR_USER_ID;
```

### 3. 访问管理后台

1. 登录后,点击底部导航栏的"👤 我的"
2. 如果您是管理员,会看到"⚙️ 管理员后台"卡片
3. 点击进入管理后台

## 管理后台功能

### 策略管理

**访问路径:** 管理后台首页 → 策略管理

**功能:**
- **查看策略列表** - 显示所有策略,包括标题、平台、收益率、胜率、下载量等
- **筛选策略** - 按状态筛选(全部/草稿/已发布/已归档)
- **添加策略** - 点击右上角"添加策略"按钮
- **编辑策略** - 点击策略卡片的"编辑"按钮
- **删除策略** - 点击策略卡片的"删除"按钮(会弹出确认对话框)

### 策略表单字段

创建或编辑策略时,需要填写以下字段:

**基本信息:**
- 标题 (必填)
- 描述
- 平台 (MT4/MT5)
- 交易对 (如: EURUSD, XAUUSD)
- 时间周期 (如: H1, H4, D1)
- 封面图片URL

**实盘数据:**
- 总收益率 (%)
- 最大回撤 (%)
- 夏普比率
- 胜率 (%)

**下载和价格:**
- 下载链接
- 价格 (元)
- 是否免费

**联系方式:**
- Telegram群组
- QQ群

**状态:**
- 草稿 - 不会在前台显示
- 已发布 - 在前台显示
- 已归档 - 不会在前台显示

### 评论管理

**访问路径:** 管理后台首页 → 评论管理

**功能:**
- 查看所有评论
- 删除不当评论

### 数据统计

**访问路径:** 管理后台首页 → 数据统计

**功能:**
- 查看策略总数
- 查看总下载量
- 查看总购买数
- 查看其他统计数据

## 数据库直接操作

如果需要批量操作或高级功能,可以直接连接数据库:

### 批量插入策略

```bash
# 使用seed脚本(已配置为只插入前2个策略)
cd /path/to/quant-trading-hub
pnpm exec tsx server/db/seed-new-strategies.ts
```

### 查看策略数量

```bash
pnpm exec tsx scripts/check-count.ts
```

### 重置测试数据

```bash
pnpm exec tsx scripts/reset-test-data.ts
```

## 常见问题

### Q: 如何修改网站名称?

A: 修改`app.config.ts`中的`appName`字段:

```typescript
const env = {
  appName: "量化军火库",
  // ...
};
```

### Q: 如何上传策略封面图?

A: 目前需要先将图片上传到图床(如Unsplash, Imgur等),然后在策略表单中填写图片URL。

推荐使用Unsplash的图片URL格式:
```
https://images.unsplash.com/photo-XXXXXXXXXX
```

### Q: 如何保留现有策略数据?

A: 不要运行`server/db/seed-new-strategies.ts`脚本,因为它会清空现有数据。如果需要添加新策略,使用管理后台的"添加策略"功能。

### Q: 如何备份数据库?

A: 如果使用Railway,可以在Railway控制台中导出数据库:

```bash
# 导出数据库
railway db export > backup.sql

# 导入数据库
railway db import < backup.sql
```

## 技术支持

如需技术支持,请联系开发团队。
