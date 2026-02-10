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

# 安装所有依赖(包括devDependencies,因为构建需要)
# 使用--no-frozen-lockfile确保依赖完整安装
RUN pnpm install --no-frozen-lockfile

# 复制所有源代码
COPY . .

# 验证关键依赖是否存在
RUN echo "Verifying dependencies..." && \
    ls -la node_modules/react-native-css-interop/ || echo "Warning: react-native-css-interop not found" && \
    ls -la node_modules/nativewind/ || echo "Warning: nativewind not found"

# 构建后端API服务器到dist目录
RUN echo "Building API server..." && pnpm build

# 构建Web应用到web-build目录
RUN echo "Building Web application..." && \
    npx expo export --platform web --output-dir web-build

# 验证构建结果
RUN echo "Verifying build output..." && \
    ls -la dist/ && \
    ls -la web-build/ && \
    test -f web-build/index.html || (echo "ERROR: web-build/index.html not found" && exit 1)

# 暴露端口(Railway会自动使用PORT环境变量)
EXPOSE 8080

# 启动命令 - 启动API服务器(同时提供静态文件服务)
CMD ["node", "dist/index.js"]
