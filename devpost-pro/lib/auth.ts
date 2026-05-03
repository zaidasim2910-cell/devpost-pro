import type { NextAuthOptions } from "next-auth";
import LinkedInProvider from "next-auth/providers/linkedin";

function linkedInPersonUrn(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const s = String(id);
  return s.startsWith("urn:li:person:") ? s : `urn:li:person:${s}`;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
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
    async jwt({ token, account }) {
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
      return session;
    },
  },
};
