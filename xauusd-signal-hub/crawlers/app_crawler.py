"""
XAUUSD Signal Hub - 黄金形态通 App API 逆向爬虫
通过抓包获取的API接口爬取App信号数据

=== 使用前必读 ===
此模块需要先通过抓包工具（Charles/mitmproxy）获取App的API接口信息。
以下是抓包步骤和API逆向指南。
"""
import logging
import json
import time
from datetime import datetime
from typing import Optional, Dict, List

import requests

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import GOLD_PATTERN_API_BASE, GOLD_PATTERN_API_KEY, DEFAULT_HEADERS
from utils.models import TradingSignal, SignalDirection, SignalSource
from utils.database import SignalDatabase

logger = logging.getLogger(__name__)


# ============================================================
# 抓包指南
# ============================================================
CAPTURE_GUIDE = """
╔══════════════════════════════════════════════════════════════╗
║         黄金形态通 App API 抓包指南                           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  方法一：Charles Proxy（推荐，Mac用户）                       ║
║  ──────────────────────────────────────                      ║
║  1. 下载安装 Charles Proxy (https://www.charlesproxy.com)    ║
║  2. 安装 Charles 根证书到 iPhone:                             ║
║     - Charles → Help → SSL Proxying → Install on Mobile     ║
║     - iPhone 设置 → 通用 → 关于 → 证书信任设置 → 启用        ║
║  3. iPhone 连接同一WiFi，设置HTTP代理指向电脑IP:8888         ║
║  4. Charles → Proxy → SSL Proxying Settings → 添加 *:443    ║
║  5. 打开黄金形态通App，操作各个功能                           ║
║  6. 在 Charles 中查看捕获的 HTTPS 请求                       ║
║  7. 重点关注:                                                 ║
║     - 域名/IP（API服务器地址）                                ║
║     - 请求路径（如 /api/v1/signals）                          ║
║     - 请求头（Authorization, API Key等）                      ║
║     - 请求/响应体（JSON数据结构）                             ║
║                                                              ║
║  方法二：mitmproxy（跨平台，命令行）                          ║
║  ──────────────────────────────────────                      ║
║  1. pip install mitmproxy                                    ║
║  2. 运行: mitmweb --listen-port 8080                         ║
║  3. iPhone 设置代理指向电脑IP:8080                            ║
║  4. 安装证书: 访问 mitm.it                                   ║
║  5. 在 mitmweb 界面查看请求                                  ║
║                                                              ║
║  方法三：Frida（绕过SSL Pinning）                             ║
║  ──────────────────────────────────────                      ║
║  如果App使用了SSL Pinning（证书锁定），需要:                  ║
║  1. iPhone需要越狱                                            ║
║  2. 安装 Frida: pip install frida-tools                      ║
║  3. 使用SSL Pinning绕过脚本:                                 ║
║     frida -U -f com.meihua.gold -l ssl_bypass.js             ║
║                                                              ║
║  抓到API后，更新以下环境变量:                                 ║
║  - GOLD_PATTERN_API_BASE: API基础URL                         ║
║  - GOLD_PATTERN_API_KEY: API密钥（如果有）                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"""


