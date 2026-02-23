"""
XAUUSD Signal Hub - 信号社区发布器
将改编后的信号自动发布到你的 Telegram 频道/群组
"""
import asyncio
import logging
import random
import time
from datetime import datetime
from typing import Optional, List

try:
    from telegram import Bot
    from telegram.constants import ParseMode
    TELEGRAM_BOT_AVAILABLE = True
except ImportError:
    try:
        # 尝试使用 telethon 作为替代
        from telethon import TelegramClient
        TELEGRAM_BOT_AVAILABLE = False
        TELETHON_AVAILABLE = True
    except ImportError:
        TELEGRAM_BOT_AVAILABLE = False
        TELETHON_AVAILABLE = False

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    TELEGRAM_BOT_TOKEN, TELEGRAM_COMMUNITY_CHANNEL,
    SIGNAL_PUBLISH_DELAY_MIN, SIGNAL_PUBLISH_DELAY_MAX,
    TELEGRAM_API_ID, TELEGRAM_API_HASH, DATA_DIR
)
from community.signal_rewriter import SignalRewriter
from utils.database import SignalDatabase

logger = logging.getLogger(__name__)


class SignalPublisher:
    """信号发布器"""
    
    def __init__(self):
        self.db = SignalDatabase()
        self.rewriter = SignalRewriter()
        self.bot_token = TELEGRAM_BOT_TOKEN
        self.channel = TELEGRAM_COMMUNITY_CHANNEL
    
    async def publish_to_telegram_bot(self, text: str) -> bool:
        """通过 Telegram Bot API 发布消息"""
        if not TELEGRAM_BOT_AVAILABLE:
            logger.error("python-telegram-bot 未安装。pip install python-telegram-bot")
            return False
        
        if not self.bot_token or not self.channel:
            logger.error("请设置 TELEGRAM_BOT_TOKEN 和 TELEGRAM_COMMUNITY_CHANNEL")
            return False
        
        try:
            bot = Bot(token=self.bot_token)
            await bot.send_message(
                chat_id=self.channel,
                text=text,
                parse_mode=ParseMode.HTML,
            )
            logger.info(f"消息已发布到 {self.channel}")
            return True
        except Exception as e:
            logger.error(f"发布失败: {e}")
            return False
    
    async def publish_to_telegram_client(self, text: str) -> bool:
        """通过 Telethon 客户端发布消息（使用用户账号）"""
        if not TELETHON_AVAILABLE:
            logger.error("Telethon 未安装")
            return False
        
        try:
            client = TelegramClient(
                str(DATA_DIR / "publisher_session"),
                int(TELEGRAM_API_ID),
                TELEGRAM_API_HASH
            )
            
            await client.start()
            await client.send_message(self.channel, text)
            await client.disconnect()
            
            logger.info(f"消息已通过客户端发布到 {self.channel}")
            return True
        except Exception as e:
            logger.error(f"客户端发布失败: {e}")
            return False
    
    async def publish_signal(self, signal_id: str, style: str = "professional") -> bool:
        """发布单条信号"""
        # 获取信号数据
        signals = self.db.get_recent_signals(hours=48)
        signal_data = None
        for s in signals:
            if s.get('signal_id') == signal_id:
                signal_data = s
                break
        
        if not signal_data:
            logger.error(f"信号 {signal_id} 未找到")
            return False
        
        # 检查是否已有改编内容
        rewritten = signal_data.get('rewritten_text', '')
        
        if not rewritten:
            # 使用改编器生成内容
            results = self.rewriter.batch_rewrite(limit=1, style=style)
            if results:
                rewritten = results[0]['rewritten']
        
        if not rewritten:
            logger.error("无法生成改编内容")
            return False
        
        # 发布
        success = False
        if TELEGRAM_BOT_AVAILABLE and self.bot_token:
            success = await self.publish_to_telegram_bot(rewritten)
        elif TELETHON_AVAILABLE:
            success = await self.publish_to_telegram_client(rewritten)
        else:
            logger.warning("没有可用的发布方式，仅保存到本地")
            # 保存到文件
            self._save_to_file(rewritten, signal_id)
            success = True
        
        if success:
            self.db.mark_published(signal_id)
        
        return success
    
    async def auto_publish_loop(self, style: str = "professional"):
        """自动发布循环"""
        logger.info("自动发布循环启动")
        
        while True:
            try:
                # 获取未发布的信号
                unpublished = self.db.get_unpublished_signals(limit=5)
                
                if unpublished:
                    for signal_data in unpublished:
                        signal_id = signal_data['signal_id']
                        
                        # 改编内容
                        results = self.rewriter.batch_rewrite(limit=1, style=style)
                        
                        if results:
                            rewritten = results[0]['rewritten']
                            
                            # 随机延迟，避免被识别
                            delay = random.randint(
                                SIGNAL_PUBLISH_DELAY_MIN, 
                                SIGNAL_PUBLISH_DELAY_MAX
                            )
                            logger.info(f"等待 {delay} 秒后发布信号 {signal_id}")
                            await asyncio.sleep(delay)
                            
                            # 发布
                            await self.publish_signal(signal_id, style)
                
                else:
                    logger.info("暂无待发布信号")
                
                # 等待下一轮检查
                await asyncio.sleep(60)
                
            except Exception as e:
                logger.error(f"自动发布出错: {e}")
                await asyncio.sleep(30)
    
    def _save_to_file(self, content: str, signal_id: str):
        """保存到本地文件"""
        output_dir = DATA_DIR / "published"
        output_dir.mkdir(exist_ok=True)
        
        filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{signal_id}.txt"
        filepath = output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        logger.info(f"信号已保存到: {filepath}")
    
    def preview_unpublished(self, limit: int = 5, style: str = "professional") -> List[str]:
        """预览待发布的信号（改编后）"""
        results = self.rewriter.batch_rewrite(limit=limit, style=style)
        
        previews = []
        for r in results:
            previews.append(r['rewritten'])
            print(f"\n{'='*50}")
            print(f"信号ID: {r['signal_id']}")
            print(f"方向: {r['direction']} | 入场: {r['entry_price']}")
            print(f"{'='*50}")
            print(r['rewritten'])
        
        return previews


