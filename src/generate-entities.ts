import "reflect-metadata";
import { AppDataSource } from "./data-source";
import * as fs from "fs";
import * as path from "path";

// Parse simples de argumentos CLI (--schema RH --table MinhaTabela --append)
function parseArgs() {
  const args = process.argv.slice(2);
  const result: { [k: string]: string | boolean } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.replace(/^--/, "");
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        result[key] = true; // flag booleana (ex: --append)
      } else {
        result[key] = next;
        i++;
      }
    }
  }
  return result;
}
const cli = parseArgs();

// Mapeamento de tipos SQL Server para SQLAlchemy Python
const typeMapping: { [key: string]: string } = {
  int: "Integer",
  bigint: "BigInteger",
  smallint: "SmallInteger",
  tinyint: "SmallInteger",
  bit: "Boolean",
  decimal: "Numeric",
  numeric: "Numeric",
  money: "Numeric",
  smallmoney: "Numeric",
  float: "Float",
  real: "Float",
  datetime: "DateTime",
  smalldatetime: "DateTime",
  date: "Date",
  time: "Time",
  char: "String",
  varchar: "String",
  text: "Text",
  nchar: "String",
  nvarchar: "String",
  ntext: "Text",
  uniqueidentifier: "String",
  varbinary: "LargeBinary",
  image: "LargeBinary",
};

