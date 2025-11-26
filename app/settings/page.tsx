"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enableTwoFactor, confirmTwoFactor, disableTwoFactor, getTwoFactorStatus } from "@/actions/two-factor";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

export default function SettingsPage() {
    const { data: session } = useSession();
    const [isEnabled, setIsEnabled] = useState(false);
    const [qrCode, setQrCode] = useState("");
    const [token, setToken] = useState("");
    const [step, setStep] = useState<"idle" | "verify">("idle");
    const [msg, setMsg] = useState("");

    useEffect(() => {
        getTwoFactorStatus().then((res) => {
            if (res.isEnabled) setIsEnabled(true);
        });
    }, []);

    const handleEnable = async () => {
        const res = await enableTwoFactor();
        if (res.qrCodeUrl) {
            setQrCode(res.qrCodeUrl);
            setStep("verify");
        }
    };

    const handleVerify = async () => {
        const res = await confirmTwoFactor(token);
        if (res.success) {
            setIsEnabled(true);
            setStep("idle");
            setQrCode("");
            setMsg("2FA Enabled Successfully!");
        } else {
            setMsg("Invalid Token");
        }
    };

    const handleDisable = async () => {
        await disableTwoFactor();
        setIsEnabled(false);
        setMsg("2FA Disabled");
    };

    if (!session) return <div className="p-10 text-white">Loading...</div>;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100">
            <Card className="w-[400px] bg-slate-900 border-slate-800 text-slate-100">
                <CardHeader>
                    <CardTitle>Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span>Email:</span>
                        <span className="text-slate-400">{session.user?.email}</span>
                    </div>

                    <div className="border-t border-slate-800 pt-4">
                        <h3 className="text-lg font-semibold mb-2">Two-Factor Authentication</h3>
                        {isEnabled ? (
                            <div className="space-y-2">
                                <p className="text-emerald-500">✅ Enabled</p>
                                <Button onClick={handleDisable} variant="destructive" className="w-full">
                                    Disable 2FA
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-slate-400">Secure your account with 2FA.</p>
                                {step === "idle" && (
                                    <Button onClick={handleEnable} className="w-full bg-emerald-600 hover:bg-emerald-700">
                                        Enable 2FA
                                    </Button>
                                )}
                            </div>
                        )}

                        {step === "verify" && qrCode && (
                            <div className="mt-4 space-y-4">
                                <div className="flex justify-center bg-white p-2 rounded">
                                    <Image src={qrCode} alt="QR Code" width={150} height={150} />
                                </div>
                                <p className="text-xs text-center text-slate-400">Scan with Google Authenticator</p>
                                <Input
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    placeholder="Enter 6-digit code"
                                    className="bg-slate-950 border-slate-800"
                                />
                                <Button onClick={handleVerify} className="w-full">
                                    Verify & Activate
                                </Button>
                            </div>
                        )}

                        {msg && <p className="text-center text-sm mt-2">{msg}</p>}
                    </div>

                    <div className="border-t border-slate-800 pt-4">
                        <Button onClick={() => signOut()} variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                            Sign Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
