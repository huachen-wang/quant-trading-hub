import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema.js";

const { strategies } = schema;

async function resetTestData() {
  console.log("[Reset] Connecting to database...");
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection, { schema, mode: "default" });

  console.log("[Reset] Deleting all strategies...");
  await connection.execute("DELETE FROM strategies");
  
  console.log("[Reset] Inserting 2 test strategies...");
  await connection.execute(`
    INSERT INTO strategies (title, description, platform, pairs, timeframe, coverImage, totalReturn, maxDrawdown, sharpeRatio, winRate, price, isFree, downloadCount, telegramGroup, qqGroup, status) VALUES 
    ('黄金趋势追踪EA', '专注于黄金市场的趋势追踪系统,使用移动平均线和动量指标识别强势趋势。适合中长线交易者,平均持仓3-7天。', 'MT5', 'XAUUSD', 'H4', 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3', '156.80', '12.30', '2.85', '68.50', '299.00', false, 245, '@GoldTrendEA', '123456789', 'published'),
    ('欧美货币对套利EA', '利用欧美主要货币对之间的相关性进行套利交易,低风险稳健策略。每月交易10-15次,适合保守型投资者。', 'MT4', 'EURUSD,GBPUSD,USDCHF', 'H1', 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44', '89.40', '8.60', '2.12', '72.30', '0.00', true, 567, '@ForexArbitrageEA', '987654321', 'published')
  `);

  console.log("[Reset] Verifying data...");
  const [rows] = await connection.execute("SELECT id, title, platform FROM strategies");
  console.log("[Reset] Current strategies:", rows);

  await connection.end();
  console.log("[Reset] Done!");
}

resetTestData().catch(console.error);
