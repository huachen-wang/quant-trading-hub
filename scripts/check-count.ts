import mysql from 'mysql2/promise';

async function checkCount() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await conn.execute('SELECT COUNT(*) as count FROM strategies') as any;
  console.log('Total strategies in database:', rows[0].count);
  
  const [strategies] = await conn.execute('SELECT id, title, platform FROM strategies ORDER BY id') as any;
  console.log('\nStrategies:');
  strategies.forEach((s: any) => {
    console.log(`  ${s.id}. ${s.title} (${s.platform})`);
  });
  
  await conn.end();
}

checkCount().catch(console.error);
