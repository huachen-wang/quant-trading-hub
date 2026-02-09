import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";

const { strategies, backtestData } = schema;

// 新的EA策略数据
const newStrategies = [
  {
    title: "黄金智能交易系统",
    description: "专为XAUUSD设计的智能交易EA,采用先进的技术分析和风险管理策略。系统结合移动平均线、RSI和MACD指标,在黄金市场波动中捕捉最佳交易机会。内置智能止损和止盈机制,有效控制风险。适合中长期持仓,稳定盈利。",
    platform: "MT4",
    pairs: "XAUUSD",
    timeframe: "H1",
    totalReturn: 145.8,
    winRate: 72.5,
    maxDrawdown: 18.3,
    sharpeRatio: 2.1,
    price: 0,
    downloadCount: 0,
    purchaseCount: 0,
    status: "published",
    coverImage: "https://private-us-east-1.manuscdn.com/sessionFile/V69mksYiAfXPuFAsMP0jkU/sandbox/CulTSqCn8LV4iGyV1psnD0-img-1_1770612804000_na1fn_ZWEtY292ZXItMQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvVjY5bWtzWWlBZlhQdUZBc01QMGprVS9zYW5kYm94L0N1bFRTcUNuOExWNGlHeVYxcHNuRDAtaW1nLTFfMTc3MDYxMjgwNDAwMF9uYTFmbl9aV0V0WTI5MlpYSXRNUS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=V33agqDlgksxT-lFGLUURzbLmDo-MFI27ZsU7YQZcSKuD-lVy8YV5~kAsvuiGMCAC8Sydyf7tj7xszsf4cxWUbFXeanWijHP5hbLO0kn9t~sMZGidxoQhmdxE6ZR9m7CHHJsfpL6TyXKVnyZNxWYVVzVJuiotuiXf8sbGc3clP~E4wuXP3bhu73vcSKslt5MEzVmpJUAM-Dk5-3qnUpMuYLaADKSgsfzQRzGNX--sYvGI2PYxcW47m2MP~WdWpr14oE24ljbDMC88kzpC0lvpCLgAX3nbWbJAx4I~uft0kXgjTL38KjmIuwA4BQ8uLMb3tiYLm-DStKXGRMcyfdpaw__",
    telegramGroup: "https://t.me/goldea_trading",
    qqGroup: "888888888",
  },
  {
    title: "欧美剥头皮专家",
    description: "专注于EUR/USD货币对的高频剥头皮策略。采用先进的价格行为分析和订单流技术,在1-5分钟内完成交易。系统具有极高的胜率和快速的盈利能力。内置智能滑点控制和延迟补偿机制,确保在高波动环境下稳定运行。适合追求快速收益的交易者。",
    platform: "MT5",
    pairs: "EURUSD",
    timeframe: "M5",
    totalReturn: 198.6,
    winRate: 78.2,
    maxDrawdown: 12.5,
    sharpeRatio: 2.8,
    price: 399,
    downloadCount: 0,
    purchaseCount: 0,
    status: "published",
    coverImage: "https://private-us-east-1.manuscdn.com/sessionFile/V69mksYiAfXPuFAsMP0jkU/sandbox/CulTSqCn8LV4iGyV1psnD0-img-2_1770612805000_na1fn_ZWEtY292ZXItMg.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvVjY5bWtzWWlBZlhQdUZBc01QMGprVS9zYW5kYm94L0N1bFRTcUNuOExWNGlHeVYxcHNuRDAtaW1nLTJfMTc3MDYxMjgwNTAwMF9uYTFmbl9aV0V0WTI5MlpYSXRNZy5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=hHbBKiSe6J-bPodMmHYXR8Hw1XK65KfaO4pz15JEyHaYo5lsd1PTV-H5OpNosU6ZjVyc5hNjVuBlYPW7Pit-KkLThxJ-vbN9VyJgmA219SuRtHCUHIoEaR812zQ8H5RDMUlwReXD5nK26YWlV-cEYY1xfxrTwxQsSctssBZe4dxwl4~WrKzF9Pfqej8wc9PlBhTxdLEvgQd0sclrwmLh2M2BfYJdAUX4HWw4KbDl9yzeOhKoZXJuPxgLcSIhzq~k1ODH19KaierkJ0PP9umDOJhQtWzwdjTN3wgN0dyHp73ljCXfiJnF-tBOWvEVUIR89PZYGwcVxi~gB4XAU233QQ__",
    telegramGroup: "https://t.me/eurscalper_pro",
    qqGroup: "999999999",
  },
  {
    title: "多货币网格交易机器人",
    description: "创新的网格交易策略,支持多个货币对同时运行。系统在预设的价格区间内自动建立买卖网格,通过频繁的小额交易累积利润。特别适合震荡市场,无需预测方向。内置动态网格调整功能,根据市场波动自动优化网格间距。低风险,稳定收益。",
    platform: "MT4",
    pairs: "MULTIPLE",
    timeframe: "H4",
    totalReturn: 112.3,
    winRate: 85.6,
    maxDrawdown: 15.2,
    sharpeRatio: 1.9,
    price: 599,
    downloadCount: 0,
    purchaseCount: 0,
    status: "published",
    coverImage: "https://private-us-east-1.manuscdn.com/sessionFile/V69mksYiAfXPuFAsMP0jkU/sandbox/CulTSqCn8LV4iGyV1psnD0-img-3_1770612811000_na1fn_ZWEtY292ZXItMw.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvVjY5bWtzWWlBZlhQdUZBc01QMGprVS9zYW5kYm94L0N1bFRTcUNuOExWNGlHeVYxcHNuRDAtaW1nLTNfMTc3MDYxMjgxMTAwMF9uYTFmbl9aV0V0WTI5MlpYSXRNdy5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=fijbnmFwzZYrxnzU26P62by~g4Y9AmcYSf1PtPZ3l3BiDPWmPit-TkmpIeb0xpoxvuJ2KzEAn7gcVgi1yrH95vksaqHgGws8-9pADon3aGskAyCB8LwjJFR41KCu8iwAQ4BEBpS8pFuDFXgwkI97UnvZD0mLtC6whRHhdrC-DImitsgn2jOfA8~sF8NxRro5ldKdz2WFDxDBZZbWVSj6uIj132hfUKZv3-esayVL8l1GS0MeRHNdhuMzuucb01dyJC02kchFnI~gTcBA74t1oSlyaSwcuDu4s1hLbXr-5Klt2dkcD4w-W6qOCj1~9nUQTfB3p-Wi0e5WE9Du3hwXcQ__",
    telegramGroup: "https://t.me/grid_master_ea",
    qqGroup: "777777777",
  },
  {
    title: "英镑趋势追踪者",
    description: "专为GBP/USD设计的趋势跟踪系统。采用多重时间框架分析,准确识别市场趋势方向。系统使用EMA 200和MACD指标确认趋势,只在强势趋势中开仓。内置移动止损功能,最大化趋势利润。适合中长线交易者,追求大幅度盈利。",
    platform: "MT5",
    pairs: "GBPUSD",
    timeframe: "H4",
    totalReturn: 167.9,
    winRate: 68.4,
    maxDrawdown: 22.1,
    sharpeRatio: 2.3,
    price: 499,
    downloadCount: 0,
    purchaseCount: 0,
    status: "published",
    coverImage: "https://private-us-east-1.manuscdn.com/sessionFile/V69mksYiAfXPuFAsMP0jkU/sandbox/CulTSqCn8LV4iGyV1psnD0-img-4_1770612809000_na1fn_ZWEtY292ZXItNA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvVjY5bWtzWWlBZlhQdUZBc01QMGprVS9zYW5kYm94L0N1bFRTcUNuOExWNGlHeVYxcHNuRDAtaW1nLTRfMTc3MDYxMjgwOTAwMF9uYTFmbl9aV0V0WTI5MlpYSXROQS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=d23OMjqtZpqgNlgwuawWYb8-FbUrerPzDF7VxjytAlVSoY42-xP1humBLpr4P5MMXyLR-oNaEGC4yzuFF5s0yUkbCdmSlhnkcLToZwoF0eEyA-LAvV9gPCFzuHaDvfMl2cSBmBsaIh4cF83COte8YzDKaKgVR~Pgz44H3YE8HdEf1kcJptGr5fsu0QGvY~O-KvhiSvngWcm4Ld6tclhaEIPefo7O0aMpX0kvZQl9xhBHt0ew4DC0n5llbkgwoSoMBUK~zo0Oymo-kceKeawJHHiioxBDj~IqO8R7skSyNs-wm-s5WsQjHCQNjC44zl8RA77ulUkwzRzqV6ydYfIDgw__",
    telegramGroup: "https://t.me/gbp_trend_follower",
    qqGroup: "666666666",
  },
  {
    title: "AI深度学习交易系统",
    description: "采用最新人工智能和深度学习技术的革命性EA。系统通过神经网络分析历史数据和实时市场信息,自动识别交易机会。具备自我学习和优化能力,随着时间推移不断提升表现。支持多个货币对,适应不同市场环境。代表未来交易技术的方向。",
    platform: "MT5",
    pairs: "MULTIPLE",
    timeframe: "M15",
    totalReturn: 223.4,
    winRate: 74.8,
    maxDrawdown: 16.7,
    sharpeRatio: 3.1,
    price: 899,
    downloadCount: 0,
    purchaseCount: 0,
    status: "published",
    coverImage: "https://private-us-east-1.manuscdn.com/sessionFile/V69mksYiAfXPuFAsMP0jkU/sandbox/CulTSqCn8LV4iGyV1psnD0-img-5_1770612807000_na1fn_ZWEtY292ZXItNQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvVjY5bWtzWWlBZlhQdUZBc01QMGprVS9zYW5kYm94L0N1bFRTcUNuOExWNGlHeVYxcHNuRDAtaW1nLTVfMTc3MDYxMjgwNzAwMF9uYTFmbl9aV0V0WTI5MlpYSXROUS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=rsVffBHi0xPn72ppDEG-pF~~yTeTm1IZrros0IOCZlWK6aW24rfX-1zt67aEv5QIG~jXUaslmGO5AQb1d2RMZx1y14m2ooDTt40rDjBy6J-OSphFKeBVF98jgh2stcRWXKec0pD2M6JApU8r~8M~SVYSF4Bczfv5c8Ajvh1nBKZACufzzmb5LFk25C9R8wzjTzozP6iYl2lkvLjiI1P1r1S5YTpCAJGxJMaCFewhM~TKgxZTSJYtQGZqhq-w6uvz7H8YuSxvgqXVZW3JulK71L9QOxafGbZuc27dfHUmtvh2nvUfk5ZrUUmh92bzDotjnqvtN7hB6JLe8EeX7sSoFQ__",
    telegramGroup: "https://t.me/ai_trading_system",
    qqGroup: "555555555",
  },
  {
    title: "突破猎手Pro",
    description: "专注于捕捉关键价格突破的高效EA。系统识别重要支撑和阻力位,在价格突破时快速进场。采用成交量确认和动量指标过滤假突破。内置快速止损和追踪止盈机制,确保风险可控的同时最大化利润。适合激进型交易者。",
    platform: "MT4",
    pairs: "XAUUSD",
    timeframe: "M30",
    totalReturn: 189.2,
    winRate: 71.3,
    maxDrawdown: 19.8,
    sharpeRatio: 2.6,
    price: 549,
    downloadCount: 0,
    purchaseCount: 0,
    status: "published",
    coverImage: "https://private-us-east-1.manuscdn.com/sessionFile/V69mksYiAfXPuFAsMP0jkU/sandbox/8s9Uc0KG5IOnDYwuZJjkb4-img-1_1770612874000_na1fn_ZWEtY292ZXItNg.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvVjY5bWtzWWlBZlhQdUZBc01QMGprVS9zYW5kYm94LzhzOVVjMEtHNUlPbkRZd3VaSmprYjQtaW1nLTFfMTc3MDYxMjg3NDAwMF9uYTFmbl9aV0V0WTI5MlpYSXROZy5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=MN-Vy6LWpWor1CGvIzoX9zrSio5JCCQz-i412xMt3q~TIb2-HZDC88lKvdIlLSEw4xIEMS5N3NqnKSAkI-V-Uheay6noecl~WC35pW0hoDwyuGcAuLHiusHOwy1~QSavBUbMCmYOCyP3ELeOP6v1K8LOyoGBOGek1nBeLXsWR3AR-dg~ZXHj0Ii6YpmW7F5BLsIgBssYNXlUEXEFXR8AGcwxSC2TEGJdb14IV3Oh1E-yY3HCzLrh0-KBKRxg7UJrs9H2RQod8fuqNxG5EnO2ANRbtadGL54p9~H265IP7jGzB3DS0yOXMfLcCh4BYU0zUbg~YPGDFoaGJL3OBN2cMw__",
    telegramGroup: "https://t.me/breakout_hunter",
    qqGroup: "444444444",
  },
  {
    title: "对冲大师EA",
    description: "专业的对冲交易策略,通过同时持有相反方向的仓位来降低风险。系统智能管理多个货币对的对冲组合,在市场波动中保持稳定收益。特别适合风险厌恶型交易者和大资金账户。内置动态仓位管理和风险平衡算法。",
    platform: "MT5",
    pairs: "MULTIPLE",
    timeframe: "H1",
    totalReturn: 98.7,
    winRate: 82.1,
    maxDrawdown: 11.3,
    sharpeRatio: 2.4,
    price: 699,
    downloadCount: 0,
    purchaseCount: 0,
    status: "published",
    coverImage: "https://private-us-east-1.manuscdn.com/sessionFile/V69mksYiAfXPuFAsMP0jkU/sandbox/8s9Uc0KG5IOnDYwuZJjkb4-img-2_1770612862000_na1fn_ZWEtY292ZXItNw.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvVjY5bWtzWWlBZlhQdUZBc01QMGprVS9zYW5kYm94LzhzOVVjMEtHNUlPbkRZd3VaSmprYjQtaW1nLTJfMTc3MDYxMjg2MjAwMF9uYTFmbl9aV0V0WTI5MlpYSXROdy5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=pmR1Pyr2rO7IMJ-YaCAq6FqPMYfCFi37WnMEJ9FJowWNNIJ-G~s9gapf6qAK4IXRm7ytWwB6pQ7nAzpPDm6avoV20j81v1qUhMcg1qJdhRRkkTa5kr2esEK0XiyraF-gu5K2g5am0VGDMM8xi4bH4kc1fkwrfZHLpbMhU0tauCXzkp5zYp3KnhNSjLkwUwX2VHJW8LR7T0Wixkybk~4vKr1kbrQOPRQmnZn~pwU3PybP6e9LfKs8uNy7q21ZnG3b5kuPgCIsZUvOWeY7vYn2sHqdXNNwVKdxlNQYhCPwwVcfrlxvdSDnm61gaQmGmHuUrUHg7FsCyAMI6aD2ugt-Vw__",
    telegramGroup: "https://t.me/hedge_master_ea",
    qqGroup: "333333333",
  },
  {
    title: "新闻交易闪电EA",
    description: "专为重大经济数据发布设计的新闻交易EA。系统在非农、利率决议等重大新闻发布时自动交易,捕捉市场剧烈波动带来的机会。采用挂单策略和快速执行技术,确保在价格快速变动时及时进场。高风险高收益,适合经验丰富的交易者。",
    platform: "MT4",
    pairs: "EURUSD",
    timeframe: "M1",
    totalReturn: 256.3,
    winRate: 65.7,
    maxDrawdown: 28.4,
    sharpeRatio: 2.2,
    price: 799,
    downloadCount: 0,
    purchaseCount: 0,
    status: "published",
    coverImage: "https://private-us-east-1.manuscdn.com/sessionFile/V69mksYiAfXPuFAsMP0jkU/sandbox/8s9Uc0KG5IOnDYwuZJjkb4-img-3_1770612858000_na1fn_ZWEtY292ZXItOA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvVjY5bWtzWWlBZlhQdUZBc01QMGprVS9zYW5kYm94LzhzOVVjMEtHNUlPbkRZd3VaSmprYjQtaW1nLTNfMTc3MDYxMjg1ODAwMF9uYTFmbl9aV0V0WTI5MlpYSXRPQS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=OStYMs8x9pNMhAKQQxoN~XUs8smwwmFknhS1DVB7KRcaXJGR1QD1CfzdnQsmZRbJX-e~QwgmhTIQx8AFGiOR4Q70JwcOqLFHzncF18q3kn~n~sy1MnpXnvWHI42094nkjBuUncZgSkM~eA3-2eTFx8Yle-sKs~we3sqI7LBzxDG-ibzqFa-lCVmUHDMAQLHTH4yGiUkaUJxu8E4kq5yqerqzRs-sl66vN1pI4BzOvet5cgB5463W2gzETYhcTYWnc0y8Sd3C880iJz~K4RaiMvyJnSiBRFiEJuhcR3T0P3vbkBxCdd9W-bLXliF2DsHMuuaaC3WbyBCglStGmd3vyg__",
    telegramGroup: "https://t.me/news_trader_ea",
    qqGroup: "222222222",
  },
  {
    title: "马丁格尔增强版",
    description: "改良的马丁格尔策略,结合智能风险管理。系统在亏损时按照优化的倍数增加仓位,但设有严格的最大加仓次数限制。采用趋势过滤和时间过滤,避免在不利市场环境下交易。适合有一定风险承受能力的交易者,需要充足的账户资金。",
    platform: "MT5",
    pairs: "GBPUSD",
    timeframe: "M15",
    totalReturn: 178.5,
    winRate: 76.9,
    maxDrawdown: 32.6,
    sharpeRatio: 1.8,
    price: 449,
    downloadCount: 0,
    purchaseCount: 0,
    status: "published",
    coverImage: "https://private-us-east-1.manuscdn.com/sessionFile/V69mksYiAfXPuFAsMP0jkU/sandbox/8s9Uc0KG5IOnDYwuZJjkb4-img-4_1770612868000_na1fn_ZWEtY292ZXItOQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvVjY5bWtzWWlBZlhQdUZBc01QMGprVS9zYW5kYm94LzhzOVVjMEtHNUlPbkRZd3VaSmprYjQtaW1nLTRfMTc3MDYxMjg2ODAwMF9uYTFmbl9aV0V0WTI5MlpYSXRPUS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=freetPvOam80Fnv7fcf6qa9VXe77Xi97UzY7ho1RCS9KMeljbs5fz24VznCPHqbD7IzQjfkel2VlUWpDLHkkZTg8kW6dT5W1GmPddS2219gAz54O4x4W9jhN4qiJnCopo16YLGhUWxwlTDhNEjqG11cytswlcg08gHZSvoF8ytUUbMI4rg52Bbjw9mcrhnavpRIHw98vO4rMRdvPnbMU16GSwTSuoXomTSIjgHEcKZzCbFsrEc5LaqD50xFFCkoeh4dYhkiwwxxNz5OnQyGzKUrIiUwCjHiQ-u~0TiZOn-AcTKNRs5mEakeYnqxWq7r18hfWUKbO9Qhqtev5kKudNg__",
    telegramGroup: "https://t.me/martingale_pro",
    qqGroup: "111111111",
  },
  {
    title: "稳健波段交易EA",
    description: "保守型波段交易策略,专注于捕捉中期价格波动。系统采用多重技术指标确认入场信号,只在高概率机会时交易。风险管理严格,每笔交易风险控制在1-2%。适合追求稳定收益、不愿承担高风险的长期投资者。年化收益稳定可靠。",
    platform: "MT4",
    pairs: "EURUSD",
    timeframe: "D1",
    totalReturn: 87.6,
    winRate: 79.3,
    maxDrawdown: 9.8,
    sharpeRatio: 2.7,
    price: 0,
    downloadCount: 0,
    purchaseCount: 0,
    status: "published",
    coverImage: "https://private-us-east-1.manuscdn.com/sessionFile/V69mksYiAfXPuFAsMP0jkU/sandbox/8s9Uc0KG5IOnDYwuZJjkb4-img-5_1770612867000_na1fn_ZWEtY292ZXItMTA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvVjY5bWtzWWlBZlhQdUZBc01QMGprVS9zYW5kYm94LzhzOVVjMEtHNUlPbkRZd3VaSmprYjQtaW1nLTVfMTc3MDYxMjg2NzAwMF9uYTFmbl9aV0V0WTI5MlpYSXRNVEEucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=ZWpH2eI5WeL9daTsZ19K4qhnGgRXY8vhPoe-MFeLbJt84XsHJNT0Jea5yqgF7PplX5qFxvgELN~ksjUQBKPx0JsNejQ~JK6Ex~lYxWEnqdPEMM-LWWDjA1kMaBDzlvd1t49sSa-Pu67FDGt341nGH-kwz-NWmq4f5axC-DeUg9n3RZjt20RjPupm9zGQ-pjPiDACpZXep8NuCIX85hcdCgi-EroGKg0gu2S33b~X6WEXqZ4vofJrJwYp3vWhH-W2oawp8qbvUf~AkJB5uK9fU2glzfeg3zjvKXwKQRrg8OmMPWeEq2gb4pUU2XQoNSSUWaBhHWBNx6uGN5U6krCxHA__",
    telegramGroup: "https://t.me/swing_trader_ea",
    qqGroup: "123456789",
  },
];

