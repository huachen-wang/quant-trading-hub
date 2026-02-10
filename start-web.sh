#!/bin/sh
set -e

# 启动API服务器(后台运行)
echo "Starting API server..."
NODE_ENV=production node dist/index.js &
API_PID=$!

# 等待API服务器启动
sleep 3

# 启动Web服务器(前台运行)
echo "Starting Web server..."
npx serve dist -l ${PORT:-8081} --single

# 清理
kill $API_PID 2>/dev/null || true
