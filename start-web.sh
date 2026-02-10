#!/bin/sh
set -e

# 启动API服务#!/bin/sh

# 启动API服务器(同时提供静态文件服务)
echo "Starting server..."
node dist/index.js
