import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import User from "@/models/User";
import dbConnect from "@/lib/db";
import { verifyTwoFactorToken } from "@/lib/tokens";

class TwoFactorRequired extends CredentialsSignin {
    code = "2FA_REQUIRED";
}

class InvalidToken extends CredentialsSignin {
    code = "INVALID_2FA_TOKEN";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                token: { label: "2FA Token", type: "text" },
            },
            authorize: async (credentials) => {
                await dbConnect();

                const email = credentials.email as string;
                const password = credentials.password as string;
                const token = credentials.token as string | undefined;

                if (!email || !password) {
                    throw new Error("Missing credentials");
                }

                const user = await User.findOne({ email });

                if (!user || !user.password) {
                    throw new Error("Invalid credentials");
                }

                const isPasswordValid = await compare(password, user.password);

                if (!isPasswordValid) {
                    throw new Error("Invalid credentials");
                }

                if (user.isTwoFactorEnabled) {
                    if (!token) {
                        throw new TwoFactorRequired();
                    }

                    const isTokenValid = verifyTwoFactorToken(token, user.twoFactorSecret!);

                    if (!isTokenValid) {
                        throw new InvalidToken();
                    }
                }

                return {
                    id: user._id.toString(),
                    email: user.email,
                    image: user.image,
                };
            },
        }),
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
            }
            return session;
        },
        async jwt({ token }) {
            return token;
        },
    },
    session: { strategy: "jwt" },
});