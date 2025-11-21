const { Connection, Request } = require('tedious');
require('dotenv').config();

const config = {
  server: '10.10.1.92',
  authentication: {
    type: 'default',
    options: {
      userName: 'gurhuweb',
      password: 'Rgm@@2025@@',
    }
  },
  options: {
    encrypt: false,
    database: 'rh_prd',
    trustServerCertificate: true,
    port: 1433
  }
};

const connection = new Connection(config);

connection.on('connect', (err) => {
  if (err) {
    console.error('Erro:', err);
    return;
  }
  
  console.log('📊 Schemas e quantidade de tabelas:\n');
  
  const request = new Request(`
    SELECT 
        TABLE_SCHEMA,
        COUNT(*) as total_tables
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    GROUP BY TABLE_SCHEMA
    ORDER BY COUNT(*) DESC
  `, (err) => {
    if (err) console.error(err);
    connection.close();
  });

  request.on('row', (columns) => {
    console.log(`  ${columns[0].value}: ${columns[1].value} tabelas`);
  });

  connection.execSql(request);
});

connection.connect();