AppDataSource.initialize()
  .then(async () => {
    console.log("✅ Conectado ao SQL Server 2005!");
    console.log("🔄 Gerando models para SQLAlchemy Python...\n");

    const queryRunner = AppDataSource.createQueryRunner();

    // Definições via CLI ou defaults
    const schemaArg = (cli.schema as string) || "RH"; // RH padrão
    const tableArg = (cli.table as string) || null; // tabela específica opcional
    const append = Boolean(cli.append); // se true, append no mesmo arquivo

    let tables: any[] = [];
    if (tableArg) {
      // Buscar apenas a tabela solicitada; se schema TODOS, procurar em todos os schemas
      if (schemaArg === "TODOS") {
        const row = await queryRunner.query(`
          SELECT TABLE_SCHEMA, TABLE_NAME
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
            AND TABLE_NAME = '${tableArg}'
        `);
        if (row.length === 0) {
          console.error(
            `❌ Tabela '${tableArg}' não encontrada em nenhum schema.`
          );
          await queryRunner.release();
          await AppDataSource.destroy();
          return;
        }
        tables = row;
      } else {
        const row = await queryRunner.query(`
          SELECT TABLE_SCHEMA, TABLE_NAME
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
            AND TABLE_SCHEMA = '${schemaArg}'
            AND TABLE_NAME = '${tableArg}'
        `);
        if (row.length === 0) {
          console.error(`❌ Tabela '${schemaArg}.${tableArg}' não encontrada.`);
          await queryRunner.release();
          await AppDataSource.destroy();
          return;
        }
        tables = row;
      }
    } else {
      // Sem tabela específica: manter comportamento original
      if (schemaArg === "TODOS") {
        tables = await queryRunner.query(`
          SELECT 
              TABLE_SCHEMA,
              TABLE_NAME
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_SCHEMA, TABLE_NAME
        `);
      } else {
        tables = await queryRunner.query(`
          SELECT 
              TABLE_SCHEMA,
              TABLE_NAME
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
            AND TABLE_SCHEMA = '${schemaArg}'
          ORDER BY TABLE_NAME
        `);
      }
    }

    const singleTableMode = Boolean(tableArg);
    let pythonModels = "";
    const header = `"""
SQLAlchemy Models gerados automaticamente do SQL Server 2005
Database: rh_prd
Generated: ${new Date().toISOString()}
Total de tabelas: ${tables.length}
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Float, Text, Date, Time, BigInteger, SmallInteger, LargeBinary, ForeignKey, Index, UniqueConstraint, and_
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

`;

    if (!singleTableMode || (singleTableMode && !append)) {
      // Inclui cabeçalho quando gerando tudo ou gerando tabela única sem append
      pythonModels += header;
    }

    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      const tableSchema = table.TABLE_SCHEMA;
      const className = toPascalCase(tableName);

      console.log(
        `📝 Gerando model: ${tableSchema}.${tableName} -> ${className}`
      );

      // Pega as colunas com info de IDENTITY (auto-increment)
      const columns = await queryRunner.query(`
                SELECT 
                    c.COLUMN_NAME,
                    c.DATA_TYPE,
                    c.IS_NULLABLE,
                    c.CHARACTER_MAXIMUM_LENGTH,
                    c.NUMERIC_PRECISION,
                    c.NUMERIC_SCALE,
                    c.COLUMN_DEFAULT,
                    CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY,
                    COLUMNPROPERTY(OBJECT_ID('${tableSchema}.${tableName}'), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
                FROM INFORMATION_SCHEMA.COLUMNS c
                LEFT JOIN (
                    SELECT ku.COLUMN_NAME
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                      AND ku.TABLE_NAME = '${tableName}'
                      AND ku.TABLE_SCHEMA = '${tableSchema}'
                ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
                WHERE c.TABLE_NAME = '${tableName}'
                  AND c.TABLE_SCHEMA = '${tableSchema}'
                ORDER BY c.ORDINAL_POSITION
            `);

      // Busca Foreign Keys com informação de constraint (agrupa multi-coluna)
      const foreignKeys = await queryRunner.query(`
                SELECT 
                    fk.name AS FK_NAME,
                    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS COLUMN_NAME,
                    OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS REFERENCED_SCHEMA,
                    OBJECT_NAME(fk.referenced_object_id) AS REFERENCED_TABLE,
                    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS REFERENCED_COLUMN,
                    fc.constraint_column_id AS COLUMN_ORDER
                FROM sys.foreign_keys AS fk
                INNER JOIN sys.foreign_key_columns AS fc 
                    ON fk.object_id = fc.constraint_object_id
                WHERE fk.parent_object_id = OBJECT_ID('${tableSchema}.${tableName}')
                ORDER BY fk.name, fc.constraint_column_id
            `);

      // Busca Unique Constraints (SQL Server 2005 compatible)
      const uniqueConstraints = await queryRunner.query(`
                SELECT 
                    tc.CONSTRAINT_NAME,
                    STUFF((
                        SELECT ', ' + ku2.COLUMN_NAME
                        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku2
                        WHERE ku2.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                        ORDER BY ku2.ORDINAL_POSITION
                        FOR XML PATH('')
                    ), 1, 2, '') AS COLUMNS
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                WHERE tc.CONSTRAINT_TYPE = 'UNIQUE'
                  AND tc.TABLE_NAME = '${tableName}'
                  AND tc.TABLE_SCHEMA = '${tableSchema}'
            `);

      // Busca Indexes (não PK, não unique) - SQL Server 2005 compatible
      const indexes = await queryRunner.query(`
                SELECT 
                    i.name AS INDEX_NAME,
                    STUFF((
                        SELECT ', ' + c2.name
                        FROM sys.index_columns ic2
                        INNER JOIN sys.columns c2 ON ic2.object_id = c2.object_id AND ic2.column_id = c2.column_id
                        WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id
                        ORDER BY ic2.key_ordinal
                        FOR XML PATH('')
                    ), 1, 2, '') AS COLUMNS
                FROM sys.indexes i
                WHERE i.object_id = OBJECT_ID('${tableSchema}.${tableName}')
                  AND i.is_primary_key = 0
                  AND i.is_unique_constraint = 0
                  AND i.type > 0
            `);

      pythonModels += `\nclass ${className}(Base):\n`;
      pythonModels += `    __tablename__ = '${tableName}'\n`;

      // Monta __table_args__ com schema, unique constraints e indexes
      const tableArgs: string[] = [];

      // Unique constraints
      for (const uc of uniqueConstraints) {
        const cols = uc.COLUMNS.split(", ")
          .map((c: string) => `'${c}'`)
          .join(", ");
        tableArgs.push(
          `UniqueConstraint(${cols}, name='${uc.CONSTRAINT_NAME}')`
        );
      }

      // Indexes
      for (const idx of indexes) {
        const cols = idx.COLUMNS.split(", ")
          .map((c: string) => `'${c}'`)
          .join(", ");
        tableArgs.push(`Index('${idx.INDEX_NAME}', ${cols})`);
      }

      tableArgs.push(`{'schema': '${tableSchema}'}`);
      pythonModels += `    __table_args__ = (${tableArgs.join(", ")})\n\n`;

      // Cria um map de FKs por coluna
      const fkMap = new Map<string, any>();
      for (const fk of foreignKeys) {
        fkMap.set(fk.COLUMN_NAME, fk);
      }

      // Gera as colunas
      for (const col of columns) {
        const colName = col.COLUMN_NAME;
        const dataType = col.DATA_TYPE.toLowerCase();
        const isNullable = col.IS_NULLABLE === "YES";
        const isPrimaryKey = col.IS_PRIMARY_KEY === 1;
        const isIdentity = col.IS_IDENTITY === 1;
        const maxLength = col.CHARACTER_MAXIMUM_LENGTH;
        const defaultValue = col.COLUMN_DEFAULT;

        let sqlalchemyType = typeMapping[dataType] || "String";

        // Adiciona length para strings
        if (
          (sqlalchemyType === "String" || dataType.includes("char")) &&
          maxLength &&
          maxLength !== -1
        ) {
          sqlalchemyType = `String(${maxLength})`;
        } else if (sqlalchemyType === "Numeric" && col.NUMERIC_PRECISION) {
          sqlalchemyType = `Numeric(${col.NUMERIC_PRECISION}, ${
            col.NUMERIC_SCALE || 0
          })`;
        }

        let columnDef = `    ${colName} = Column(${sqlalchemyType}`;

        // Foreign Key
        if (fkMap.has(colName)) {
          const fk = fkMap.get(colName);
          columnDef += `, ForeignKey('${fk.REFERENCED_SCHEMA}.${fk.REFERENCED_TABLE}.${fk.REFERENCED_COLUMN}')`;
        }

        if (isPrimaryKey) {
          columnDef += ", primary_key=True";
        }

        if (isIdentity) {
          columnDef += ", autoincrement=True";
        }

        if (!isNullable && !isPrimaryKey) {
          columnDef += ", nullable=False";
        }

        // Default value (limpa parênteses e aspas extras do SQL Server)
        if (defaultValue && !isIdentity) {
          let cleanDefault = defaultValue.trim();
          // Remove parênteses externos e aspas simples
          cleanDefault = cleanDefault.replace(/^\(+|\)+$/g, "");
          cleanDefault = cleanDefault.replace(/^'|'$/g, "");

          // Se for string literal, adiciona aspas
          if (dataType.includes("char") || dataType.includes("text")) {
            columnDef += `, server_default="${cleanDefault}"`;
          } else {
            columnDef += `, server_default="${cleanDefault}"`;
          }
        }

        columnDef += ")\n";
        pythonModels += columnDef;
      }

      // Gera relationships para FKs
      if (foreignKeys.length > 0) {
        pythonModels += "\n    # Relationships\n";

        // Agrupa FKs por constraint (para detectar FK compostas)
        const fkGroups = new Map<string, any[]>();
        for (const fk of foreignKeys) {
          const fkName = fk.FK_NAME;
          if (!fkGroups.has(fkName)) {
            fkGroups.set(fkName, []);
          }
          fkGroups.get(fkName)!.push(fk);
        }

        // Rastreia relacionamentos já criados para evitar duplicatas
        const createdRelationships = new Set<string>();

        for (const [fkName, fkCols] of fkGroups) {
          const firstFK = fkCols[0];
          const refTable = firstFK.REFERENCED_TABLE;
          const refClass = toPascalCase(refTable);
          const baseRelName = toCamelCase(refTable);
          const isComposite = fkCols.length > 1;

          // Gera nome único para o relacionamento
          let finalRelName = baseRelName;
          const sameTables = Array.from(fkGroups.values()).filter(
            (cols) => cols[0].REFERENCED_TABLE === refTable
          );

          // Se há múltiplos relacionamentos para a mesma tabela, adiciona sufixo
          if (sameTables.length > 1) {
            // Usa a primeira coluna FK para criar sufixo descritivo
            const colSuffix = firstFK.COLUMN_NAME.replace(
              new RegExp(`^${refTable}_?|^T\\d+_`, "gi"),
              ""
            )
              .split("_")
              .map(
                (w: string) =>
                  w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              )
              .join("");
            finalRelName = baseRelName + "By" + colSuffix;
          }

          // Verifica se já existe relacionamento com esse nome
          let counter = 1;
          let uniqueRelName = finalRelName;
          while (createdRelationships.has(uniqueRelName)) {
            uniqueRelName = finalRelName + counter;
            counter++;
          }
          finalRelName = uniqueRelName;
          createdRelationships.add(finalRelName);

          if (isComposite) {
            // FK Composta - usa primaryjoin explícito
            const localCols = fkCols.map((fk) => fk.COLUMN_NAME);

            // Gera condições para primaryjoin
            const conditions = fkCols
              .map(
                (fk) =>
                  `${className}.${fk.COLUMN_NAME}==${refClass}.${fk.REFERENCED_COLUMN}`
              )
              .join(", ");

            pythonModels += `    ${finalRelName} = relationship('${refClass}', \n`;
            pythonModels += `        primaryjoin='and_(${conditions})',\n`;
            pythonModels += `        foreign_keys=[${localCols.join(", ")}])\n`;
          } else {
            // FK Simples - usa apenas foreign_keys
            pythonModels += `    ${finalRelName} = relationship('${refClass}', foreign_keys=[${firstFK.COLUMN_NAME}])\n`;
          }
        }
      }
    }

    // Definir destino do arquivo
    let outputPath: string;
    if (singleTableMode && !append) {
      outputPath = path.join(
        __dirname,
        "..",
        `generated_model_${tables[0].TABLE_NAME}.py`
      );
    } else {
      outputPath = path.join(__dirname, "..", "generated_models.py");
    }

    if (singleTableMode && append) {
      // Append: verificar se classe já existe
      if (!fs.existsSync(outputPath)) {
        // Se não existe, escrever cabeçalho completo + conteúdo
        fs.writeFileSync(outputPath, header + "\n" + pythonModels);
        console.log(`\n🆕 Arquivo criado e tabela adicionada: ${outputPath}`);
      } else {
        const current = fs.readFileSync(outputPath, "utf-8");
        const className = toPascalCase(tables[0].TABLE_NAME);
        const regex = new RegExp(`class\\s+${className}\\s*\\(`);
        if (regex.test(current)) {
          console.log(
            `⚠️  Classe '${className}' já existe em ${path.basename(
              outputPath
            )}. Nenhuma alteração feita.`
          );
        } else {
          fs.appendFileSync(outputPath, "\n" + pythonModels);
          console.log(
            `\n✅ Modelo da tabela '${tables[0].TABLE_SCHEMA}.${tables[0].TABLE_NAME}' adicionado em ${outputPath}`
          );
        }
      }
    } else {
      // Modo normal (todas) ou tabela única em arquivo separado
      fs.writeFileSync(outputPath, pythonModels);
      console.log(`\n✅ Models gerados com sucesso!`);
      console.log(`📄 Arquivo salvo em: ${outputPath}`);
      console.log(`📊 Total de ${tables.length} tabelas convertidas\n`);
    }

    await queryRunner.release();
    await AppDataSource.destroy();
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
  });

function toPascalCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
