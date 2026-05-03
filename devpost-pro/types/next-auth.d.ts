import "next-auth";

declare module "next-auth" {
  interface Session {
    linkedinAccessToken?: string;
    linkedinId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    linkedinAccessToken?: string;
    linkedinId?: string;
  }
}
