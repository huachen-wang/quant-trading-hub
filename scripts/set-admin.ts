import mysql from 'mysql2/promise';

async function setAdmin() {
  const email = process.argv[2];
  
  if (!email) {
    console.error('Usage: pnpm exec tsx scripts/set-admin.ts <email>');
    console.error('Example: pnpm exec tsx scripts/set-admin.ts user@example.com');
    process.exit(1);
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  
  console.log(`[SetAdmin] Looking for user with email: ${email}`);
  const [users] = await conn.execute('SELECT id, name, email, role FROM users WHERE email = ?', [email]) as any;
  
  if (users.length === 0) {
    console.error(`[SetAdmin] User not found: ${email}`);
    console.log('\n[SetAdmin] Available users:');
    const [allUsers] = await conn.execute('SELECT id, name, email, role FROM users') as any;
    allUsers.forEach((u: any) => {
      console.log(`  ${u.id}. ${u.name} (${u.email}) - Role: ${u.role}`);
    });
    await conn.end();
    process.exit(1);
  }
  
  const user = users[0];
  console.log(`[SetAdmin] Found user: ${user.name} (${user.email})`);
  console.log(`[SetAdmin] Current role: ${user.role}`);
  
  if (user.role === 'admin') {
    console.log('[SetAdmin] User is already an admin!');
    await conn.end();
    return;
  }
  
  await conn.execute('UPDATE users SET role = ? WHERE id = ?', ['admin', user.id]);
  console.log(`[SetAdmin] ✅ User ${user.name} is now an admin!`);
  
  await conn.end();
}

setAdmin().catch(console.error);
