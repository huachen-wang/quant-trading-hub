"""
XAUUSD Signal Hub - Telegram 信号频道爬虫
使用 Telethon 库监控和爬取 Telegram 公开频道中的交易信号
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional

try:
    from telethon import TelegramClient, events
    from telethon.tl.types import Channel, Message
    from telethon.errors import FloodWaitError, ChannelPrivateError
    TELETHON_AVAILABLE = True
except ImportError:
    TELETHON_AVAILABLE = False

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_NAME,
    TELEGRAM_SIGNAL_CHANNELS, DATA_DIR
)
from parsers.signal_parser import SignalParser
from utils.models import TradingSignal, SignalSource
from utils.database import SignalDatabase

logger = logging.getLogger(__name__)


class TelegramSignalCrawler:
    """Telegram 信号频道爬虫"""
    
    def __init__(self, api_id: str = None, api_hash: str = None, 
                 session_name: str = None):
        if not TELETHON_AVAILABLE:
            raise ImportError(
                "Telethon 未安装。请运行: pip install telethon"
            )
        
        self.api_id = api_id or TELEGRAM_API_ID
        self.api_hash = api_hash or TELEGRAM_API_HASH
        self.session_name = session_name or TELEGRAM_SESSION_NAME
        
        if not self.api_id or not self.api_hash:
            raise ValueError(
                "请设置 TELEGRAM_API_ID 和 TELEGRAM_API_HASH 环境变量。\n"
                "获取方式: 访问 https://my.telegram.org -> API development tools"
            )
        
        self.client = TelegramClient(
            str(DATA_DIR / self.session_name),
            int(self.api_id),
            self.api_hash
        )
        self.parser = SignalParser()
        self.db = SignalDatabase()
        self.channels = TELEGRAM_SIGNAL_CHANNELS
    
    async def start(self):
        """启动客户端"""
        await self.client.start()
        me = await self.client.get_me()
        logger.info(f"已登录 Telegram: {me.username or me.phone}")
    
    async def stop(self):
        """停止客户端"""
        await self.client.disconnect()
    
    async def crawl_channel_history(self, channel_username: str, 
                                      limit: int = 100,
                                      offset_date: datetime = None) -> List[TradingSignal]:
        """爬取频道历史消息"""
        signals = []
        message_count = 0
        
        try:
            entity = await self.client.get_entity(channel_username)
            logger.info(f"开始爬取频道: {channel_username} (limit={limit})")
            
            async for message in self.client.iter_messages(
                entity, 
                limit=limit,
                offset_date=offset_date
            ):
                message_count += 1
                
                if not message.text:
                    continue
                
                signal = self.parser.parse_telegram_signal(
                    text=message.text,
                    channel=channel_username,
                    message_id=str(message.id)
                )
                
                if signal:
                    signal.created_at = message.date.replace(tzinfo=None)
                    
                    # 检查是否已存在
                    if not self.db.signal_exists(
                        SignalSource.TELEGRAM.value, str(message.id)
                    ):
                        self.db.save_signal(signal)
                        signals.append(signal)
                        logger.info(
                            f"[{channel_username}] 新信号: "
                            f"{signal.direction.value} @ {signal.entry_price}"
                        )
            
            self.db.log_crawl(
                source="TELEGRAM",
                channel=channel_username,
                status="SUCCESS",
                message_count=message_count,
                signal_count=len(signals)
            )
            
            logger.info(
                f"频道 {channel_username}: 扫描 {message_count} 条消息, "
                f"发现 {len(signals)} 条新信号"
            )
            
        except ChannelPrivateError:
            logger.warning(f"频道 {channel_username} 是私有的，无法访问")
            self.db.log_crawl(
                source="TELEGRAM", channel=channel_username,
                status="ERROR", error="Channel is private"
            )
        except FloodWaitError as e:
            logger.warning(f"触发速率限制，等待 {e.seconds} 秒")
            await asyncio.sleep(e.seconds)
        except Exception as e:
            logger.error(f"爬取频道 {channel_username} 失败: {e}")
            self.db.log_crawl(
                source="TELEGRAM", channel=channel_username,
                status="ERROR", error=str(e)
            )
        
        return signals
    
    async def crawl_all_channels(self, limit_per_channel: int = 50) -> List[TradingSignal]:
        """爬取所有配置的频道"""
        all_signals = []
        
        for channel in self.channels:
            try:
                signals = await self.crawl_channel_history(
                    channel, limit=limit_per_channel
                )
                all_signals.extend(signals)
                
                # 频道间间隔，避免触发限制
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"处理频道 {channel} 时出错: {e}")
                continue
        
        logger.info(f"全部频道爬取完成: 共 {len(all_signals)} 条新信号")
        return all_signals
    
    async def start_realtime_monitor(self):
        """启动实时监控模式 - 监听新消息"""
        
        @self.client.on(events.NewMessage(chats=self.channels))
        async def handler(event):
            """处理新消息事件"""
            if not event.message.text:
                return
            
            channel = ""
            if hasattr(event.message.peer_id, 'channel_id'):
                try:
                    entity = await self.client.get_entity(event.message.peer_id)
                    channel = getattr(entity, 'username', '') or str(entity.id)
                except Exception:
                    channel = str(event.message.peer_id.channel_id)
            
            signal = self.parser.parse_telegram_signal(
                text=event.message.text,
                channel=channel,
                message_id=str(event.message.id)
            )
            
            if signal:
                if not self.db.signal_exists(
                    SignalSource.TELEGRAM.value, str(event.message.id)
                ):
                    self.db.save_signal(signal)
                    logger.info(
                        f"🔔 实时新信号 [{channel}]: "
                        f"{signal.direction.value} @ {signal.entry_price}"
                    )
                    logger.info(signal.format_signal_card())
        
        logger.info(f"实时监控已启动，监控 {len(self.channels)} 个频道")
        await self.client.run_until_disconnected()
    
    async def run_periodic_crawl(self, interval: int = 60, 
                                   limit_per_channel: int = 20):
        """定期爬取模式"""
        logger.info(f"定期爬取模式启动，间隔 {interval} 秒")
        
        while True:
            try:
                signals = await self.crawl_all_channels(
                    limit_per_channel=limit_per_channel
                )
                
                if signals:
                    logger.info(f"本轮发现 {len(signals)} 条新信号")
                    for s in signals:
                        logger.info(s.format_signal_card())
                
            except Exception as e:
                logger.error(f"定期爬取出错: {e}")
            
            await asyncio.sleep(interval)


async def main():
    """主函数 - 演示用法"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
    )
    
    crawler = TelegramSignalCrawler()
    
    try:
        await crawler.start()
        
        # 模式1: 爬取历史消息
        signals = await crawler.crawl_all_channels(limit_per_channel=50)
        print(f"\n共获取 {len(signals)} 条信号")
        for s in signals:
            print(s.format_signal_card())
        
        # 模式2: 实时监控（取消注释以启用）
        # await crawler.start_realtime_monitor()
        
        # 模式3: 定期爬取（取消注释以启用）
        # await crawler.run_periodic_crawl(interval=60)
        
    finally:
        await crawler.stop()


if __name__ == "__main__":
    asyncio.run(main())
