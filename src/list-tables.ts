import "reflect-metadata";
import { AppDataSource } from "./data-source";

AppDataSource.initialize()
  .then(async () => {
    console.log("✅ Conectado ao SQL Server 2005!");
    console.log("📋 Listando tabelas...\n");

    const queryRunner = AppDataSource.createQueryRunner();

    // Lista todas as tabelas do banco
    const tables = await queryRunner.query(`
            SELECT 
                TABLE_SCHEMA,
                TABLE_NAME,
                TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        `);

    console.log(`🗄️  Encontradas ${tables.length} tabelas:\n`);

    for (const table of tables) {
      console.log(`  📁 ${table.TABLE_SCHEMA}.${table.TABLE_NAME}`);

      // Pega as colunas de cada tabela
      const columns = await queryRunner.query(`
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE,
                    CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = '${table.TABLE_SCHEMA}'
                  AND TABLE_NAME = '${table.TABLE_NAME}'
                ORDER BY ORDINAL_POSITION
            `);

      columns.forEach((col: any) => {
        const nullable = col.IS_NULLABLE === "YES" ? "?" : "";
        const length = col.CHARACTER_MAXIMUM_LENGTH
          ? `(${col.CHARACTER_MAXIMUM_LENGTH})`
          : "";
        console.log(
          `     └─ ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length}${nullable}`
        );
      });
      console.log("");
    }

    await queryRunner.release();
    await AppDataSource.destroy();
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
  });
