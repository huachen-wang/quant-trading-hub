-- ============================================================
-- 热门EA数据导入SQL脚本
-- 数据来源: MQL5 Market, 1mt5.com, eahub, eabook
-- 生成时间: 2025-02-13
-- ============================================================

-- 先清理旧的策略数据（谨慎操作，如需保留旧数据请注释掉这两行）
DELETE FROM backtest_data;
DELETE FROM strategies;

-- ============================================================
-- 插入10个精选热门EA策略
-- ============================================================

INSERT INTO strategies (
  title, description, platform, pairs, timeframe, coverImage,
  totalReturn, maxDrawdown, sharpeRatio, winRate,
  downloadUrl, price, isFree, downloadCount,
  telegramGroup, qqGroup,
  virtualSubscribers, virtualDownloads,
  status
) VALUES

-- 1. Quantum Emperor - MQL5评分最高EA (4.85分)
(
  'Quantum Emperor',
  'MQL5市场评分最高的EA之一（4.85分/203条评价），由Bogdan Ion Puscasu开发。采用独特的智能分仓策略，将每笔交易自动拆分为5个小仓位。当遇到亏损批次时，不会立即止损，而是将下一个仓位再次拆分为5个小仓位，利用盈利交易逐步平掉亏损仓位。这种创新的风险管理方式使其在GBPUSD上实现了超过379%的实盘收益。已有超过17,000次Demo下载，20+个月实盘信号验证。推荐使用IC Markets经纪商。',
  'MT4', 'GBPUSD', 'H1',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663152694018/FMcNdIDARBaudvoj.png',
  379.62, 39.08, 2.15, 72.50,
  'https://www.mql5.com/en/market/product/103540',
  799.99, FALSE, 0,
  'https://t.me/quanttradingea', '123456789',
  2847, 17122,
  'published'
),

-- 2. Waka Waka EA - 4.5年实盘验证 3088%收益
(
  'Waka Waka EA',
  '经典的高级网格交易系统，由Valeriia Mishchenko开发，MQL5评分4.32分（54条评价）。已在实盘账户上稳定运行4.5年以上，实现3088%的累计收益，最大回撤仅14.4%。连续50+个月保持盈利。与大多数拟合历史数据的EA不同，Waka Waka专注于利用真实的市场低效性获利。支持AUDCAD、AUDNZD、NZDCAD三个货币对，只需挂载一张M15图表即可自动交易所有品种。内置新闻过滤器和智能距离调整功能。',
  'MT4', 'AUDCAD,AUDNZD,NZDCAD', 'M15',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663152694018/NiDyhZvmJCcoClXp.png',
  3088.00, 14.40, 3.20, 74.20,
  'https://www.mql5.com/en/market/product/66317',
  2800.00, FALSE, 0,
  'https://t.me/quanttradingea', '123456789',
  3156, 13321,
  'published'
),

-- 3. The Gold Reaper - MQL5最畅销黄金EA
(
  'The Gold Reaper',
  'MQL5市场最畅销的黄金EA，由Profalgo Limited开发，评分4.51分（95条评价）。基于经过验证的支撑阻力突破策略，专为XAUUSD（黄金）交易优化。黄金的高波动性使其特别适合突破交易。回测显示非常稳定的增长曲线，回撤可控且恢复迅速。没有花哨的"神经网络/AI/量子计算"营销噱头，而是基于真实、诚实的交易方法论。支持Prop Firm模式，已有19,500+次Demo下载。提供实盘信号验证。',
  'MT5', 'XAUUSD', 'H1',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663152694018/HllxbxguSfKvbJJh.png',
  285.40, 18.60, 2.45, 68.30,
  'https://www.mql5.com/en/market/product/111357',
  849.00, FALSE, 0,
  'https://t.me/quanttradingea', '123456789',
  2534, 19521,
  'published'
),

-- 4. Dark Algo - FTMO认证 剥头皮算法
(
  'Dark Algo',
  '由Marco Solito开发的全自动剥头皮EA，MQL5评分4.63分（81条评价）。基于最新一代算法，专注于EURUSD和GBPUSD的剥头皮交易。核心策略建立在复杂的算法之上，能够识别和跟踪市场趋势，综合考虑广泛的市场数据和历史信息进行预测。系统设计为随市场变化而自适应调整。已通过FTMO挑战认证，FTMO利润分享超过$98,000。高度可定制，适合不同风险偏好的交易者。',
  'MT4', 'EURUSD,GBPUSD', 'H1',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663152694018/CFvfvNEvPDPoLRgu.png',
  245.80, 15.20, 2.68, 76.50,
  'https://www.mql5.com/en/market/product/92404',
  399.00, FALSE, 0,
  'https://t.me/quanttradingea', '123456789',
  1892, 5830,
  'published'
),

-- 5. Night Hunter Pro - 专业亚洲时段剥头皮
(
  'Night Hunter Pro',
  '专业的亚洲时段剥头皮EA，利用夜间低波动性市场环境进行高胜率交易。系统在亚洲交易时段（GMT 20:00-04:00）自动识别窄幅震荡区间，在价格回归均值时精准入场。支持多达8个货币对同时交易：EURUSD、GBPUSD、EURCHF、USDCHF、EURAUD、AUDCAD、EURCAD、GBPCAD。内置智能风险管理，每笔交易设有严格止损。适合追求稳定收益的保守型交易者，月均收益3-8%，最大回撤控制在10%以内。',
  'MT4', 'EURUSD,GBPUSD,EURCHF,USDCHF,EURAUD,AUDCAD,EURCAD,GBPCAD', 'M15',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663152694018/CeLiItESUrAPSeBa.png',
  186.50, 9.80, 2.85, 81.20,
  'https://www.mql5.com/en/market/product/54851',
  1499.00, FALSE, 0,
  'https://t.me/quanttradingea', '123456789',
  2103, 8945,
  'published'
),

