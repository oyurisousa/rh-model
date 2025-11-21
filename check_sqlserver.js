const { Connection } = require('tedious');
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
    console.error('Erro de conexão:', err);
    return;
  }

  console.log('✅ Conectado com sucesso!');
  console.log('📋 Versão do SQL Server:', connection.config.options.tdsVersion);

  const Request = require('tedious').Request;
  const request = new Request("SELECT @@VERSION AS version", (err) => {
    if (err) {
      console.error(err);
    }
    connection.close();
  });

  request.on('row', (columns) => {
    console.log('🗄️ ', columns[0].value);
  });

  connection.execSql(request);
});

connection.connect();
