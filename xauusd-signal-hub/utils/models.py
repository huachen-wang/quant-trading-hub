"""
XAUUSD Signal Hub - 统一信号数据模型
"""
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List
from enum import Enum
import json
import hashlib


class SignalDirection(Enum):
    BUY = "BUY"
    SELL = "SELL"
    NEUTRAL = "NEUTRAL"


class SignalStatus(Enum):
    ACTIVE = "ACTIVE"          # 信号有效
    TP_HIT = "TP_HIT"          # 止盈触发
    SL_HIT = "SL_HIT"          # 止损触发
    EXPIRED = "EXPIRED"        # 已过期
    CANCELLED = "CANCELLED"    # 已取消


class SignalSource(Enum):
    TELEGRAM = "TELEGRAM"
    DAILYFOREX = "DAILYFOREX"
    INVESTING = "INVESTING"
    TRADINGVIEW = "TRADINGVIEW"
    FOREXFACTORY = "FOREXFACTORY"
    GOLD_PATTERN_APP = "GOLD_PATTERN_APP"
    MANUAL = "MANUAL"


@dataclass
class TradingSignal:
    """统一的交易信号数据模型"""
    # 核心信号数据
    pair: str = "XAUUSD"
    direction: SignalDirection = SignalDirection.BUY
    entry_price: Optional[float] = None
    entry_price_max: Optional[float] = None  # 入场区间上限
    
    # 止盈止损
    take_profit_1: Optional[float] = None
    take_profit_2: Optional[float] = None
    take_profit_3: Optional[float] = None
    stop_loss: Optional[float] = None
    
    # 元数据
    source: SignalSource = SignalSource.TELEGRAM
    source_channel: str = ""
    source_message_id: str = ""
    original_text: str = ""
    
    # 分析数据
    confidence: Optional[float] = None      # 信号置信度 0-100
    timeframe: str = ""                      # 时间框架 M1/M5/M15/H1/H4/D1
    analysis_summary: str = ""               # 分析摘要
    
    # 技术指标（来自Investing.com等）
    rsi_value: Optional[float] = None
    macd_signal: str = ""
    moving_avg_signal: str = ""
    overall_signal: str = ""
    
    # 状态和时间
    status: SignalStatus = SignalStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    
    # 改编后的内容
    rewritten_text: str = ""
    rewritten_style: str = ""
    
    @property
    def signal_id(self) -> str:
        """生成唯一的信号ID"""
        raw = f"{self.source.value}_{self.source_channel}_{self.source_message_id}_{self.created_at.isoformat()}"
        return hashlib.md5(raw.encode()).hexdigest()[:12]
    
    @property
    def risk_reward_ratio(self) -> Optional[float]:
        """计算风险收益比"""
        if not all([self.entry_price, self.take_profit_1, self.stop_loss]):
            return None
        risk = abs(self.entry_price - self.stop_loss)
        reward = abs(self.take_profit_1 - self.entry_price)
        if risk == 0:
            return None
        return round(reward / risk, 2)
    
    @property
    def pips_risk(self) -> Optional[float]:
        """计算风险点数"""
        if not all([self.entry_price, self.stop_loss]):
            return None
        return round(abs(self.entry_price - self.stop_loss) * 10, 1)
    
    @property
    def pips_reward(self) -> Optional[float]:
        """计算收益点数（到TP1）"""
        if not all([self.entry_price, self.take_profit_1]):
            return None
        return round(abs(self.take_profit_1 - self.entry_price) * 10, 1)
    
    def to_dict(self) -> dict:
        """转换为字典"""
        d = asdict(self)
        d['direction'] = self.direction.value
        d['source'] = self.source.value
        d['status'] = self.status.value
        d['created_at'] = self.created_at.isoformat()
        d['updated_at'] = self.updated_at.isoformat()
        d['expires_at'] = self.expires_at.isoformat() if self.expires_at else None
        d['signal_id'] = self.signal_id
        d['risk_reward_ratio'] = self.risk_reward_ratio
        d['pips_risk'] = self.pips_risk
        d['pips_reward'] = self.pips_reward
        return d
    
    def to_json(self) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
    
    def format_signal_card(self, style: str = "professional") -> str:
        """格式化为信号卡片文本"""
        direction_emoji = "🟢" if self.direction == SignalDirection.BUY else "🔴"
        direction_text = "做多 BUY" if self.direction == SignalDirection.BUY else "做空 SELL"
        
        card = f"""
{'='*40}
{direction_emoji} {self.pair} {direction_text}
{'='*40}

📍 入场价: {self.entry_price}
"""
        if self.entry_price_max:
            card += f"📍 入场区间: {self.entry_price} - {self.entry_price_max}\n"
        
        if self.take_profit_1:
            card += f"🎯 止盈1 (TP1): {self.take_profit_1}\n"
        if self.take_profit_2:
            card += f"🎯 止盈2 (TP2): {self.take_profit_2}\n"
        if self.take_profit_3:
            card += f"🎯 止盈3 (TP3): {self.take_profit_3}\n"
        if self.stop_loss:
            card += f"🛑 止损 (SL): {self.stop_loss}\n"
        
        if self.risk_reward_ratio:
            card += f"\n📊 风险收益比: 1:{self.risk_reward_ratio}"
        if self.pips_risk:
            card += f"\n📏 风险: {self.pips_risk} pips | 收益: {self.pips_reward} pips"
        
        if self.confidence:
            card += f"\n💪 置信度: {self.confidence}%"
        
        if self.analysis_summary:
            card += f"\n\n📝 分析: {self.analysis_summary}"
        
        card += f"\n\n⏰ {self.created_at.strftime('%Y-%m-%d %H:%M UTC')}"
        card += f"\n{'='*40}"
        
        return card


@dataclass
class TechnicalIndicator:
    """技术指标数据模型"""
    name: str
    value: float
    action: str  # Buy/Sell/Neutral
    timeframe: str = "H1"
    source: str = "investing.com"
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> dict:
        d = asdict(self)
        d['timestamp'] = self.timestamp.isoformat()
        return d


@dataclass
class MarketSummary:
    """市场摘要数据模型"""
    pair: str = "XAUUSD"
    current_price: Optional[float] = None
    daily_change: Optional[float] = None
    daily_change_pct: Optional[float] = None
    
    # 技术指标汇总
    ma_summary: str = ""           # Strong Buy/Buy/Neutral/Sell/Strong Sell
    indicator_summary: str = ""
    overall_summary: str = ""
    
    # 支撑阻力
    support_1: Optional[float] = None
    support_2: Optional[float] = None
    resistance_1: Optional[float] = None
    resistance_2: Optional[float] = None
    
    # 来源
    source: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    indicators: List[TechnicalIndicator] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        d = asdict(self)
        d['timestamp'] = self.timestamp.isoformat()
        d['indicators'] = [i.to_dict() for i in self.indicators]
        return d
