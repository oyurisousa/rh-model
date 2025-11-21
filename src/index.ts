import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Conectando ao SQL Server...");

  // Teste de conexão
  await prisma.$connect();
  console.log("✅ Conectado com sucesso!");

  // Aqui você pode fazer suas queries
  // Exemplo após fazer o pull:
  // const users = await prisma.user.findMany();
  // console.log(users);
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
