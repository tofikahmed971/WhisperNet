"use server";

import { auth } from "@/auth";
import User from "@/models/User";
import dbConnect from "@/lib/db";
import { generateTwoFactorSecret, verifyTwoFactorToken } from "@/lib/tokens";

export const getTwoFactorStatus = async () => {
    const session = await auth();
    if (!session?.user?.email) return { error: "Unauthorized" };

    await dbConnect();
    const user = await User.findOne({ email: session.user.email });
    return { isEnabled: user?.isTwoFactorEnabled };
};

export const enableTwoFactor = async () => {
    const session = await auth();
    if (!session?.user?.email) return { error: "Unauthorized" };

    await dbConnect();
    const user = await User.findOne({ email: session.user.email });

    if (!user) return { error: "User not found" };

    const { secret, qrCodeUrl } = await generateTwoFactorSecret(user.email);

    user.twoFactorSecret = secret;
    await user.save();

    return { secret, qrCodeUrl };
};

export const confirmTwoFactor = async (token: string) => {
    const session = await auth();
    if (!session?.user?.email) return { error: "Unauthorized" };

    await dbConnect();
    const user = await User.findOne({ email: session.user.email });

    if (!user || !user.twoFactorSecret) return { error: "User not found or 2FA not initiated" };

    const isValid = verifyTwoFactorToken(token, user.twoFactorSecret);

    if (!isValid) return { error: "Invalid token" };

    user.isTwoFactorEnabled = true;
    await user.save();

    return { success: true };
};

export const disableTwoFactor = async () => {
    const session = await auth();
    if (!session?.user?.email) return { error: "Unauthorized" };

    await dbConnect();
    const user = await User.findOne({ email: session.user.email });

    if (!user) return { error: "User not found" };

    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    return { success: true };
};
