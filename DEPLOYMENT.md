# 部署指南

本文档介绍如何将EA策略平台部署到生产环境并配置自定义域名。

## 方式一: 使用Vercel部署(推荐)

Vercel是最简单快速的部署方式,免费且支持自动HTTPS。

### 步骤:

1. **注册Vercel账号**
   - 访问 https://vercel.com
   - 使用GitHub账号登录

2. **导入项目**
   - 点击"New Project"
   - 选择您的GitHub仓库 `quant-trading-hub`
   - 点击"Import"

3. **配置构建设置**
   ```
   Framework Preset: Other
   Build Command: pnpm build
   Output Directory: dist
   Install Command: pnpm install
   ```

4. **配置环境变量**
   在Vercel项目设置中添加:
   ```
   DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
   JWT_SECRET=replace-with-a-long-random-secret
   COOKIE_SECRET=replace-with-a-long-random-secret
   DOWNLOAD_SIGNING_SECRET=replace-with-a-long-random-secret
   NODE_ENV=production
   ```

5. **部署**
   - 点击"Deploy"
   - 等待构建完成(约2-3分钟)
   - 获得临时域名: `your-project.vercel.app`

6. **配置自定义域名**
   - 在Vercel项目设置中点击"Domains"
   - 添加您的域名(如 `ea.yourdomain.com`)
   - 按照提示在域名DNS设置中添加CNAME记录:
     ```
     类型: CNAME
     名称: ea (或@用于根域名)
     值: cname.vercel-dns.com
     ```
   - 等待DNS生效(通常5-30分钟)
   - Vercel会自动配置SSL证书

## 方式二: 使用Netlify部署

### 步骤:

1. **注册Netlify账号**
   - 访问 https://netlify.com
   - 使用GitHub账号登录

2. **导入项目**
   - 点击"Add new site" → "Import an existing project"
   - 选择GitHub仓库

3. **配置构建设置**
   ```
   Build command: pnpm build
   Publish directory: dist
   ```

4. **配置环境变量**
   在Site settings → Environment variables中添加相同的环境变量

5. **配置自定义域名**
   - 在Site settings → Domain management中添加域名
   - 按照提示配置DNS

## 方式三: 自建服务器部署

### 前提条件:
- 一台Linux服务器(Ubuntu 20.04+推荐)
- Node.js 22+
- Nginx

### 步骤:

1. **安装依赖**
   ```bash
   # 安装Node.js
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # 安装pnpm
   npm install -g pnpm
   
   # 安装Nginx
   sudo apt-get install nginx
   ```

2. **克隆项目**
   ```bash
   cd /var/www
   git clone git@github.com:huachen-wang/quant-trading-hub.git
   cd quant-trading-hub
   ```

3. **安装依赖并构建**
   ```bash
   pnpm install
   pnpm build
   ```

4. **配置环境变量**
   ```bash
   cp .env.example .env
   nano .env
   # 填入数据库连接和JWT密钥
   ```

5. **使用PM2运行**
   ```bash
   npm install -g pm2
   pm2 start npm --name "ea-platform" -- start
   pm2 save
   pm2 startup
   ```

6. **配置Nginx反向代理**
   ```bash
   sudo nano /etc/nginx/sites-available/ea-platform
   ```
   
   添加配置:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   
   启用站点:
   ```bash
   sudo ln -s /etc/nginx/sites-available/ea-platform /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

7. **配置SSL证书(Let's Encrypt)**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## 域名DNS配置

无论使用哪种部署方式,都需要在域名注册商处配置DNS:

### A记录(自建服务器)
```
类型: A
名称: @ 或 ea
值: 您的服务器IP地址
TTL: 600
```

### CNAME记录(Vercel/Netlify)
```
类型: CNAME
名称: @ 或 ea
值: your-project.vercel.app (或netlify域名)
TTL: 600
```

## 验证部署

部署完成后,访问您的域名检查:

1. ✅ 页面正常加载
2. ✅ 策略列表显示
3. ✅ 登录功能正常
4. ✅ HTTPS证书有效
5. ✅ 移动端和桌面端显示正常

## 常见问题

### Q: 部署后数据库连接失败?
A: 检查数据库URL是否正确,确保生产环境的数据库允许外部连接。

### Q: 环境变量不生效?
A: 确保在部署平台的环境变量设置中正确配置,并重新部署。

### Q: 域名无法访问?
A: 检查DNS是否生效(使用 `nslookup your-domain.com`),通常需要5-30分钟。

### Q: HTTPS证书错误?
A: Vercel/Netlify会自动配置SSL。自建服务器需要手动运行certbot。

## 性能优化建议

1. **启用CDN**: 使用Cloudflare等CDN加速静态资源
2. **图片优化**: 压缩策略封面图,使用WebP格式
3. **缓存配置**: 配置浏览器缓存和服务端缓存
4. **数据库优化**: 添加索引,使用连接池

## 监控和维护

1. **错误监控**: 集成Sentry等错误追踪服务
2. **性能监控**: 使用Google Analytics或Plausible
3. **日志管理**: 定期检查服务器日志
4. **备份**: 定期备份数据库

---

**需要帮助?** 
如有部署问题,请联系技术支持或查看项目文档。
