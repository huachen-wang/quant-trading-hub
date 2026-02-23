"""
XAUUSD Signal Hub - SQLite 数据库管理
"""
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from contextlib import contextmanager

from config.settings import DATABASE_PATH
from utils.models import TradingSignal, SignalDirection, SignalStatus, SignalSource


class SignalDatabase:
    """信号数据库管理类"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or str(DATABASE_PATH)
        self._init_db()
    
    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def _init_db(self):
        """初始化数据库表"""
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS signals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    signal_id TEXT UNIQUE NOT NULL,
                    pair TEXT DEFAULT 'XAUUSD',
                    direction TEXT NOT NULL,
                    entry_price REAL,
                    entry_price_max REAL,
                    take_profit_1 REAL,
                    take_profit_2 REAL,
                    take_profit_3 REAL,
                    stop_loss REAL,
                    source TEXT NOT NULL,
                    source_channel TEXT,
                    source_message_id TEXT,
                    original_text TEXT,
                    confidence REAL,
                    timeframe TEXT,
                    analysis_summary TEXT,
                    rsi_value REAL,
                    macd_signal TEXT,
                    moving_avg_signal TEXT,
                    overall_signal TEXT,
                    status TEXT DEFAULT 'ACTIVE',
                    rewritten_text TEXT,
                    rewritten_style TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    expires_at TEXT,
                    published BOOLEAN DEFAULT 0,
                    published_at TEXT
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS market_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pair TEXT DEFAULT 'XAUUSD',
                    current_price REAL,
                    daily_change REAL,
                    daily_change_pct REAL,
                    ma_summary TEXT,
                    indicator_summary TEXT,
                    overall_summary TEXT,
                    support_1 REAL,
                    support_2 REAL,
                    resistance_1 REAL,
                    resistance_2 REAL,
                    source TEXT,
                    raw_data TEXT,
                    timestamp TEXT NOT NULL
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS crawl_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    channel TEXT,
                    status TEXT NOT NULL,
                    message_count INTEGER DEFAULT 0,
                    signal_count INTEGER DEFAULT 0,
                    error_message TEXT,
                    timestamp TEXT NOT NULL
                )
            """)
            
            # 创建索引
            conn.execute("CREATE INDEX IF NOT EXISTS idx_signals_source ON signals(source)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_signals_published ON signals(published)")
    
    def save_signal(self, signal: TradingSignal) -> bool:
        """保存信号到数据库，如果已存在则跳过"""
        with self._get_conn() as conn:
            try:
                conn.execute("""
                    INSERT OR IGNORE INTO signals (
                        signal_id, pair, direction, entry_price, entry_price_max,
                        take_profit_1, take_profit_2, take_profit_3, stop_loss,
                        source, source_channel, source_message_id, original_text,
                        confidence, timeframe, analysis_summary,
                        rsi_value, macd_signal, moving_avg_signal, overall_signal,
                        status, rewritten_text, rewritten_style,
                        created_at, updated_at, expires_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    signal.signal_id, signal.pair, signal.direction.value,
                    signal.entry_price, signal.entry_price_max,
                    signal.take_profit_1, signal.take_profit_2, signal.take_profit_3,
                    signal.stop_loss,
                    signal.source.value, signal.source_channel, signal.source_message_id,
                    signal.original_text,
                    signal.confidence, signal.timeframe, signal.analysis_summary,
                    signal.rsi_value, signal.macd_signal, signal.moving_avg_signal,
                    signal.overall_signal,
                    signal.status.value, signal.rewritten_text, signal.rewritten_style,
                    signal.created_at.isoformat(), signal.updated_at.isoformat(),
                    signal.expires_at.isoformat() if signal.expires_at else None
                ))
                return conn.total_changes > 0
            except sqlite3.IntegrityError:
                return False
    
    def get_unpublished_signals(self, limit: int = 10) -> List[dict]:
        """获取未发布的信号"""
        with self._get_conn() as conn:
            rows = conn.execute("""
                SELECT * FROM signals 
                WHERE published = 0 AND status = 'ACTIVE'
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,)).fetchall()
            return [dict(row) for row in rows]
    
    def mark_published(self, signal_id: str):
        """标记信号为已发布"""
        with self._get_conn() as conn:
            conn.execute("""
                UPDATE signals 
                SET published = 1, published_at = ?
                WHERE signal_id = ?
            """, (datetime.utcnow().isoformat(), signal_id))
    
    def get_recent_signals(self, hours: int = 24, source: str = None) -> List[dict]:
        """获取最近的信号"""
        with self._get_conn() as conn:
            query = """
                SELECT * FROM signals 
                WHERE created_at > datetime('now', ?)
            """
            params = [f'-{hours} hours']
            
            if source:
                query += " AND source = ?"
                params.append(source)
            
            query += " ORDER BY created_at DESC"
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]
    
    def get_signal_stats(self) -> dict:
        """获取信号统计"""
        with self._get_conn() as conn:
            total = conn.execute("SELECT COUNT(*) FROM signals").fetchone()[0]
            by_source = conn.execute("""
                SELECT source, COUNT(*) as count 
                FROM signals GROUP BY source
            """).fetchall()
            by_direction = conn.execute("""
                SELECT direction, COUNT(*) as count 
                FROM signals GROUP BY direction
            """).fetchall()
            recent_24h = conn.execute("""
                SELECT COUNT(*) FROM signals 
                WHERE created_at > datetime('now', '-24 hours')
            """).fetchone()[0]
            
            return {
                "total_signals": total,
                "by_source": {row['source']: row['count'] for row in by_source},
                "by_direction": {row['direction']: row['count'] for row in by_direction},
                "last_24h": recent_24h,
            }
    
    def log_crawl(self, source: str, channel: str, status: str,
                  message_count: int = 0, signal_count: int = 0, error: str = None):
        """记录爬取日志"""
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO crawl_log (source, channel, status, message_count, signal_count, error_message, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (source, channel, status, message_count, signal_count, error, datetime.utcnow().isoformat()))
    
    def signal_exists(self, source: str, source_message_id: str) -> bool:
        """检查信号是否已存在"""
        with self._get_conn() as conn:
            row = conn.execute("""
                SELECT 1 FROM signals 
                WHERE source = ? AND source_message_id = ?
                LIMIT 1
            """, (source, source_message_id)).fetchone()
            return row is not None
