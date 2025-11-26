import { authenticator } from "otplib";
import QRCode from "qrcode";

export const generateTwoFactorSecret = async (email: string) => {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, "SecureChatApp", secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    return { secret, qrCodeUrl };
};

export const verifyTwoFactorToken = (token: string, secret: string) => {
    authenticator.options = { window: 1 };
    return authenticator.verify({ token, secret });
};
