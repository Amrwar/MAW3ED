import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id:          string;
      /** Null for a customer who signed in with a phone and no address. */
      email?:      string | null;
      name?:       string | null;
      businessId?: string | null;
      /** A platform moderator; set by hand in the database. */
      isAdmin?: boolean;
      /** E.164, present once a phone sign-in has happened. */
      phone?:      string | null;
    };
  }

  interface User {
    businessId?: string | null;
    phone?:      string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:          string;
    businessId?: string | null;
    phone?:      string | null;
    /** True once businessId has been looked up, so it is not re-queried. */
    resolved?:   boolean;
  }
}
