#!/bin/bash
set -e

echo "[Deploy] Starting Railway deployment..."

# 1. 安装依赖
echo "[Deploy] Installing dependencies..."
pnpm install --frozen-lockfile

# 2. 构建API服务器
echo "[Deploy] Building API server..."
pnpm build

# 3. 启动服务
echo "[Deploy] Starting server..."
NODE_ENV=production node dist/index.js
