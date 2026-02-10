# 使用Node.js 22作为基础镜像
FROM node:22-alpine AS base

# 安装pnpm
RUN npm install -g pnpm@9.12.0

# 设置工作目录
WORKDIR /app

# 复制package.json和pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖(包括devDependencies,因为构建需要)
RUN pnpm install --no-frozen-lockfile

# 复制所有源代码
COPY . .

# 构建后端API服务器到dist目录
RUN pnpm build

# 构建Web应用到web-build目录
RUN npx expo export --platform web --output-dir web-build

# 清理devDependencies以减小镜像大小(可选)
# RUN pnpm prune --prod

# 暴露端口(Railway会自动使用PORT环境变量)
EXPOSE 8080

# 启动命令 - 启动API服务器(同时提供静态文件服务)
CMD ["node", "dist/index.js"]
