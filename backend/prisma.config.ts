// Medora 2.0 - Prisma 7 Configuration for Supabase PostgreSQL
// Documentation: https://pris.ly/d/config-datasource

import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
