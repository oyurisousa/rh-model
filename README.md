# Projeto Node.js com Prisma + SQL Server

Projeto para conectar ao SQL Server e gerar models automaticamente usando Prisma.

## 🚀 Configuração

### 1. Configure a conexão com o banco de dados

Edite o arquivo `.env` com suas credenciais do SQL Server:

```env
DATABASE_URL="sqlserver://HOST:PORTA;database=NOME_BANCO;user=USUARIO;password=SENHA;encrypt=true;trustServerCertificate=true"
```

**Exemplo:**

```env
DATABASE_URL="sqlserver://localhost:1433;database=rh_sistema;user=sa;password=MinhaS3nh@;encrypt=true;trustServerCertificate=true"
```

### 2. Gere os models a partir do banco existente

Execute o comando para fazer o pull do schema:

```bash
npm run prisma:pull
```

Isso vai ler todas as tabelas do seu banco SQL Server e gerar automaticamente os models no arquivo `prisma/schema.prisma`.

### 3. Gere o Prisma Client

Depois do pull, gere o client:

```bash
npm run prisma:generate
```

### 4. Execute o projeto

```bash
npm run dev
```

## 📝 Scripts disponíveis

- `npm run dev` - Executa o projeto em modo desenvolvimento
- `npm run build` - Compila o TypeScript
- `npm start` - Executa o projeto compilado
- `npm run prisma:pull` - Faz pull do schema do banco
- `npm run prisma:generate` - Gera o Prisma Client

## 🔧 Comandos úteis do Prisma

```bash
# Ver o schema do banco
npx prisma db pull

# Gerar o client
npx prisma generate

# Abrir o Prisma Studio (interface visual)
npx prisma studio
```

## 📚 Estrutura do projeto

```
test_prisma_rh/
├── prisma/
│   └── schema.prisma    # Schema do Prisma (gerado pelo pull)
├── src/
│   └── index.ts         # Arquivo principal
├── .env                 # Variáveis de ambiente (não commitar!)
├── package.json
└── tsconfig.json
```
