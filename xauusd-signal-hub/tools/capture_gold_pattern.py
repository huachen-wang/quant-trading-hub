"""
mitmproxy 脚本 - 自动捕获黄金形态通App的API请求
============================================

使用方法:
  1. 安装 mitmproxy: pip install mitmproxy
  2. 运行: mitmdump -s capture_gold_pattern.py
  3. iPhone 设置代理指向电脑IP:8080
  4. 安装证书: 在iPhone Safari访问 mitm.it
  5. 打开黄金形态通App，操作各功能
  6. 查看 ~/gold_pattern_captures/ 目录下的捕获文件
"""
import json
import os
from datetime import datetime
from mitmproxy import http

# 输出目录
OUTPUT_DIR = os.path.expanduser("~/gold_pattern_captures")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# App相关关键词
APP_KEYWORDS = ["gold", "pattern", "meihua", "xauusd", "signal", "trade"]

# 统计
capture_count = 0

def response(flow: http.HTTPFlow):
    """捕获响应"""
    global capture_count
    
    url = flow.request.pretty_url
    ua = flow.request.headers.get("User-Agent", "").lower()
    content_type = flow.response.headers.get("Content-Type", "").lower()
    
    # 过滤条件：App请求 或 JSON响应
    is_relevant = (
        any(kw in ua for kw in APP_KEYWORDS) or
        any(kw in url.lower() for kw in APP_KEYWORDS) or
        ("application/json" in content_type and "apple" not in url.lower() and "google" not in url.lower())
    )
    
    if not is_relevant:
        return
    
    # 跳过静态资源
    skip_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.css', '.js', '.ico', '.svg', '.woff']
    if any(url.lower().endswith(ext) for ext in skip_extensions):
        return
    
    capture_count += 1
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{OUTPUT_DIR}/{capture_count:04d}_{timestamp}.json"
    
    # 尝试解析响应体
    response_body = flow.response.get_text() or ""
    try:
        response_json = json.loads(response_body)
    except (json.JSONDecodeError, ValueError):
        response_json = None
    
    # 尝试解析请求体
    request_body = flow.request.get_text() or ""
    try:
        request_json = json.loads(request_body)
    except (json.JSONDecodeError, ValueError):
        request_json = None
    
    capture = {
        "capture_id": capture_count,
        "timestamp": datetime.now().isoformat(),
        "request": {
            "method": flow.request.method,
            "url": url,
            "host": flow.request.host,
            "path": flow.request.path,
            "headers": dict(flow.request.headers),
            "body_raw": request_body[:2000],
            "body_json": request_json,
        },
        "response": {
            "status_code": flow.response.status_code,
            "headers": dict(flow.response.headers),
            "body_raw": response_body[:5000],
            "body_json": response_json,
        }
    }
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(capture, f, ensure_ascii=False, indent=2)
    
    # 打印摘要
    print(f"\n[#{capture_count}] {flow.request.method} {url}")
    print(f"  Status: {flow.response.status_code} | Content-Type: {content_type}")
    if response_json:
        keys = list(response_json.keys())[:5] if isinstance(response_json, dict) else f"[array: {len(response_json)} items]"
        print(f"  JSON Keys: {keys}")
    print(f"  Saved: {filename}")
