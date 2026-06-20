import pg from 'pg';

async function test() {
  const configs = [
    { user: 'postgres', host: '127.0.0.1', database: 'postgres', password: '', port: 5432 },
    { user: 'postgres', host: '127.0.0.1', database: 'postgres', password: 'postgres', port: 5432 },
    { user: 'postgres', host: '127.0.0.1', database: 'postgres', password: 'password', port: 5432 }
  ];

  for (const config of configs) {
    console.log(`Trying config: password="${config.password}"`);
    const client = new pg.Client(config);
    try {
      await client.connect();
      console.log('SUCCESS CONNECTED!', config);
      await client.end();
      return;
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
    }
  }
}

test();
