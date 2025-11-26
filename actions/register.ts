"use server";

import { hash } from "bcryptjs";
import User from "@/models/User";
import dbConnect from "@/lib/db";

export const registerUser = async (formData: FormData) => {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { error: "Email and password are required" };
    }

    await dbConnect();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
        return { error: "User already exists" };
    }

    const hashedPassword = await hash(password, 10);

    await User.create({
        email,
        password: hashedPassword,
    });

    return { success: "User created successfully" };
};
