import mysql from "mysql2/promise";

// 生成指定策略的回测数据
async function generateBacktestData(
  conn: mysql.Connection,
  strategyId: number,
  baseReturn: number,
  volatility: number,
  days: number = 180
) {
  const data = [];
  let equity = 10000; // 初始权益
  let balance = 10000;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    // 随机日收益率
    const dailyReturn = (baseReturn / 365) + (Math.random() - 0.5) * volatility;
    const profit = equity * (dailyReturn / 100);
    
    equity += profit;
    balance += profit;
    
    // 计算回撤
    const maxEquity = Math.max(...data.map(d => parseFloat(d.equity)), equity);
    const drawdown = ((maxEquity - equity) / maxEquity) * 100;
    
    // 随机交易次数
    const tradesCount = Math.floor(Math.random() * 5);
    
    data.push({
      strategyId,
      date: date.toISOString().split('T')[0],
      equity: equity.toFixed(2),
      balance: balance.toFixed(2),
      profit: profit.toFixed(2),
      drawdown: drawdown.toFixed(2),
      tradesCount,
    });
  }

  // 批量插入
  const values = data.map(d => [
    d.strategyId,
    d.date,
    d.equity,
    d.balance,
    d.profit,
    d.drawdown,
    d.tradesCount,
  ]);

  await conn.query(
    `INSERT INTO backtest_data (strategyId, date, equity, balance, profit, drawdown, tradesCount) 
     VALUES ?`,
    [values]
  );

  console.log(`✓ Generated ${days} days of backtest data for strategy ${strategyId}`);
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  try {
    // 获取所有策略
    const [strategies] = await conn.query<any[]>('SELECT id, totalReturn FROM strategies');

    for (const strategy of strategies) {
      const totalReturn = parseFloat(strategy.totalReturn || '50');
      const volatility = Math.abs(totalReturn) * 0.1; // 波动率为总收益的10%
      
      await generateBacktestData(conn, strategy.id, totalReturn, volatility, 180);
    }

    console.log('✅ All backtest data generated successfully!');
  } catch (error) {
    console.error('❌ Error generating backtest data:', error);
  } finally {
    await conn.end();
  }
}

main();
