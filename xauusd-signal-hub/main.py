#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║           XAUUSD Signal Hub - 黄金信号聚合社区               ║
║                                                              ║
║  功能:                                                       ║
║  1. 多源信号爬取 (Telegram/网站/App)                         ║
║  2. AI智能改编信号内容                                       ║
║  3. 自动发布到你的社区频道                                   ║
║  4. 定时任务调度                                             ║
╚══════════════════════════════════════════════════════════════╝
"""
import asyncio
import argparse
import logging
import sys
import os
import json
import signal as sig
from datetime import datetime
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import (
    LOG_LEVEL, LOG_FILE, DATA_DIR,
    TELEGRAM_CRAWL_INTERVAL, WEBSITE_CRAWL_INTERVAL,
)
from utils.database import SignalDatabase
from crawlers.website_crawler import WebsiteCrawlerManager
from community.signal_rewriter import SignalRewriter
from community.publisher import SignalPublisher, MultiPlatformPublisher


def setup_logging(level: str = None):
    """配置日志"""
    log_level = getattr(logging, (level or LOG_LEVEL).upper(), logging.INFO)
    
    formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 控制台输出
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    
    # 文件输出
    file_handler = logging.FileHandler(str(LOG_FILE), encoding='utf-8')
    file_handler.setFormatter(formatter)
    
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)


logger = logging.getLogger(__name__)


# ============================================================
# 命令: crawl-telegram
# ============================================================
async def cmd_crawl_telegram(args):
    """爬取 Telegram 信号频道"""
    from crawlers.telegram_crawler import TelegramSignalCrawler
    
    crawler = TelegramSignalCrawler()
    
    try:
        await crawler.start()
        
        if args.realtime:
            logger.info("启动实时监控模式...")
            await crawler.start_realtime_monitor()
        elif args.periodic:
            logger.info(f"启动定期爬取模式 (间隔: {args.interval}s)...")
            await crawler.run_periodic_crawl(
                interval=args.interval,
                limit_per_channel=args.limit
            )
        else:
            logger.info("执行单次爬取...")
            signals = await crawler.crawl_all_channels(
                limit_per_channel=args.limit
            )
            print(f"\n共获取 {len(signals)} 条新信号")
            for s in signals:
                print(s.format_signal_card())
    finally:
        await crawler.stop()


# ============================================================
# 命令: crawl-web
# ============================================================
def cmd_crawl_web(args):
    """爬取网站信号"""
    manager = WebsiteCrawlerManager()
    
    if args.periodic:
        logger.info(f"启动网站定期爬取 (间隔: {args.interval}s)...")
        manager.run_periodic(interval=args.interval)
    else:
        logger.info("执行单次网站爬取...")
        results = manager.crawl_all()
        print(json.dumps(results, indent=2, ensure_ascii=False, default=str))


# ============================================================
# 命令: crawl-app
# ============================================================
def cmd_crawl_app(args):
    """爬取黄金形态通App"""
    from crawlers.app_crawler import GoldPatternAppCrawler, save_mitmproxy_script
    
    crawler = GoldPatternAppCrawler()
    
    if args.guide:
        crawler.print_capture_guide()
        save_mitmproxy_script()
        return
    
    if not crawler.is_configured:
        print("⚠️ 黄金形态通API未配置。")
        print("请先运行: python main.py crawl-app --guide")
        return
    
    signals = crawler.crawl_signals()
    print(f"获取到 {len(signals)} 条信号")


# ============================================================
# 命令: crawl-all
# ============================================================
async def cmd_crawl_all(args):
    """爬取所有信号源"""
    logger.info("开始全源爬取...")
    
    # 1. 网站爬取
    logger.info("--- 网站信号爬取 ---")
    web_manager = WebsiteCrawlerManager()
    web_results = web_manager.crawl_all()
    
    # 2. Telegram 爬取（如果配置了）
    telegram_signals = []
    try:
        from crawlers.telegram_crawler import TelegramSignalCrawler
        crawler = TelegramSignalCrawler()
        await crawler.start()
        telegram_signals = await crawler.crawl_all_channels(
            limit_per_channel=args.limit
        )
        await crawler.stop()
        logger.info(f"Telegram: {len(telegram_signals)} 条信号")
    except Exception as e:
        logger.warning(f"Telegram 爬取跳过: {e}")
    
    # 3. App 爬取（如果配置了）
    try:
        from crawlers.app_crawler import GoldPatternAppCrawler
        app_crawler = GoldPatternAppCrawler()
        if app_crawler.is_configured:
            app_signals = app_crawler.crawl_signals()
            logger.info(f"App: {len(app_signals)} 条信号")
    except Exception as e:
        logger.warning(f"App 爬取跳过: {e}")
    
    # 统计
    db = SignalDatabase()
    stats = db.get_signal_stats()
    
    print(f"\n{'='*50}")
    print(f"📊 爬取完成统计")
    print(f"{'='*50}")
    print(f"总信号数: {stats['total_signals']}")
    print(f"最近24h: {stats['last_24h']}")
    print(f"按来源: {json.dumps(stats['by_source'], indent=2)}")
    print(f"按方向: {json.dumps(stats['by_direction'], indent=2)}")


# ============================================================
# 命令: rewrite
# ============================================================
def cmd_rewrite(args):
    """改编信号内容"""
    rewriter = SignalRewriter()
    
    results = rewriter.batch_rewrite(limit=args.limit, style=args.style)
    
    if not results:
        print("没有待改编的信号。请先运行爬虫。")
        return
    
    for r in results:
        print(f"\n{'='*50}")
        print(f"信号ID: {r['signal_id']}")
        print(f"方向: {r['direction']} | 入场: {r['entry_price']}")
        print(f"{'='*50}")
        print(r['rewritten'])
    
    # 保存到文件
    output_dir = DATA_DIR / "rewritten"
    output_dir.mkdir(exist_ok=True)
    
    filename = f"rewritten_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = output_dir / filename
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n改编结果已保存到: {filepath}")


# ============================================================
# 命令: publish
# ============================================================
async def cmd_publish(args):
    """发布信号到社区"""
    publisher = SignalPublisher()
    
    if args.preview:
        previews = publisher.preview_unpublished(limit=args.limit, style=args.style)
        if not previews:
            print("没有待发布的信号。")
        return
    
    if args.auto:
        await publisher.auto_publish_loop(style=args.style)
    else:
        print("请使用 --preview 预览或 --auto 启动自动发布")


# ============================================================
# 命令: report
# ============================================================
def cmd_report(args):
    """生成信号报告"""
    rewriter = SignalRewriter()
    report = rewriter.generate_daily_report()
    print(report)
    
    # 保存报告
    output_dir = DATA_DIR / "reports"
    output_dir.mkdir(exist_ok=True)
    
    filename = f"daily_report_{datetime.utcnow().strftime('%Y%m%d')}.txt"
    filepath = output_dir / filename
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n报告已保存到: {filepath}")


# ============================================================
# 命令: stats
# ============================================================
def cmd_stats(args):
    """查看统计信息"""
    db = SignalDatabase()
    stats = db.get_signal_stats()
    
    print(f"\n{'='*50}")
    print(f"📊 XAUUSD Signal Hub 统计")
    print(f"{'='*50}")
    print(f"总信号数: {stats['total_signals']}")
    print(f"最近24h: {stats['last_24h']}")
    print(f"\n按来源:")
    for source, count in stats.get('by_source', {}).items():
        print(f"  {source}: {count}")
    print(f"\n按方向:")
    for direction, count in stats.get('by_direction', {}).items():
        print(f"  {direction}: {count}")


# ============================================================
# 命令: daemon
# ============================================================
async def cmd_daemon(args):
    """守护进程模式 - 同时运行所有爬虫和发布器"""
    logger.info("🚀 XAUUSD Signal Hub 守护进程启动")
    
    tasks = []
    
    # 网站爬取任务
    async def web_crawl_loop():
        manager = WebsiteCrawlerManager()
        while True:
            try:
                manager.crawl_all()
            except Exception as e:
                logger.error(f"网站爬取出错: {e}")
            await asyncio.sleep(WEBSITE_CRAWL_INTERVAL)
    
    tasks.append(asyncio.create_task(web_crawl_loop()))
    
    # Telegram 爬取任务（如果配置了）
    try:
        from crawlers.telegram_crawler import TelegramSignalCrawler
        crawler = TelegramSignalCrawler()
        await crawler.start()
        
        async def telegram_crawl_loop():
            while True:
                try:
                    await crawler.crawl_all_channels(limit_per_channel=20)
                except Exception as e:
                    logger.error(f"Telegram爬取出错: {e}")
                await asyncio.sleep(TELEGRAM_CRAWL_INTERVAL)
        
        tasks.append(asyncio.create_task(telegram_crawl_loop()))
    except Exception as e:
        logger.warning(f"Telegram 爬虫未启动: {e}")
    
    # 自动发布任务
    if args.auto_publish:
        publisher = SignalPublisher()
        tasks.append(asyncio.create_task(
            publisher.auto_publish_loop(style=args.style)
        ))
    
    logger.info(f"已启动 {len(tasks)} 个后台任务")
    
    # 等待所有任务
    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        logger.info("守护进程正在关闭...")


# ============================================================
# 主入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(
        description="XAUUSD Signal Hub - 黄金信号聚合社区",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 爬取网站信号
  python main.py crawl-web
  
  # 爬取Telegram信号（需要配置API）
  python main.py crawl-telegram --limit 50
  
  # 实时监控Telegram
  python main.py crawl-telegram --realtime
  
  # 爬取所有信号源
  python main.py crawl-all
  
  # 改编信号内容
  python main.py rewrite --style professional --limit 5
  
  # 预览待发布信号
  python main.py publish --preview
  
  # 生成每日报告
  python main.py report
  
  # 查看统计
  python main.py stats
  
  # 启动守护进程（全自动模式）
  python main.py daemon --auto-publish
  
  # 查看App抓包指南
  python main.py crawl-app --guide
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # crawl-telegram
    p_tg = subparsers.add_parser('crawl-telegram', help='爬取Telegram信号')
    p_tg.add_argument('--limit', type=int, default=50, help='每个频道爬取消息数')
    p_tg.add_argument('--realtime', action='store_true', help='实时监控模式')
    p_tg.add_argument('--periodic', action='store_true', help='定期爬取模式')
    p_tg.add_argument('--interval', type=int, default=60, help='定期爬取间隔(秒)')
    
    # crawl-web
    p_web = subparsers.add_parser('crawl-web', help='爬取网站信号')
    p_web.add_argument('--periodic', action='store_true', help='定期爬取模式')
    p_web.add_argument('--interval', type=int, default=300, help='定期爬取间隔(秒)')
    
    # crawl-app
    p_app = subparsers.add_parser('crawl-app', help='爬取黄金形态通App')
    p_app.add_argument('--guide', action='store_true', help='显示抓包指南')
    
    # crawl-all
    p_all = subparsers.add_parser('crawl-all', help='爬取所有信号源')
    p_all.add_argument('--limit', type=int, default=50, help='Telegram每频道消息数')
    
    # rewrite
    p_rw = subparsers.add_parser('rewrite', help='改编信号内容')
    p_rw.add_argument('--style', default='professional', 
                       choices=['professional', 'casual', 'chinese', 'premium'],
                       help='改编风格')
    p_rw.add_argument('--limit', type=int, default=5, help='改编数量')
    
    # publish
    p_pub = subparsers.add_parser('publish', help='发布信号到社区')
    p_pub.add_argument('--preview', action='store_true', help='预览模式')
    p_pub.add_argument('--auto', action='store_true', help='自动发布模式')
    p_pub.add_argument('--style', default='professional', help='发布风格')
    p_pub.add_argument('--limit', type=int, default=5, help='发布数量')
    
    # report
    p_report = subparsers.add_parser('report', help='生成信号报告')
    
    # stats
    p_stats = subparsers.add_parser('stats', help='查看统计信息')
    
    # daemon
    p_daemon = subparsers.add_parser('daemon', help='守护进程模式')
    p_daemon.add_argument('--auto-publish', action='store_true', help='自动发布')
    p_daemon.add_argument('--style', default='professional', help='发布风格')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    setup_logging()
    
    # 路由到对应命令
    if args.command == 'crawl-telegram':
        asyncio.run(cmd_crawl_telegram(args))
    elif args.command == 'crawl-web':
        cmd_crawl_web(args)
    elif args.command == 'crawl-app':
        cmd_crawl_app(args)
    elif args.command == 'crawl-all':
        asyncio.run(cmd_crawl_all(args))
    elif args.command == 'rewrite':
        cmd_rewrite(args)
    elif args.command == 'publish':
        asyncio.run(cmd_publish(args))
    elif args.command == 'report':
        cmd_report(args)
    elif args.command == 'stats':
        cmd_stats(args)
    elif args.command == 'daemon':
        asyncio.run(cmd_daemon(args))


if __name__ == "__main__":
    main()