class MultiPlatformPublisher:
    """多平台发布器 - 支持同时发布到多个平台"""
    
    def __init__(self):
        self.telegram_publisher = SignalPublisher()
        self.db = SignalDatabase()
        self.rewriter = SignalRewriter()
    
    def publish_to_file(self, content: str, platform: str = "general"):
        """发布到本地文件（用于手动复制到其他平台）"""
        output_dir = DATA_DIR / "published" / platform
        output_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.txt"
        filepath = output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(filepath)
    
    def generate_wechat_format(self, signal_text: str) -> str:
        """生成微信群适用的格式"""
        # 移除Telegram特有的格式，适配微信
        text = signal_text.replace('━', '—')
        text = text.replace('═', '=')
        return text
    
    def generate_discord_format(self, signal_text: str) -> str:
        """生成Discord适用的格式"""
        # Discord支持Markdown
        text = signal_text.replace('━', '---')
        text = f"```\n{text}\n```"
        return text
    
    def generate_twitter_format(self, signal_text: str) -> str:
        """生成Twitter/X适用的简短格式"""
        # Twitter有字数限制，需要精简
        lines = signal_text.split('\n')
        key_lines = [l for l in lines if any(
            kw in l for kw in ['BUY', 'SELL', '入场', 'TP', 'SL', '止盈', '止损', '🟢', '🔴']
        )]
        short = '\n'.join(key_lines[:6])
        short += "\n\n#XAUUSD #Gold #Trading #Forex"
        return short[:280]  # Twitter限制


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    publisher = SignalPublisher()
    previews = publisher.preview_unpublished(limit=3)
    
    if not previews:
        print("没有待发布的信号。请先运行爬虫获取信号。")
