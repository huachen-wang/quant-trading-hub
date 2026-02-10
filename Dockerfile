# 使用Node.js 22作为基础镜像
FROM node:22-alpine AS base

# 安装必要的系统依赖
RUN apk add --no-cache git python3 make g++

# 安装pnpm
RUN npm install -g pnpm@9.12.0

# 设置工作目录
WORKDIR /app

# 复制package.json和pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖(包括devDependencies,因为需要esbuild构建API服务器)
RUN pnpm install --no-frozen-lockfile

# 复制所有源代码
COPY . .

# 构建后端API服务器到dist目录
RUN echo "Building API server..." && pnpm build

# 检查web-build目录是否存在(应该已经在本地构建好并复制进来)
RUN if [ ! -d "web-build" ] || [ ! -f "web-build/index.html" ]; then \
      echo "ERROR: web-build directory not found or incomplete!"; \
      echo "Please ensure web-build is committed to Git"; \
      exit 1; \
    fi

# 验证构建结果
RUN echo "Verifying build output..." && \
    ls -la dist/ && \
    ls -la web-build/ && \
    echo "Build verification complete!"

# 清理devDependencies以减小镜像大小
RUN pnpm prune --prod

# 暴露端口(Railway会自动使用PORT环境变量)
EXPOSE 8080

# 启动命令 - 启动API服务器(同时提供静态文件服务)
CMD ["node", "dist/index.js"]
