import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where:   { email: parsed.data.email },
          include: { business: { select: { id: true } } },
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;

        return {
          id:         user.id,
          email:      user.email,
          name:       user.name,
          businessId: user.business?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user, trigger }) {
      // On first sign-in, embed user data into token
      if (user) {
        token.id         = user.id ?? "";
        token.businessId = (user as { businessId?: string | null }).businessId ?? null;
      }

      // Re-fetch business after onboarding completes (triggered by update())
      if (trigger === "update" && token.id) {
        const dbUser = await db.user.findUnique({
          where:   { id: token.id as string },
          include: { business: { select: { id: true } } },
        });
        token.businessId = dbUser?.business?.id ?? null;
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id         = token.id as string;
      session.user.businessId = (token.businessId as string | null | undefined) ?? null;
      return session;
    },
  },
});
