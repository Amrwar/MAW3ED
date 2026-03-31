import path from "path";
import { defineConfig } from "prisma/config";

// Prisma CLI config — uses direct (unpooled) URL for migrations, pooled for runtime.
// The driver adapter for runtime is configured in src/lib/db.ts.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
