import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth/auth.config";
import { connectMongo } from "@/lib/mongo";
import type { Role } from "@/lib/types";
import { User } from "@/models/User";

function getGoogleProvider() {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!clientId || !clientSecret) {
    // Failing quietly would ship a production build with no Google button and
    // no error anywhere — indistinguishable from the feature never existing.
    //
    // But this runs at module scope, and `next build` imports every route to
    // collect its config, so throwing during the build breaks the deploy
    // instead of reporting a misconfiguration. Skip the throw for the build
    // phase only: a real deployment still fails loudly on its first request,
    // which is where the message is actionable.
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

    if (process.env.NODE_ENV === "production" && !isBuildPhase) {
      throw new Error(
        "AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be set. Google sign-in " +
          "would otherwise be silently missing from the deployed app.",
      );
    }

    console.warn(
      "[auth] Google sign-in disabled: AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET not set.",
    );
    return null;
  }

  return Google({
    clientId,
    clientSecret,
  });
}

const googleProvider = getGoogleProvider();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(googleProvider ? [googleProvider] : []),
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.toLowerCase().trim()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) {
          return null;
        }

        await connectMongo();
        const user = await User.findOne().where("email").equals(email);

        if (!user?.passwordHash) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          role: user.role as Role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") {
        return true;
      }

      if (!user.email) {
        return false;
      }

      await connectMongo();
      const email = user.email.toLowerCase();
      const existing = await User.findOne().where("email").equals(email);

      if (existing) {
        const emailVerified =
          profile && "email_verified" in profile
            ? Boolean(profile.email_verified)
            : false;

        if (!emailVerified) {
          return "/login?error=EmailNotVerified";
        }

        const alreadyLinked = existing.accounts.some(
          (linked: { provider: string; providerAccountId: string }) =>
            linked.provider === account.provider &&
            linked.providerAccountId === account.providerAccountId,
        );

        if (!alreadyLinked) {
          existing.accounts.push({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            linkedAt: new Date(),
          });

          if (!existing.image && user.image) {
            existing.image = user.image;
          }

          if (!existing.name && user.name) {
            existing.name = user.name;
          }

          await existing.save();
        }

        return true;
      }

      await User.create({
        email,
        emailVerified:
          profile && "email_verified" in profile && profile.email_verified
            ? new Date()
            : undefined,
        name: user.name,
        image: user.image,
        accounts: [
          {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            linkedAt: new Date(),
          },
        ],
        role: "CITIZEN",
      });

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      if (account && account.provider !== "credentials" && token.email) {
        await connectMongo();
        const dbUser = await User.findOne()
          .where("email")
          .equals(token.email.toLowerCase())
          .select("_id role");

        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role as Role;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "CITIZEN";
      }
      return session;
    },
    authorized: authConfig.callbacks.authorized,
  },
});
