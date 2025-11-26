"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import User from "@/models/User";
import dbConnect from "@/lib/db";
import { compare } from "bcryptjs";

export const login = async (values: any) => {
    const { email, password, token } = values;

    try {
        // Step 1: If no token provided, check credentials and 2FA status
        if (!token) {
            await dbConnect();
            const user = await User.findOne({ email });

            if (!user || !user.password) {
                return { error: "Invalid credentials" };
            }

            const isPasswordValid = await compare(password, user.password);

            if (!isPasswordValid) {
                return { error: "Invalid credentials" };
            }

            // If 2FA is enabled, signal frontend to show 2FA input
            if (user.isTwoFactorEnabled) {
                return { requires2FA: true };
            }
        }

        // Step 2: Proceed with signIn (either no 2FA, or 2FA token provided)
        const result = await signIn("credentials", {
            email,
            password,
            token,
            redirect: false,
        });

        if (result?.error) {
            return { error: "Invalid 2FA token" };
        }

        return { success: true };
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return { error: "Invalid 2FA token" };
                default:
                    return { error: "Something went wrong" };
            }
        }
        throw error;
    }
};
