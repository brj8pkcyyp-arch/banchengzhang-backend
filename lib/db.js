// Neon/Postgres 数据库连接层
// Vercel Serverless 环境变量: NEON_DATABASE_URL
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 环境变量未设置，请配置 Neon 数据库连接字符串');
}

const sql = neon(process.env.DATABASE_URL);

export default sql;
