"""
XAUUSD Signal Hub - 网站信号爬虫
爬取 DailyForex.com 和 Investing.com 的 XAUUSD 交易信号和技术分析数据
"""
import re
import logging
import time
from datetime import datetime
from typing import List, Optional, Dict

import requests
from bs4 import BeautifulSoup

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    DAILYFOREX_URL, INVESTING_COM_URL, DEFAULT_HEADERS
)
from parsers.signal_parser import SignalParser
from utils.models import (
    TradingSignal, TechnicalIndicator, MarketSummary,
    SignalDirection, SignalSource
)
from utils.database import SignalDatabase

logger = logging.getLogger(__name__)


class DailyForexCrawler:
    """DailyForex.com 信号爬虫"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.parser = SignalParser()
        self.db = SignalDatabase()
        self.base_url = "https://www.dailyforex.com"
    
    def crawl_signals(self) -> List[TradingSignal]:
        """爬取 DailyForex 的免费信号"""
        signals = []
        
        try:
            # 爬取信号列表页
            url = DAILYFOREX_URL
            logger.info(f"爬取 DailyForex 信号: {url}")
            
            resp = self.session.get(url, timeout=30)
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # 查找信号卡片/列表项
            signal_items = self._find_signal_items(soup)
            
            for item in signal_items:
                signal_data = self._parse_signal_item(item)
                if signal_data and 'gold' in signal_data.get('pair', '').lower():
                    signal = self.parser.parse_dailyforex_signal(signal_data)
                    if signal:
                        msg_id = signal_data.get('url', str(hash(signal_data.get('raw_text', ''))))
                        signal.source_message_id = msg_id
                        
                        if not self.db.signal_exists(
                            SignalSource.DAILYFOREX.value, msg_id
                        ):
                            self.db.save_signal(signal)
                            signals.append(signal)
                            logger.info(
                                f"[DailyForex] 新信号: {signal.direction.value} "
                                f"@ {signal.entry_price}"
                            )
            
            self.db.log_crawl(
                source="DAILYFOREX", channel="dailyforex.com",
                status="SUCCESS", signal_count=len(signals)
            )
            
        except Exception as e:
            logger.error(f"DailyForex 爬取失败: {e}")
            self.db.log_crawl(
                source="DAILYFOREX", channel="dailyforex.com",
                status="ERROR", error=str(e)
            )
        
        return signals
    
    def crawl_gold_analysis(self) -> Optional[Dict]:
        """爬取 DailyForex 的黄金分析文章"""
        try:
            url = f"{self.base_url}/forex-technical-analysis/gold-analysis"
            resp = self.session.get(url, timeout=30)
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            articles = []
            article_items = soup.select('.article-item, .analysis-item, .post-item')
            
            for item in article_items[:5]:  # 取最新5篇
                title_el = item.select_one('h2, h3, .title, a')
                if title_el:
                    title = title_el.get_text(strip=True)
                    link = title_el.get('href', '')
                    if link and not link.startswith('http'):
                        link = self.base_url + link
                    
                    articles.append({
                        'title': title,
                        'url': link,
                        'source': 'DailyForex',
                    })
            
            return {'articles': articles}
            
        except Exception as e:
            logger.error(f"DailyForex 分析文章爬取失败: {e}")
            return None
    
    def _find_signal_items(self, soup: BeautifulSoup) -> list:
        """查找页面中的信号项"""
        selectors = [
            '.signal-item', '.signal-card', '.recommendation',
            '.live-signal', '.trade-signal',
            'table.signals tbody tr',
            '.forex-signal', '.analysis-signal',
            'article', '.post-content',
        ]
        
        for selector in selectors:
            items = soup.select(selector)
            if items:
                return items
        
        # 尝试查找包含关键词的div
        all_divs = soup.find_all(['div', 'article', 'section'])
        signal_divs = []
        for div in all_divs:
            text = div.get_text(strip=True).lower()
            if any(kw in text for kw in ['gold', 'xauusd', 'xau/usd']):
                if any(kw in text for kw in ['buy', 'sell', 'tp', 'sl', 'stop loss', 'take profit']):
                    signal_divs.append(div)
        
        return signal_divs
    
    def _parse_signal_item(self, item) -> Optional[Dict]:
        """解析单个信号项"""
        text = item.get_text(separator=' ', strip=True)
        
        # 提取交易对
        pair = ""
        if re.search(r'gold|xau\s*/?usd', text, re.IGNORECASE):
            pair = "Gold"
        
        if not pair:
            return None
        
        # 提取方向
        direction = ""
        if re.search(r'\bbuy\b', text, re.IGNORECASE):
            direction = "BUY"
        elif re.search(r'\bsell\b', text, re.IGNORECASE):
            direction = "SELL"
        
        # 提取价格
        prices = re.findall(r'(\d{4}(?:\.\d{1,2})?)', text)
        prices = [float(p) for p in prices if 1500 <= float(p) <= 5000]
        
        entry_price = None
        take_profit = None
        stop_loss = None
        
        # 尝试从上下文中提取
        entry_match = re.search(r'(?:entry|@|price|at)\s*:?\s*(\d{4}(?:\.\d{1,2})?)', text, re.IGNORECASE)
        if entry_match:
            entry_price = float(entry_match.group(1))
        
        tp_match = re.search(r'(?:tp|take\s*profit|target)\s*:?\s*(\d{4}(?:\.\d{1,2})?)', text, re.IGNORECASE)
        if tp_match:
            take_profit = float(tp_match.group(1))
        
        sl_match = re.search(r'(?:sl|stop\s*loss|stop)\s*:?\s*(\d{4}(?:\.\d{1,2})?)', text, re.IGNORECASE)
        if sl_match:
            stop_loss = float(sl_match.group(1))
        
        # 提取链接
        link = ""
        a_tag = item.find('a')
        if a_tag:
            link = a_tag.get('href', '')
        
        return {
            'pair': pair,
            'direction': direction,
            'entry_price': entry_price,
            'take_profit': take_profit,
            'stop_loss': stop_loss,
            'raw_text': text[:500],
            'url': link,
            'analysis': text[:200],
        }


class InvestingComCrawler:
    """Investing.com 技术分析爬虫"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            **DEFAULT_HEADERS,
            "Referer": "https://www.investing.com/",
        })
        self.parser = SignalParser()
        self.db = SignalDatabase()
    
    def crawl_technical_analysis(self) -> Optional[MarketSummary]:
        """爬取 XAUUSD 技术分析数据"""
        try:
            url = INVESTING_COM_URL
            logger.info(f"爬取 Investing.com 技术分析: {url}")
            
            resp = self.session.get(url, timeout=30)
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            summary = MarketSummary(
                pair="XAUUSD",
                source="investing.com",
                timestamp=datetime.utcnow(),
            )
            
            # 提取总体摘要
            summary_el = soup.select_one(
                '#techStudiesInnerWrap .summary, '
                '.technicalSummary, '
                '[data-test="techAnalysis"]'
            )
            if summary_el:
                summary.overall_summary = summary_el.get_text(strip=True)
            
            # 提取技术指标
            indicators = self._parse_indicators_table(soup)
            summary.indicators = indicators
            
            # 提取均线信号
            ma_indicators = self._parse_moving_averages(soup)
            if ma_indicators:
                buy_count = sum(1 for i in ma_indicators if i.action.upper() == 'BUY')
                sell_count = sum(1 for i in ma_indicators if i.action.upper() == 'SELL')
                
                if buy_count > sell_count * 2:
                    summary.ma_summary = "Strong Buy"
                elif buy_count > sell_count:
                    summary.ma_summary = "Buy"
                elif sell_count > buy_count * 2:
                    summary.ma_summary = "Strong Sell"
                elif sell_count > buy_count:
                    summary.ma_summary = "Sell"
                else:
                    summary.ma_summary = "Neutral"
                
                summary.indicators.extend(ma_indicators)
            
            # 提取RSI
            for ind in indicators:
                if 'RSI' in ind.name.upper():
                    summary.rsi_value = ind.value
                    break
            
            # 生成信号
            signal_data = {
                'overall_summary': summary.overall_summary or summary.ma_summary,
                'ma_summary': summary.ma_summary,
                'indicator_summary': summary.indicator_summary,
                'rsi_value': summary.rsi_value,
            }
            
            signal = self.parser.parse_investing_technical(signal_data)
            if signal:
                signal.source_message_id = f"investing_{datetime.utcnow().strftime('%Y%m%d_%H%M')}"
                self.db.save_signal(signal)
            
            self.db.log_crawl(
                source="INVESTING", channel="investing.com",
                status="SUCCESS", signal_count=1 if signal else 0
            )
            
            return summary
            
        except Exception as e:
            logger.error(f"Investing.com 爬取失败: {e}")
            self.db.log_crawl(
                source="INVESTING", channel="investing.com",
                status="ERROR", error=str(e)
            )
            return None
    
    def _parse_indicators_table(self, soup: BeautifulSoup) -> List[TechnicalIndicator]:
        """解析技术指标表格"""
        indicators = []
        
        table = soup.select_one('#technicalIndicatorsTbl, .technicalIndicatorsTbl')
        if not table:
            # 尝试其他选择器
            tables = soup.select('table')
            for t in tables:
                header = t.get_text(strip=True).lower()
                if 'rsi' in header or 'macd' in header or 'stochastic' in header:
                    table = t
                    break
        
        if table:
            rows = table.select('tr')
            for row in rows[1:]:  # 跳过表头
                cells = row.select('td')
                if len(cells) >= 3:
                    name = cells[0].get_text(strip=True)
                    try:
                        value = float(cells[1].get_text(strip=True).replace(',', ''))
                    except (ValueError, IndexError):
                        value = 0.0
                    action = cells[2].get_text(strip=True)
                    
                    indicators.append(TechnicalIndicator(
                        name=name,
                        value=value,
                        action=action,
                        source="investing.com",
                    ))
        
        return indicators
    
    def _parse_moving_averages(self, soup: BeautifulSoup) -> List[TechnicalIndicator]:
        """解析移动平均线表格"""
        indicators = []
        
        table = soup.select_one('#movingAveragesTbl, .movingAveragesTbl')
        if not table:
            tables = soup.select('table')
            for t in tables:
                header = t.get_text(strip=True).lower()
                if 'moving average' in header or 'ma5' in header or 'sma' in header:
                    table = t
                    break
        
        if table:
            rows = table.select('tr')
            for row in rows[1:]:
                cells = row.select('td')
                if len(cells) >= 3:
                    name = cells[0].get_text(strip=True)
                    try:
                        value = float(cells[1].get_text(strip=True).replace(',', ''))
                    except (ValueError, IndexError):
                        value = 0.0
                    action = cells[2].get_text(strip=True)
                    
                    indicators.append(TechnicalIndicator(
                        name=f"MA_{name}",
                        value=value,
                        action=action,
                        source="investing.com",
                    ))
        
        return indicators


