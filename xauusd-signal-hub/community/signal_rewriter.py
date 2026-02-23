"""
XAUUSD Signal Hub - 信号内容改编器
使用 AI 将爬取的原始信号改编为独特的、高质量的社区内容
"""
import logging
import random
import json
from datetime import datetime
from typing import Optional, Dict, List

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import OPENAI_API_KEY, SIGNAL_REWRITE_STYLES
from utils.models import TradingSignal, SignalDirection
from utils.database import SignalDatabase

logger = logging.getLogger(__name__)


class SignalRewriter:
    """信号内容改编器"""
    
    def __init__(self):
        self.db = SignalDatabase()
        
        if OPENAI_AVAILABLE and OPENAI_API_KEY:
            self.client = OpenAI()
            self.ai_available = True
        else:
            self.client = None
            self.ai_available = False
            logger.warning("OpenAI API 不可用，将使用模板改编模式")
    
    def rewrite_signal(self, signal: TradingSignal, 
                        style: str = "professional") -> str:
        """改编单条信号"""
        if self.ai_available:
            return self._ai_rewrite(signal, style)
        else:
            return self._template_rewrite(signal, style)
    
    def _ai_rewrite(self, signal: TradingSignal, style: str) -> str:
        """使用AI改编信号"""
        style_desc = SIGNAL_REWRITE_STYLES.get(style, SIGNAL_REWRITE_STYLES["professional"])
        
        prompt = f"""你是一个专业的黄金交易分析师，请将以下交易信号改编为独特的分析内容。

原始信号数据：
- 交易对: {signal.pair}
- 方向: {signal.direction.value}
- 入场价: {signal.entry_price}
- 止盈1: {signal.take_profit_1}
- 止盈2: {signal.take_profit_2}
- 止盈3: {signal.take_profit_3}
- 止损: {signal.stop_loss}
- 置信度: {signal.confidence}%
- 原始分析: {signal.analysis_summary}

改编要求：
1. 风格: {style_desc}
2. 必须包含完整的入场价、止盈、止损信息
3. 添加简短的技术分析理由（可以编造合理的技术分析逻辑）
4. 使用专业的交易术语
5. 内容必须与原始文本完全不同，但保留核心交易数据
6. 添加风险提示
7. 格式要美观，适合在Telegram/微信群发布

请直接输出改编后的内容，不要添加任何解释。"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": "你是一个资深黄金交易分析师，擅长撰写专业的交易信号分析报告。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=800,
            )
            
            rewritten = response.choices[0].message.content.strip()
            logger.info(f"AI改编完成: {signal.signal_id}")
            return rewritten
            
        except Exception as e:
            logger.error(f"AI改编失败: {e}")
            return self._template_rewrite(signal, style)
    
    def _template_rewrite(self, signal: TradingSignal, style: str) -> str:
        """使用模板改编信号（不依赖AI）"""
        direction = signal.direction
        
        # 多种开头模板
        buy_intros = [
            "📊 黄金多头机会浮现",
            "🔔 XAUUSD 做多信号触发",
            "💡 黄金技术面显示上行动能",
            "📈 Gold 多头布局时机",
            "⚡ XAUUSD 看涨信号确认",
        ]
        
        sell_intros = [
            "📊 黄金空头压力加大",
            "🔔 XAUUSD 做空信号触发",
            "💡 黄金技术面显示下行风险",
            "📉 Gold 空头布局时机",
            "⚡ XAUUSD 看跌信号确认",
        ]
        
        # 技术分析理由模板
        buy_reasons = [
            "价格突破关键阻力位，MACD金叉确认，RSI尚未进入超买区域",
            "日线级别形成看涨吞没形态，均线系统多头排列",
            "4小时图双底形态确认，成交量配合放大",
            "价格在关键支撑位获得有效支撑，布林带开口向上",
            "EMA20上穿EMA50，趋势动能转强",
        ]
        
        sell_reasons = [
            "价格跌破关键支撑位，MACD死叉确认，RSI显示超买回落",
            "日线级别形成看跌吞没形态，均线系统空头排列",
            "4小时图头肩顶形态确认，成交量配合放大",
            "价格在关键阻力位遇阻回落，布林带开口向下",
            "EMA20下穿EMA50，趋势动能转弱",
        ]
        
        if direction == SignalDirection.BUY:
            intro = random.choice(buy_intros)
            reason = random.choice(buy_reasons)
            emoji_dir = "🟢"
            dir_text = "BUY 做多"
        else:
            intro = random.choice(sell_intros)
            reason = random.choice(sell_reasons)
            emoji_dir = "🔴"
            dir_text = "SELL 做空"
        
        # 构建改编内容
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        
        content = f"""{intro}

