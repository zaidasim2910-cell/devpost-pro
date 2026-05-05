import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
  }

  interface Session {
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    linkedinAccessToken?: string;
    linkedinId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    linkedinAccessToken?: string;
    linkedinId?: string;
  }
}