class WebsiteCrawlerManager:
    """网站爬虫管理器"""
    
    def __init__(self):
        self.dailyforex = DailyForexCrawler()
        self.investing = InvestingComCrawler()
    
    def crawl_all(self) -> Dict:
        """爬取所有网站信号"""
        results = {
            'dailyforex_signals': [],
            'investing_summary': None,
            'timestamp': datetime.utcnow().isoformat(),
        }
        
        # 爬取 DailyForex
        try:
            signals = self.dailyforex.crawl_signals()
            results['dailyforex_signals'] = [s.to_dict() for s in signals]
            logger.info(f"DailyForex: {len(signals)} 条信号")
        except Exception as e:
            logger.error(f"DailyForex 爬取失败: {e}")
        
        time.sleep(2)  # 间隔
        
        # 爬取 Investing.com
        try:
            summary = self.investing.crawl_technical_analysis()
            if summary:
                results['investing_summary'] = summary.to_dict()
                logger.info(f"Investing.com: 综合评级 = {summary.overall_summary}")
        except Exception as e:
            logger.error(f"Investing.com 爬取失败: {e}")
        
        return results
    
    def run_periodic(self, interval: int = 300):
        """定期爬取"""
        logger.info(f"网站爬虫定期模式启动，间隔 {interval} 秒")
        
        while True:
            try:
                results = self.crawl_all()
                logger.info(f"本轮网站爬取完成: {results.get('timestamp')}")
            except Exception as e:
                logger.error(f"定期爬取出错: {e}")
            
            time.sleep(interval)


def main():
    """测试网站爬虫"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
    )
    
    manager = WebsiteCrawlerManager()
    results = manager.crawl_all()
    
    import json
    print(json.dumps(results, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
