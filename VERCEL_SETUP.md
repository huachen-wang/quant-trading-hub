# Vercel部署配置指南

## 问题说明

Expo Web项目在Vercel上部署时显示源码而不是渲染页面,这是因为需要正确配置构建输出。

## 解决方案

已创建简化的`vercel.json`配置文件,使用Expo官方推荐的部署方式。

## 部署步骤

### 1. 在本地拉取最新代码

```bash
cd /path/to/quant-trading-hub
git pull origin main
```

### 2. 推送配置文件到GitHub

```bash
git add vercel.json .vercelignore VERCEL_SETUP.md
git commit -m "fix: 简化Vercel部署配置"
git push origin main
```

### 3. 在Vercel重新部署

方式A: 自动部署(推荐)
- Vercel会自动检测到GitHub的新提交并触发部署

方式B: 手动触发
1. 访问: https://vercel.com/dashboard
2. 进入`quant-trading-hub`项目
3. 点击"Deployments"标签
4. 点击最新部署右侧的"..."菜单
5. 选择"Redeploy"

### 4. 检查部署日志

如果仍然有问题,请查看构建日志:
1. 在Vercel项目页面点击最新的部署
2. 查看"Building"部分的日志
3. 确认`npx expo export --platform web`命令成功执行
4. 确认输出目录`dist`包含`index.html`文件

## 配置说明

### vercel.json
```json
{
  "buildCommand": "npx expo export --platform web",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": null,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

- `buildCommand`: 使用Expo CLI导出Web版本
- `outputDirectory`: Expo Web的默认输出目录
- `rewrites`: SPA路由重写,所有路径都指向index.html

### .vercelignore
忽略不需要上传到Vercel的文件:
- `server/`: 后端代码(Vercel只部署前端)
- `drizzle/`: 数据库配置
- `node_modules/`: 依赖包

## 注意事项

1. **API连接**: 由于Vercel只部署前端,API请求需要指向独立的后端服务器
2. **环境变量**: 在Vercel项目设置中配置`EXPO_PUBLIC_API_URL`
3. **数据库**: 确保数据库可以从外网访问

## 备选方案

如果Vercel部署仍有问题,建议使用支持全栈应用的平台:
- Railway: https://railway.app
- Render: https://render.com
- Fly.io: https://fly.io

这些平台对Node.js全栈应用支持更好。