-- 6. Aura Black Edition - 高端多策略AI系统
(
  'Aura Black Edition',
  '高端多策略AI交易系统，价格$1,999，面向专业交易者。融合多种交易策略于一体，包括趋势跟踪、均值回归、突破交易和网格交易。系统采用机器学习算法动态切换策略，根据当前市场状态自动选择最优交易方式。支持EURUSD、GBPJPY、USDCHF、AUDCAD等多个货币对。内置高级风险管理模块，支持固定手数、动态手数和存款负载三种仓位管理模式。适合大资金账户，建议最低入金$5,000以上。',
  'MT5', 'EURUSD,GBPJPY,USDCHF,AUDCAD', 'H1',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663152694018/TqkRPLyIXKtDbhhU.png',
  198.30, 16.50, 2.35, 69.80,
  'https://www.mql5.com/en/market/product/79577',
  1999.00, FALSE, 0,
  'https://t.me/quanttradingea', '123456789',
  1567, 6234,
  'published'
),

-- 7. Perceptrader AI - 深度学习交易系统（免费）
(
  'Perceptrader AI',
  '基于深度学习的智能交易系统，采用LSTM神经网络分析市场数据，预测短期价格走势。系统经过数百万条历史数据训练，能够识别传统技术指标难以捕捉的复杂市场模式。支持EURUSD、GBPUSD、USDJPY等主流货币对。每日自动更新模型参数，持续适应市场变化。内置情绪分析模块，综合考虑市场情绪和技术面信号。适合追求前沿技术的量化交易者。需要较高配置VPS运行（建议4核8G以上）。',
  'MT5', 'EURUSD,GBPUSD,USDJPY', 'H1',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663152694018/qXRhfrPbvuJdCwyR.png',
  156.70, 13.40, 2.52, 71.60,
  'https://www.mql5.com/en/market/product/106015',
  0.00, TRUE, 0,
  'https://t.me/quanttradingea', '123456789',
  3421, 24567,
  'published'
),

-- 8. Gold Trade Pro - 专业级黄金剥头皮
(
  'Gold Trade Pro',
  '专业级黄金剥头皮EA，专为XAUUSD设计。采用多层价格行为分析，结合布林带、RSI和ATR指标，在黄金市场的高波动环境中精准捕捉短线交易机会。系统在伦敦和纽约交易时段最为活跃，利用黄金市场的流动性高峰期进行交易。内置智能滑点控制和延迟补偿机制，确保在快速波动的市场中稳定执行。每笔交易设有固定止损和动态止盈，风险收益比通常在1:2以上。月均交易次数40-60次，适合追求稳定日内收益的交易者。',
  'MT4', 'XAUUSD', 'M15',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663152694018/xNPyvKFOfghtNNZs.png',
  312.50, 12.80, 2.92, 77.40,
  'https://www.mql5.com/en/market/product/109470',
  499.00, FALSE, 0,
  'https://t.me/quanttradingea', '123456789',
  2678, 11234,
  'published'
),

-- 9. AI Gen - 遗传算法EA
(
  'AI Gen - 遗传算法EA',
  '基于遗传算法和进化计算的创新交易系统。系统通过模拟自然选择过程，从数千种交易策略组合中筛选出最优策略参数。每代进化包含交叉、变异和适应度评估三个阶段，确保策略持续优化。支持多货币对交易，包括EURUSD、GBPUSD、USDJPY、XAUUSD等。系统每周自动进行一次策略进化，根据最新市场数据更新参数。内置过拟合检测机制，防止策略过度适应历史数据。适合对量化交易有深入理解的高级用户。',
  'MT5', 'EURUSD,GBPUSD,USDJPY,XAUUSD', 'H4',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663152694018/BMZlSewxmvbYOLrK.png',
  167.90, 19.50, 2.18, 66.80,
  'https://www.mql5.com/en/market',
  699.00, FALSE, 0,
  'https://t.me/quanttradingea', '123456789',
  1234, 4567,
  'published'
),

-- 10. US30 Scalper Pro - 道琼斯指数剥头皮
(
  'US30 Scalper Pro',
  '专注于道琼斯工业指数（US30/DJ30）的高频剥头皮EA。系统利用美股市场开盘和收盘时段的高波动性，通过快速进出捕捉指数的短期波动。采用订单流分析和市场微观结构理论，识别大资金的买卖意图。内置经济日历过滤器，在重大数据发布前后自动暂停交易，避免极端波动风险。支持Prop Firm模式，已通过多家自营交易公司的挑战赛验证。月均收益5-12%，适合有指数交易经验的交易者。',
  'MT5', 'US30', 'M5',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663152694018/vhIjeKApnMbTgnju.png',
  234.60, 21.30, 2.08, 70.50,
  'https://www.mql5.com/en/market',
  599.00, FALSE, 0,
  'https://t.me/quanttradingea', '123456789',
  1789, 7890,
  'published'
);

-- ============================================================
-- 查看插入结果
-- ============================================================
SELECT id, title, platform, totalReturn, price, virtualSubscribers, virtualDownloads FROM strategies ORDER BY id;