class GoldPatternAppCrawler:
    """黄金形态通 App API 爬虫"""
    
    def __init__(self, api_base: str = None, api_key: str = None):
        self.api_base = api_base or GOLD_PATTERN_API_BASE
        self.api_key = api_key or GOLD_PATTERN_API_KEY
        self.session = requests.Session()
        self.db = SignalDatabase()
        
        # 模拟App的请求头
        self.app_headers = {
            "User-Agent": "GoldPattern/1.1.5 (iPhone; iOS 17.6; Scale/3.00)",
            "Accept": "application/json",
            "Accept-Language": "zh-Hans-CN;q=1",
            "Accept-Encoding": "gzip, deflate, br",
        }
        
        if self.api_key:
            self.app_headers["Authorization"] = f"Bearer {self.api_key}"
    
    @property
    def is_configured(self) -> bool:
        """检查是否已配置API信息"""
        return bool(self.api_base)
    
    def print_capture_guide(self):
        """打印抓包指南"""
        print(CAPTURE_GUIDE)
    
    def crawl_signals(self) -> List[TradingSignal]:
        """爬取App信号数据"""
        if not self.is_configured:
            logger.warning(
                "黄金形态通API未配置。请先通过抓包获取API信息。"
                "运行 print_capture_guide() 查看抓包指南。"
            )
            return []
        
        signals = []
        
        try:
            # === 以下API路径需要通过抓包确认 ===
            # 这些是基于App功能推测的可能接口
            
            endpoints = [
                "/api/v1/signals/latest",      # 最新信号
                "/api/v1/analysis/trend",       # 趋势分析
                "/api/v1/patterns/active",      # 活跃形态
                "/api/v1/indicators/summary",   # 指标汇总
            ]
            
            for endpoint in endpoints:
                try:
                    url = f"{self.api_base}{endpoint}"
                    resp = self.session.get(
                        url, 
                        headers=self.app_headers,
                        timeout=15
                    )
                    
                    if resp.status_code == 200:
                        data = resp.json()
                        parsed_signals = self._parse_api_response(data, endpoint)
                        signals.extend(parsed_signals)
                    else:
                        logger.warning(f"API {endpoint} 返回 {resp.status_code}")
                        
                except Exception as e:
                    logger.error(f"请求 {endpoint} 失败: {e}")
                
                time.sleep(1)
            
            self.db.log_crawl(
                source="GOLD_PATTERN_APP",
                channel="gold_pattern_pro",
                status="SUCCESS",
                signal_count=len(signals)
            )
            
        except Exception as e:
            logger.error(f"黄金形态通爬取失败: {e}")
            self.db.log_crawl(
                source="GOLD_PATTERN_APP",
                channel="gold_pattern_pro",
                status="ERROR",
                error=str(e)
            )
        
        return signals
    
    def _parse_api_response(self, data: dict, endpoint: str) -> List[TradingSignal]:
        """解析API响应数据"""
        signals = []
        
        # 根据不同端点解析数据
        # 注意：实际字段名需要通过抓包确认
        
        if 'signals' in data:
            for item in data['signals']:
                signal = self._parse_signal_item(item)
                if signal:
                    signals.append(signal)
        
        elif 'data' in data:
            items = data['data'] if isinstance(data['data'], list) else [data['data']]
            for item in items:
                signal = self._parse_signal_item(item)
                if signal:
                    signals.append(signal)
        
        elif 'trend' in data or 'direction' in data:
            signal = self._parse_signal_item(data)
            if signal:
                signals.append(signal)
        
        return signals
    
    def _parse_signal_item(self, item: dict) -> Optional[TradingSignal]:
        """解析单个信号数据项"""
        try:
            # 推测的字段映射（需要通过抓包确认实际字段名）
            direction_str = (
                item.get('direction') or 
                item.get('signal') or 
                item.get('action') or 
                item.get('type', '')
            ).upper()
            
            if 'BUY' in direction_str or 'LONG' in direction_str or '多' in direction_str:
                direction = SignalDirection.BUY
            elif 'SELL' in direction_str or 'SHORT' in direction_str or '空' in direction_str:
                direction = SignalDirection.SELL
            else:
                return None
            
            signal = TradingSignal(
                pair="XAUUSD",
                direction=direction,
                entry_price=self._safe_float(item.get('entry') or item.get('price') or item.get('entry_price')),
                take_profit_1=self._safe_float(item.get('tp1') or item.get('take_profit_1') or item.get('target')),
                take_profit_2=self._safe_float(item.get('tp2') or item.get('take_profit_2')),
                take_profit_3=self._safe_float(item.get('tp3') or item.get('take_profit_3')),
                stop_loss=self._safe_float(item.get('sl') or item.get('stop_loss')),
                confidence=self._safe_float(item.get('confidence') or item.get('win_rate') or item.get('probability')),
                timeframe=item.get('timeframe', ''),
                analysis_summary=item.get('analysis', '') or item.get('description', ''),
                source=SignalSource.GOLD_PATTERN_APP,
                source_channel="gold_pattern_pro",
                source_message_id=str(item.get('id', '') or item.get('signal_id', '')),
                original_text=json.dumps(item, ensure_ascii=False),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            
            # RSI等指标
            if 'rsi' in item:
                signal.rsi_value = self._safe_float(item['rsi'])
            
            return signal
            
        except Exception as e:
            logger.error(f"解析信号数据失败: {e}")
            return None
    
    @staticmethod
    def _safe_float(value) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None


# ============================================================
# mitmproxy 自动抓包脚本（保存为 capture_gold_pattern.py）
# 使用方法: mitmdump -s capture_gold_pattern.py
# ============================================================
MITMPROXY_SCRIPT = '''
"""
mitmproxy 脚本 - 自动捕获黄金形态通App的API请求
使用方法: mitmdump -s capture_gold_pattern.py
"""
import json
import os
from datetime import datetime
from mitmproxy import http

# 输出目录
OUTPUT_DIR = os.path.expanduser("~/gold_pattern_captures")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 已知的App Bundle ID关键词
APP_KEYWORDS = ["gold", "pattern", "meihua", "xauusd"]

def response(flow: http.HTTPFlow):
    """捕获响应"""
    url = flow.request.pretty_url
    
    # 过滤：只关注可能是App请求的流量
    # 可以通过User-Agent或域名过滤
    ua = flow.request.headers.get("User-Agent", "").lower()
    
    is_app_request = (
        any(kw in ua for kw in APP_KEYWORDS) or
        any(kw in url.lower() for kw in APP_KEYWORDS) or
        "application/json" in flow.response.headers.get("Content-Type", "")
    )
    
    if not is_app_request:
        return
    
    # 记录请求和响应
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{OUTPUT_DIR}/{timestamp}.json"
    
    capture = {
        "timestamp": datetime.now().isoformat(),
        "request": {
            "method": flow.request.method,
            "url": url,
            "headers": dict(flow.request.headers),
            "body": flow.request.get_text() or "",
        },
        "response": {
            "status_code": flow.response.status_code,
            "headers": dict(flow.response.headers),
            "body": flow.response.get_text() or "",
        }
    }
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(capture, f, ensure_ascii=False, indent=2)
    
    print(f"[CAPTURED] {flow.request.method} {url} -> {flow.response.status_code}")
'''


def save_mitmproxy_script():
    """保存mitmproxy抓包脚本"""
    script_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "tools", "capture_gold_pattern.py"
    )
    os.makedirs(os.path.dirname(script_path), exist_ok=True)
    
    with open(script_path, 'w') as f:
        f.write(MITMPROXY_SCRIPT)
    
    logger.info(f"mitmproxy 抓包脚本已保存到: {script_path}")
    return script_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    crawler = GoldPatternAppCrawler()
    
    if not crawler.is_configured:
        crawler.print_capture_guide()
        print("\n正在保存mitmproxy抓包脚本...")
        save_mitmproxy_script()
    else:
        signals = crawler.crawl_signals()
        print(f"获取到 {len(signals)} 条信号")
