import "reflect-metadata";
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
  type: "mssql",
  host: "10.10.1.92",
  port: 1433,
  username: "gurhuweb",
  password: "Rgm@@2025@@",
  database: "rh_prd",
  synchronize: false,
  logging: false,
  entities: ["src/entity/**/*.ts"],
  migrations: [],
  subscribers: [],
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
});
