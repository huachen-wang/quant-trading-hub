"""
XAUUSD Signal Hub - 全局配置
"""
import os
from pathlib import Path

# ============================================================
# 项目路径
# ============================================================
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# ============================================================
# Telegram 配置
# ============================================================
TELEGRAM_API_ID = os.getenv("TELEGRAM_API_ID", "")
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH", "")
TELEGRAM_SESSION_NAME = os.getenv("TELEGRAM_SESSION_NAME", "signal_bot")

# 要监控的 Telegram 信号频道列表
TELEGRAM_SIGNAL_CHANNELS = [
    "XAUUSDGOLDsignals",          # 主要XAUUSD信号频道
    "GoldSignalsFree",             # 免费黄金信号
    "gold_trading_signals",        # 黄金交易信号
    "xauusd_signals_free",         # XAUUSD免费信号
    "AltmashfxSingnals1",          # Altmash FX 信号
    "The_Eagle_Gold_Club",         # Eagle Gold Club
    "XAUUSDTPSIGNALS",             # XAUUSD TP信号
]

# ============================================================
# Telegram Bot 配置（用于发布信号到你自己的社区）
# ============================================================
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_COMMUNITY_CHANNEL = os.getenv("TELEGRAM_COMMUNITY_CHANNEL", "")

# ============================================================
# 网站爬虫配置
# ============================================================
DAILYFOREX_URL = "https://www.dailyforex.com/forex-technical-analysis/free-forex-signals/page-1"
INVESTING_COM_URL = "https://www.investing.com/currencies/xau-usd-technical"
FOREXFACTORY_URL = "https://www.forexfactory.com/thread/1367784-free-hourly-gold-xauusd-signals-powered-by-aiml"

# 请求头伪装
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# ============================================================
# 黄金形态通 App API 配置（需要通过抓包获取）
# ============================================================
GOLD_PATTERN_API_BASE = os.getenv("GOLD_PATTERN_API_BASE", "")
GOLD_PATTERN_API_KEY = os.getenv("GOLD_PATTERN_API_KEY", "")

# ============================================================
# 信号改编配置
# ============================================================
# OpenAI API 用于信号内容改编
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# 信号改编风格
SIGNAL_REWRITE_STYLES = {
    "professional": "专业分析师风格，使用技术分析术语",
    "casual": "轻松易懂风格，适合新手",
    "chinese": "中文专业风格，适合中文社区",
    "premium": "高端VIP风格，强调独家分析",
}

# ============================================================
# 定时任务配置
# ============================================================
# Telegram 爬取间隔（秒）
TELEGRAM_CRAWL_INTERVAL = 60

# 网站爬取间隔（秒）
WEBSITE_CRAWL_INTERVAL = 300

# 信号发布延迟（秒）- 避免被识别为搬运
SIGNAL_PUBLISH_DELAY_MIN = 120
SIGNAL_PUBLISH_DELAY_MAX = 600

# ============================================================
# 数据库配置
# ============================================================
DATABASE_PATH = DATA_DIR / "signals.db"

# ============================================================
# 日志配置
# ============================================================
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = DATA_DIR / "signal_hub.log"
