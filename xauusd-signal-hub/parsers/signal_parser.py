"""
XAUUSD Signal Hub - 信号文本解析器
从各种格式的文本消息中提取结构化交易信号
"""
import re
from typing import Optional, List
from datetime import datetime

from utils.models import TradingSignal, SignalDirection, SignalSource


class SignalParser:
    """通用信号文本解析器"""
    
    # 匹配 XAUUSD/GOLD 关键词
    PAIR_PATTERNS = [
        r'(?:XAU\s*/?USD|GOLD|黄金|XAU)',
    ]
    
    # 匹配买卖方向
    DIRECTION_PATTERNS = {
        SignalDirection.BUY: [
            r'\bBUY\b', r'\bLONG\b', r'\b做多\b', r'\b看多\b', r'\b看涨\b',
            r'\bBullish\b', r'\bBUYING\b',
        ],
        SignalDirection.SELL: [
            r'\bSELL\b', r'\bSHORT\b', r'\b做空\b', r'\b看空\b', r'\b看跌\b',
            r'\bBearish\b', r'\bSELLING\b',
        ],
    }
    
    # 匹配价格的通用模式（黄金价格通常在 1800-3500 范围）
    PRICE_PATTERN = r'(\d{4}(?:\.\d{1,2})?)'
    
    def parse_telegram_signal(self, text: str, channel: str = "", 
                               message_id: str = "") -> Optional[TradingSignal]:
        """解析 Telegram 信号消息"""
        if not text:
            return None
        
        # 检查是否包含交易对关键词
        is_gold_signal = any(
            re.search(p, text, re.IGNORECASE) 
            for p in self.PAIR_PATTERNS
        )
        if not is_gold_signal:
            return None
        
        # 检测方向
        direction = self._detect_direction(text)
        if not direction:
            return None
        
        # 提取价格
        entry = self._extract_entry_price(text)
        tps = self._extract_take_profits(text)
        sl = self._extract_stop_loss(text)
        
        # 如果连入场价都没有，可能不是有效信号
        if not entry and not tps and not sl:
            return None
        
        signal = TradingSignal(
            pair="XAUUSD",
            direction=direction,
            entry_price=entry[0] if entry else None,
            entry_price_max=entry[1] if entry and len(entry) > 1 else None,
            take_profit_1=tps[0] if len(tps) > 0 else None,
            take_profit_2=tps[1] if len(tps) > 1 else None,
            take_profit_3=tps[2] if len(tps) > 2 else None,
            stop_loss=sl,
            source=SignalSource.TELEGRAM,
            source_channel=channel,
            source_message_id=message_id,
            original_text=text,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        return signal
    
    def parse_dailyforex_signal(self, data: dict) -> Optional[TradingSignal]:
        """解析 DailyForex 网站信号"""
        direction_str = data.get("direction", "").upper()
        direction = SignalDirection.BUY if "BUY" in direction_str else SignalDirection.SELL
        
        signal = TradingSignal(
            pair="XAUUSD",
            direction=direction,
            entry_price=self._safe_float(data.get("entry_price")),
            take_profit_1=self._safe_float(data.get("take_profit")),
            stop_loss=self._safe_float(data.get("stop_loss")),
            source=SignalSource.DAILYFOREX,
            source_channel="dailyforex.com",
            original_text=data.get("raw_text", ""),
            analysis_summary=data.get("analysis", ""),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        return signal
    
    def parse_investing_technical(self, data: dict) -> Optional[TradingSignal]:
        """解析 Investing.com 技术分析数据"""
        overall = data.get("overall_summary", "").upper()
        
        if "BUY" in overall:
            direction = SignalDirection.BUY
        elif "SELL" in overall:
            direction = SignalDirection.SELL
        else:
            direction = SignalDirection.NEUTRAL
        
        signal = TradingSignal(
            pair="XAUUSD",
            direction=direction,
            source=SignalSource.INVESTING,
            source_channel="investing.com",
            rsi_value=self._safe_float(data.get("rsi_value")),
            macd_signal=data.get("macd_signal", ""),
            moving_avg_signal=data.get("ma_summary", ""),
            overall_signal=data.get("overall_summary", ""),
            analysis_summary=self._generate_investing_summary(data),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        return signal
    
    def parse_forexfactory_signal(self, text: str) -> Optional[TradingSignal]:
        """解析 ForexFactory 信号"""
        if not text:
            return None
        
        direction = self._detect_direction(text)
        if not direction:
            return None
        
        # 提取置信度
        confidence = None
        conf_match = re.search(r'CONFIDENCE:\s*(\d+(?:\.\d+)?)\s*%?', text, re.IGNORECASE)
        if conf_match:
            confidence = float(conf_match.group(1))
        
        signal = TradingSignal(
            pair="XAUUSD",
            direction=direction,
            confidence=confidence,
            source=SignalSource.FOREXFACTORY,
            source_channel="forexfactory.com",
            original_text=text,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        # 尝试提取价格
        entry = self._extract_entry_price(text)
        if entry:
            signal.entry_price = entry[0]
        
        tps = self._extract_take_profits(text)
        if tps:
            signal.take_profit_1 = tps[0] if len(tps) > 0 else None
        
        sl = self._extract_stop_loss(text)
        if sl:
            signal.stop_loss = sl
        
        return signal
    
    def _detect_direction(self, text: str) -> Optional[SignalDirection]:
        """检测交易方向"""
        text_upper = text.upper()
        
        for direction, patterns in self.DIRECTION_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_upper):
                    return direction
        
        return None
    
    def _extract_entry_price(self, text: str) -> Optional[List[float]]:
        """提取入场价格"""
        patterns = [
            # 匹配 "@ 2930-2935" 或 "@ 2930 - 2935"
            r'@\s*(\d{4}(?:\.\d{1,2})?)\s*[-–]\s*(\d{4}(?:\.\d{1,2})?)',
            # 匹配 "@ 2930"
            r'@\s*(\d{4}(?:\.\d{1,2})?)',
            # 匹配 "Entry: 2930" 或 "Entry Price: 2930"
            r'(?:Entry|入场|开仓)[\s:：]*(\d{4}(?:\.\d{1,2})?)',
            # 匹配 "Price: 2930"
            r'Price[\s:：]*(\d{4}(?:\.\d{1,2})?)',
            # 匹配 "from 2930" 或 "at 2930"
            r'(?:from|at|around)\s+(\d{4}(?:\.\d{1,2})?)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                prices = [float(g) for g in match.groups() if g]
                # 验证是否在合理的黄金价格范围内
                if all(1500 <= p <= 5000 for p in prices):
                    return prices
        
        return None
    
    def _extract_take_profits(self, text: str) -> List[float]:
        """提取止盈价格"""
        tps = []
        
        patterns = [
            r'TP\s*1?\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
            r'TP\s*2\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
            r'TP\s*3\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
            r'(?:Take\s*Profit|止盈)\s*1?\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
            r'(?:Take\s*Profit|止盈)\s*2\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
            r'(?:Take\s*Profit|止盈)\s*3\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
            r'Target\s*1?\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
            r'Target\s*2\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
            r'Target\s*3\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                price = float(match.group(1))
                if 1500 <= price <= 5000 and price not in tps:
                    tps.append(price)
        
        return tps
    
    def _extract_stop_loss(self, text: str) -> Optional[float]:
        """提取止损价格"""
        patterns = [
            r'SL\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
            r'(?:Stop\s*Loss|止损)\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
            r'(?:Stop|Stoploss)\s*[:：=]\s*(\d{4}(?:\.\d{1,2})?)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                price = float(match.group(1))
                if 1500 <= price <= 5000:
                    return price
        
        return None
    
    def _generate_investing_summary(self, data: dict) -> str:
        """生成 Investing.com 数据的分析摘要"""
        parts = []
        
        overall = data.get("overall_summary", "")
        if overall:
            parts.append(f"综合评级: {overall}")
        
        ma = data.get("ma_summary", "")
        if ma:
            parts.append(f"均线信号: {ma}")
        
        indicator = data.get("indicator_summary", "")
        if indicator:
            parts.append(f"指标信号: {indicator}")
        
        rsi = data.get("rsi_value")
        if rsi:
            parts.append(f"RSI: {rsi}")
        
        return " | ".join(parts)
    
    @staticmethod
    def _safe_float(value) -> Optional[float]:
        """安全转换为浮点数"""
        if value is None:
            return None
        try:
            return float(str(value).replace(",", ""))
        except (ValueError, TypeError):
            return None
