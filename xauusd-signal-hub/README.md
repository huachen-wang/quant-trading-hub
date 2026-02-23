# XAUUSD Signal Hub - 黄金信号聚合社区

> 多源信号爬取 → AI智能改编 → 自动发布到你的社区

一个完整的XAUUSD（黄金/美元）交易信号聚合系统，能够从多个信号源自动爬取交易信号，通过AI改编为独特内容，并自动发布到你的Telegram频道/社区。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    XAUUSD Signal Hub                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Telegram     │  │  DailyForex  │  │  Investing   │      │
│  │  信号频道     │  │  网站信号    │  │  技术分析    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌──────┴───────┐      │
│  │ 黄金形态通   │  │ ForexFactory │  │  TradingView │      │
│  │ App API     │  │  论坛信号    │  │  社区信号    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌─────────────────────────────────────────────────┐        │
│  │              信号解析器 (Signal Parser)           │        │
│  │  - 正则表达式提取价格/方向/止盈止损               │        │
│  │  - 统一数据模型 (TradingSignal)                   │        │
│  └─────────────────────┬───────────────────────────┘        │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────┐        │
│  │              SQLite 数据库                        │        │
│  │  - 信号存储与去重                                 │        │
│  │  - 爬取日志记录                                   │        │
│  │  - 发布状态追踪                                   │        │
│  └─────────────────────┬───────────────────────────┘        │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────┐        │
│  │           AI 信号改编器 (Signal Rewriter)         │        │
│  │  - GPT-4.1-mini 智能改写                          │        │
│  │  - 多种风格模板 (专业/休闲/中文/VIP)              │        │
│  │  - 自动添加技术分析理由                           │        │
│  └─────────────────────┬───────────────────────────┘        │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────────┐        │
│  │           多平台发布器 (Publisher)                 │        │
│  │  - Telegram Bot / 客户端发布                      │        │
│  │  - 微信群格式 / Discord格式                       │        │
│  │  - Twitter/X 简短格式                             │        │
│  │  - 随机延迟防识别                                 │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/huachen-wang/quant-trading-hub.git
cd quant-trading-hub/xauusd-signal-hub
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的配置
```

### 4. 运行

```bash
# 爬取网站信号（无需任何配置即可使用）
python main.py crawl-web

# 查看统计
python main.py stats

# 改编信号内容
python main.py rewrite --style premium --limit 5

# 生成每日报告
python main.py report
```

## 信号来源

| 来源 | 类型 | 爬取难度 | 信号质量 | 配置要求 |
|------|------|---------|---------|---------|
| Telegram 信号频道 | 实时消息 | ⭐⭐ | ⭐⭐⭐⭐⭐ | 需要 API ID/Hash |
| DailyForex.com | 网页爬取 | ⭐ | ⭐⭐⭐⭐ | 无需配置 |
| Investing.com | 网页爬取 | ⭐ | ⭐⭐⭐ | 无需配置 |
| 黄金形态通 App | API逆向 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 需要抓包 |
| ForexFactory | 论坛爬取 | ⭐⭐ | ⭐⭐⭐ | 无需配置 |
| TradingView | API/社区 | ⭐⭐⭐ | ⭐⭐⭐⭐ | 可选配置 |

## 命令参考

```bash
# === 爬取命令 ===
python main.py crawl-web                    # 爬取网站信号
python main.py crawl-web --periodic         # 定期爬取网站
python main.py crawl-telegram               # 爬取Telegram（单次）
python main.py crawl-telegram --realtime    # Telegram实时监控
python main.py crawl-telegram --periodic    # Telegram定期爬取
python main.py crawl-app --guide            # 查看App抓包指南
python main.py crawl-all                    # 爬取所有信号源

# === 内容改编 ===
python main.py rewrite --style professional  # 专业风格改编
python main.py rewrite --style premium       # VIP高端风格
python main.py rewrite --style chinese       # 中文社区风格
python main.py rewrite --style casual        # 轻松易懂风格

# === 发布命令 ===
python main.py publish --preview            # 预览待发布信号
python main.py publish --auto               # 自动发布模式

# === 报告与统计 ===
python main.py report                       # 生成每日报告
python main.py stats                        # 查看统计信息

# === 守护进程 ===
python main.py daemon                       # 启动全自动模式
python main.py daemon --auto-publish        # 全自动+自动发布
```

## 配置 Telegram 爬虫

### 获取 API 凭证

1. 访问 https://my.telegram.org
2. 登录你的 Telegram 账号
3. 点击 "API development tools"
4. 创建应用，获取 `api_id` 和 `api_hash`
5. 填入 `.env` 文件

### 创建发布 Bot

1. 在 Telegram 中找到 @BotFather
2. 发送 `/newbot` 创建新 Bot
3. 获取 Bot Token
4. 将 Bot 添加为你频道的管理员
5. 填入 `.env` 文件

### 监控的信号频道

默认监控以下公开频道（可在 `config/settings.py` 中修改）：

- `XAUUSDGOLDsignals` - 主要XAUUSD信号频道
- `GoldSignalsFree` - 免费黄金信号
- `gold_trading_signals` - 黄金交易信号
- `xauusd_signals_free` - XAUUSD免费信号
- `AltmashfxSingnals1` - Altmash FX 信号
- `The_Eagle_Gold_Club` - Eagle Gold Club
- `XAUUSDTPSIGNALS` - XAUUSD TP信号

## 黄金形态通 App 抓包指南

由于该App仅支持iOS，需要通过中间人代理抓包获取API接口：

```bash
# 查看详细抓包指南
python main.py crawl-app --guide
```

支持的抓包工具：
- **Charles Proxy**（推荐，Mac用户）
- **mitmproxy**（跨平台，命令行）
- **Frida**（绕过SSL Pinning）

项目内置了 mitmproxy 自动捕获脚本：
```bash
mitmdump -s tools/capture_gold_pattern.py
```

## 项目结构

```
xauusd-signal-hub/
├── main.py                     # 主程序入口（CLI）
├── config/
│   ├── settings.py             # 全局配置
│   └── __init__.py
├── crawlers/
│   ├── telegram_crawler.py     # Telegram 信号爬虫
│   ├── website_crawler.py      # 网站信号爬虫
│   ├── app_crawler.py          # 黄金形态通 App 爬虫
│   └── __init__.py
├── parsers/
│   ├── signal_parser.py        # 信号文本解析器
│   └── __init__.py
├── community/
│   ├── signal_rewriter.py      # AI 信号改编器
│   ├── publisher.py            # 多平台发布器
│   └── __init__.py
├── utils/
│   ├── models.py               # 数据模型
│   ├── database.py             # 数据库管理
│   └── __init__.py
├── tools/
│   └── capture_gold_pattern.py # mitmproxy 抓包脚本
├── data/                       # 数据目录（自动创建）
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## 免责声明

本项目仅供学习和研究目的。交易信号不构成投资建议，使用者需自行承担交易风险。请遵守相关法律法规和平台服务条款。
