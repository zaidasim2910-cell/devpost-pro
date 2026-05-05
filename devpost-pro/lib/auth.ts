import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import LinkedInProvider from "next-auth/providers/linkedin";
import { verifyUserPassword } from "@/lib/user-store";

function linkedInPersonUrn(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const s = String(id);
  return s.startsWith("urn:li:person:") ? s : `urn:li:person:${s}`;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;
        const user = await verifyUserPassword(email, password);
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "r_liteprofile r_emailaddress w_member_social",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (user?.id) token.userId = user.id;
      if (user?.email) token.email = user.email;
      if (user?.name) token.name = user.name;
      if (account?.provider === "linkedin") {
        token.linkedinAccessToken = account.access_token;
        token.linkedinId = account.providerAccountId ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      session.linkedinAccessToken = token.linkedinAccessToken as
        | string
        | undefined;
      session.linkedinId = linkedInPersonUrn(
        token.linkedinId as string | undefined
      );
      if (session.user) {
        session.user.id = token.userId as string | undefined;
      }
      return session;
    },
  },
};