{'━'*30}
{emoji_dir} XAUUSD {dir_text}
{'━'*30}
"""
        
        if signal.entry_price:
            content += f"\n📍 入场价位: {signal.entry_price}"
            if signal.entry_price_max:
                content += f" - {signal.entry_price_max}"
        
        if signal.take_profit_1:
            content += f"\n🎯 目标一 (TP1): {signal.take_profit_1}"
        if signal.take_profit_2:
            content += f"\n🎯 目标二 (TP2): {signal.take_profit_2}"
        if signal.take_profit_3:
            content += f"\n🎯 目标三 (TP3): {signal.take_profit_3}"
        if signal.stop_loss:
            content += f"\n🛑 止损位 (SL): {signal.stop_loss}"
        
        if signal.risk_reward_ratio:
            content += f"\n\n📊 风险收益比: 1:{signal.risk_reward_ratio}"
        
        content += f"""

📝 技术分析:
{reason}

{'━'*30}
⏰ {now}
⚠️ 风险提示: 交易有风险，入市需谨慎。
本信号仅供参考，不构成投资建议。
{'━'*30}"""
        
        return content
    
    def batch_rewrite(self, limit: int = 10, style: str = "professional") -> List[Dict]:
        """批量改编未发布的信号"""
        unpublished = self.db.get_unpublished_signals(limit=limit)
        results = []
        
        for row in unpublished:
            # 重建信号对象
            signal = TradingSignal(
                pair=row.get('pair', 'XAUUSD'),
                direction=SignalDirection(row.get('direction', 'BUY')),
                entry_price=row.get('entry_price'),
                entry_price_max=row.get('entry_price_max'),
                take_profit_1=row.get('take_profit_1'),
                take_profit_2=row.get('take_profit_2'),
                take_profit_3=row.get('take_profit_3'),
                stop_loss=row.get('stop_loss'),
                confidence=row.get('confidence'),
                analysis_summary=row.get('analysis_summary', ''),
                original_text=row.get('original_text', ''),
            )
            
            rewritten = self.rewrite_signal(signal, style)
            
            results.append({
                'signal_id': row['signal_id'],
                'original': row.get('original_text', ''),
                'rewritten': rewritten,
                'direction': row.get('direction'),
                'entry_price': row.get('entry_price'),
            })
        
        return results
    
    def generate_daily_report(self, signals: List[TradingSignal] = None) -> str:
        """生成每日信号汇总报告"""
        if not signals:
            recent = self.db.get_recent_signals(hours=24)
            signals_data = recent
        else:
            signals_data = [s.to_dict() for s in signals]
        
        if not signals_data:
            return "📊 今日暂无交易信号"
        
        buy_count = sum(1 for s in signals_data if s.get('direction') == 'BUY')
        sell_count = sum(1 for s in signals_data if s.get('direction') == 'SELL')
        
        report = f"""
{'═'*40}
📊 XAUUSD 每日信号汇总
{'═'*40}

📅 日期: {datetime.utcnow().strftime('%Y-%m-%d')}
📈 做多信号: {buy_count} 条
📉 做空信号: {sell_count} 条
📊 总计: {len(signals_data)} 条

{'─'*40}
"""
        
        for i, s in enumerate(signals_data[:10], 1):
            direction = s.get('direction', 'N/A')
            entry = s.get('entry_price', 'N/A')
            tp1 = s.get('take_profit_1', 'N/A')
            sl = s.get('stop_loss', 'N/A')
            source = s.get('source', 'N/A')
            
            emoji = "🟢" if direction == "BUY" else "🔴"
            
            report += f"""
{emoji} 信号 #{i}
   方向: {direction} | 入场: {entry}
   TP1: {tp1} | SL: {sl}
   来源: {source}
"""
        
        report += f"""
{'═'*40}
⚠️ 以上信号仅供参考，不构成投资建议
{'═'*40}
"""
        
        return report


def main():
    """测试信号改编器"""
    logging.basicConfig(level=logging.INFO)
    
    rewriter = SignalRewriter()
    
    # 创建测试信号
    test_signal = TradingSignal(
        pair="XAUUSD",
        direction=SignalDirection.BUY,
        entry_price=2935.50,
        take_profit_1=2950.00,
        take_profit_2=2965.00,
        take_profit_3=2980.00,
        stop_loss=2920.00,
        confidence=78.5,
        analysis_summary="Price bounced off key support at 2930",
    )
    
    # 测试各种风格
    for style in ["professional", "casual", "chinese", "premium"]:
        print(f"\n{'='*50}")
        print(f"风格: {style}")
        print(f"{'='*50}")
        rewritten = rewriter.rewrite_signal(test_signal, style)
        print(rewritten)


if __name__ == "__main__":
    main()