// 生成回测数据的函数
function generateBacktestData(strategyId: number, totalReturn: number) {
  const data = [];
  const days = 180;
  let equity = 10000;
  let balance = 10000;
  let previousEquity = equity;
  let maxEquity = equity;
  
  // 计算每日平均增长率
  const dailyGrowth = Math.pow(1 + totalReturn / 100, 1 / days) - 1;
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    
    // 添加随机波动
    const randomFactor = 1 + (Math.random() - 0.5) * 0.02;
    equity = equity * (1 + dailyGrowth * randomFactor);
    
    // 计算当日盈亏
    const dailyProfit = equity - previousEquity;
    
    // 更新余额
    balance = equity;
    
    // 计算回撤
    if (equity > maxEquity) {
      maxEquity = equity;
    }
    const drawdown = ((maxEquity - equity) / maxEquity) * 100;
    
    // 随机交易次数(0-5次)
    const tradesCount = Math.floor(Math.random() * 6);
    
    data.push({
      strategyId,
      date: new Date(date.toISOString().split('T')[0]),
      equity: (Math.round(equity * 100) / 100).toFixed(2),
      balance: (Math.round(balance * 100) / 100).toFixed(2),
      profit: (Math.round(dailyProfit * 100) / 100).toFixed(2),
      drawdown: (Math.round(drawdown * 100) / 100).toFixed(2),
      tradesCount,
    });
    
    previousEquity = equity;
  }
  
  return data;
}

export async function seedNewStrategies() {
  // 初始化数据库连接
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection, { schema, mode: "default" });
  
  console.log("开始清理旧数据...");
  
  // 清理旧的回测数据
  await db.delete(backtestData);
  
  // 清理旧的策略数据
  await db.delete(strategies);
  
  console.log("开始插入新策略数据...");
  
  // 插入新策略
  for (const strategy of newStrategies) {
    const result = await db.insert(strategies).values(strategy);
    const strategyId = Number(result[0].insertId);
    console.log(`已插入策略: ${strategy.title} (ID: ${strategyId})`);
    
    // 为每个策略生成回测数据
    const backtestDataPoints = generateBacktestData(strategyId, strategy.totalReturn);
    await db.insert(backtestData).values(backtestDataPoints);
    console.log(`已为策略 ${strategy.title} 生成 ${backtestDataPoints.length} 条回测数据`);
  }
  
  console.log("新策略数据插入完成!");
}

// 如果直接运行此文件,执行种子数据插入
if (require.main === module) {
  seedNewStrategies()
    .then(() => {
      console.log("数据库种子数据更新成功");
      process.exit(0);
    })
    .catch((error) => {
      console.error("数据库种子数据更新失败:", error);
      process.exit(1);
    });
}
