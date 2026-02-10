# 使用Node.js 22作为基础镜像
FROM node:22-alpine AS base

# 安装pnpm
RUN npm install -g pnpm@9.12.0

# 设置工作目录
WORKDIR /app

# 复制package.json和pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制所有源代码
COPY . .

# 构建后端API服务器
RUN pnpm build

# 构建Expo Web应用
RUN pnpm expo export --platform web

# 暴露端口
EXPOSE 3000 8081

# 启动命令:同时运行API服务器和Web服务器
CMD ["pnpm", "start:web"]
