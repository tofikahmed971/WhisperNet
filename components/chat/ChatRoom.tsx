"use client";

import { useEffect, useState, useRef } from "react";
import { socket } from "@/lib/socket";
import {
    generateKeyPair,
    exportKey,
    importKey,
    encryptMessage,
    decryptMessage,
    generateSymKey,
    encryptSymMessage,
    decryptSymMessage,
    exportSymKey,
    importSymKey,
} from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, User, Lock, Check, CheckCheck, Smile } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface Message {
    id: string;
    senderId: string;
    content: string;
    timestamp: number;
    status?: "sending" | "sent" | "delivered" | "read";
}

interface ChatRoomProps {
    roomId: string;
}

export default function ChatRoom({ roomId }: ChatRoomProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const [participantCount, setParticipantCount] = useState(1);
    const [nicknames, setNicknames] = useState<Map<string, string>>(new Map());
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const searchParams = useSearchParams();
    const router = useRouter();
    const nickname = searchParams.get("nickname") || "Anonymous";
    const userLimit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;

    // My keys
    const myKeys = useRef<{ public: CryptoKey; private: CryptoKey } | null>(null);

    // Other users' public keys: Map<userId, CryptoKey>
    const otherUsersKeys = useRef<Map<string, CryptoKey>>(new Map());

    // Messages end ref for auto-scroll
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const init = async () => {
            // 0. Get or Create User ID
            let userId = sessionStorage.getItem("userId");
            if (!userId) {
                userId = crypto.randomUUID();
                sessionStorage.setItem("userId", userId);
            }

            // 1. Generate my keys
            const keys = await generateKeyPair();
            myKeys.current = { public: keys.publicKey, private: keys.privateKey };

            // 2. Connect to socket with userId
            socket.auth = { userId };
            socket.connect();

            // 3. Join room with nickname and limit
            socket.emit("join-room", { roomId, nickname, userLimit });
            setIsConnected(true);

            // 4. Listeners
            socket.on("error", (err: string) => {
                alert(err);
                router.push("/");
            });

            socket.on("room-info", (data: { count: number }) => {
                setParticipantCount(data.count);
            });

            socket.on("user-joined", async (data: { socketId: string; userId: string; nickname?: string }) => {
                console.log("User joined:", data);

                if (data.nickname) {
                    setNicknames(prev => new Map(prev).set(data.socketId, data.nickname!));
                }

                // Initiate Key Exchange: Send my Public Key to the new socket
                if (myKeys.current) {
                    const exportedPub = await exportKey(myKeys.current.public);
                    socket.emit("signal", {
                        target: data.socketId,
                        signal: { type: "offer-key", key: exportedPub },
                    });
                }
            });

            socket.on("user-left", (data: { socketId: string; userId: string }) => {
                console.log("User left:", data);
                otherUsersKeys.current.delete(data.socketId);
            });

            socket.on("signal", async (data: { sender: string; signal: any }) => {
                const { sender, signal } = data;

                if (signal.type === "offer-key") {
                    // Received a Public Key from someone
                    const importedKey = await importKey(signal.key, ["encrypt"]);
                    otherUsersKeys.current.set(sender, importedKey);
                    console.log("Received public key from:", sender);

                    // If I haven't sent my key to them, send it back
                    if (myKeys.current) {
                        const exportedPub = await exportKey(myKeys.current.public);
                        socket.emit("signal", {
                            target: sender,
                            signal: { type: "answer-key", key: exportedPub },
                        });
                    }
                } else if (signal.type === "answer-key") {
                    // Received a Public Key in response to my offer
                    const importedKey = await importKey(signal.key, ["encrypt"]);
                    otherUsersKeys.current.set(sender, importedKey);
                    console.log("Received answer key from:", sender);
                }
            });

            socket.on("message-status", (data: { messageId: string; status: "delivered" | "read"; originalSenderId: string }) => {
                console.log("Received message-status:", data, "My socket.id:", socket.id);
                if (data.originalSenderId === socket.id) {
                    console.log("Updating status for my message:", data.messageId, "to", data.status);
                    setMessages((prev) =>
                        prev.map((msg) => {
                            if (msg.id === data.messageId) {
                                console.log("Found message to update. Current status:", msg.status, "New status:", data.status);
                                // Upgrade status: sent -> delivered -> read
                                // If already read, don't go back to delivered
                                if (msg.status === "read") return msg;
                                if (msg.status === "delivered" && data.status === "delivered") return msg;
                                return { ...msg, status: data.status };
                            }
                            return msg;
                        })
                    );
                } else {
                    console.log("Message status not for me. Original sender:", data.originalSenderId, "Me:", socket.id);
                }
            });

            socket.on("receive-message", async (data: { senderId: string; payload: any; messageId: string; roomId: string }) => {
                console.log("=== RECEIVE-MESSAGE EVENT ===");
                console.log("Full data:", JSON.stringify(data, null, 2));
                console.log("Sender ID:", data.senderId);
                console.log("Message ID:", data.messageId);
                console.log("My socket.id:", socket.id);

                const { senderId, payload, messageId } = data;

                // Emit Delivered immediately
                console.log("Emitting message-delivered for messageId:", messageId, "original sender:", senderId);
                socket.emit("message-delivered", {
                    roomId: data.roomId,
                    messageId,
                    senderId, // original sender's socket.id
                    recipientId: socket.id
                });

                try {
                    // 1. Find the encrypted AES key for ME
                    const myEncryptedKey = payload.keys[socket.id || ""];
                    if (!myEncryptedKey) {
                        console.error("No key found for me in message");
                        return;
                    }

                    // 2. Decrypt AES key with my Private Key
                    if (!myKeys.current) return;
                    const aesKeyRaw = await decryptMessage(myKeys.current.private, myEncryptedKey);

                    // 3. Import AES Key
                    const aesKey = await importSymKey(aesKeyRaw);

                    // 4. Decrypt Content
                    const content = await decryptSymMessage(aesKey, payload.content);

                    setMessages((prev) => [
                        ...prev,
                        {
                            id: messageId || crypto.randomUUID(),
                            senderId,
                            content,
                            timestamp: Date.now(),
                        },
                    ]);

                    // Emit Read after successfully displaying the message
                    console.log("Emitting message-read for messageId:", messageId, "original sender:", senderId);
                    socket.emit("message-read", {
                        roomId,
                        messageId,
                        senderId,
                        recipientId: socket.id
                    });
                } catch (err) {
                    console.error("Failed to decrypt message:", err);
                }
            });

            socket.on("user-typing", ({ socketId, nickname }: { socketId: string; nickname: string }) => {
                console.log("Received user-typing event. SocketId:", socketId, "Nickname:", nickname);
                setTypingUsers(prev => {
                    const newSet = new Set(prev).add(socketId);
                    console.log("Updated typingUsers. New size:", newSet.size, "Users:", Array.from(newSet));
                    return newSet;
                });
                setNicknames(prev => new Map(prev).set(socketId, nickname));
            });

            socket.on("user-stopped-typing", ({ socketId }: { socketId: string }) => {
                console.log("Received user-stopped-typing event. SocketId:", socketId);
                setTypingUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(socketId);
                    console.log("Updated typingUsers after delete. New size:", newSet.size);
                    return newSet;
                });
            });
        };

        init();

        return () => {
            socket.off("error");
            socket.off("room-info");
            socket.off("user-joined");
            socket.off("user-left");
            socket.off("signal");
            socket.off("receive-message");
            socket.off("message-status");
            socket.off("user-typing");
            socket.off("user-stopped-typing");
            socket.disconnect();
        };
    }, [roomId, nickname, userLimit, router]);

    const sendMessage = async () => {
        if (!inputMessage.trim() || !myKeys.current) return;

        // Clear typing indicator immediately
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        socket.emit("typing-stop", { roomId });

        try {
            // 1. Generate Session AES Key
            const aesKey = await generateSymKey();

            // 2. Encrypt Message with AES Key
            const encryptedContent = await encryptSymMessage(aesKey, inputMessage);

            // 3. Export AES Key
            const rawAesKey = await exportSymKey(aesKey);

            // 4. Encrypt AES Key for EACH participant
            const keysMap: Record<string, string> = {};

            // For other users
            for (const [userId, pubKey] of otherUsersKeys.current.entries()) {
                const encryptedAesKey = await encryptMessage(pubKey, rawAesKey);
                keysMap[userId] = encryptedAesKey;
            }

            const messageId = crypto.randomUUID();

            // Send to server
            socket.emit("send-message", {
                roomId,
                payload: {
                    content: encryptedContent,
                    keys: keysMap,
                },
                senderId: socket.id,
                messageId,
            });

            // Add to local UI
            setMessages((prev) => [
                ...prev,
                {
                    id: messageId,
                    senderId: "me",
                    content: inputMessage,
                    timestamp: Date.now(),
                    status: "sent",
                },
            ]);

            setInputMessage("");
        } catch (err) {
            console.error("Failed to send message:", err);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputMessage(e.target.value);

        // Emit typing-start
        console.log("Emitting typing-start to room:", roomId);
        socket.emit("typing-start", { roomId });

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to emit typing-stop after 2 seconds
        typingTimeoutRef.current = setTimeout(() => {
            console.log("Emitting typing-stop to room:", roomId);
            socket.emit("typing-stop", { roomId });
        }, 2000);
    };

    const handleEmojiClick = (emojiData: any) => {
        const emoji = emojiData.emoji;
        const input = inputRef.current;

        if (input) {
            const start = input.selectionStart || 0;
            const end = input.selectionEnd || 0;
            const newValue = inputMessage.substring(0, start) + emoji + inputMessage.substring(end);
            setInputMessage(newValue);

            // Set cursor position after emoji
            setTimeout(() => {
                input.focus();
                input.setSelectionRange(start + emoji.length, start + emoji.length);
            }, 0);
        } else {
            setInputMessage(inputMessage + emoji);
        }

        setShowEmojiPicker(false);
    };

    const getTypingIndicator = () => {
        if (typingUsers.size === 0) return null;

        const typingNames = Array.from(typingUsers).map(socketId =>
            nicknames.get(socketId) || `User ${socketId.slice(0, 4)}`
        );

        if (typingNames.length === 1) {
            return `${typingNames[0]} is typing...`;
        } else if (typingNames.length === 2) {
            return `${typingNames[0]} and ${typingNames[1]} are typing...`;
        } else {
            return `${typingNames.length} people are typing...`;
        }
    };

    return (
        <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
            <Card className="flex-1 flex flex-col bg-slate-900 border-slate-800">
                <CardHeader className="border-b border-slate-800 py-3 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-400" />
                        <CardTitle className="text-slate-100 text-lg">Room: {roomId}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <User className="w-4 h-4" />
                        <span>{participantCount} Online</span>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`} />
                    </div>
                </CardHeader>

                <CardContent className="flex-1 p-0 overflow-hidden relative">
                    <ScrollArea className="h-full p-4">
                        <div className="space-y-4 pb-4">
                            {messages.map((msg) => {
                                const isMe = msg.senderId === "me";
                                const senderName = isMe ? "Me" : (nicknames.get(msg.senderId) || `User ${msg.senderId.slice(0, 4)}`);

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                                    >
                                        {!isMe && (
                                            <span className="text-[10px] text-slate-400 mb-1 ml-1">
                                                {senderName}
                                            </span>
                                        )}
                                        <div
                                            className={`max-w-[80%] rounded-lg px-4 py-2 ${isMe
                                                ? "bg-emerald-600 text-white"
                                                : "bg-slate-800 text-slate-100"
                                                }`}
                                        >
                                            <p>{msg.content}</p>
                                            <span className="text-[10px] opacity-50 block mt-1 flex items-center justify-end gap-1">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                                {isMe && (
                                                    <span>
                                                        {msg.status === "sending" && <Check className="w-3 h-3 text-slate-400" />}
                                                        {msg.status === "sent" && <Check className="w-3 h-3 text-slate-300" />}
                                                        {msg.status === "delivered" && <CheckCheck className="w-3 h-3 text-slate-300" />}
                                                        {msg.status === "read" && <CheckCheck className="w-3 h-3 text-blue-400" />}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>
                </CardContent>

                <div className="p-4 border-t border-slate-800 bg-slate-900">
                    {typingUsers.size > 0 && (
                        <div className="text-xs text-slate-400 mb-2 italic">
                            {getTypingIndicator()}
                        </div>
                    )}
                    <div className="relative">
                        {showEmojiPicker && (
                            <div className="absolute bottom-full right-0 mb-2 z-50">
                                <EmojiPicker
                                    onEmojiClick={handleEmojiClick}
                                    theme={"dark" as any}
                                    lazyLoadEmojis={true}
                                />
                            </div>
                        )}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                sendMessage();
                            }}
                            className="flex gap-2"
                        >
                            <div className="relative flex-1">
                                <Input
                                    ref={inputRef}
                                    value={inputMessage}
                                    onChange={handleInputChange}
                                    placeholder="Type a secure message..."
                                    className="bg-slate-950 border-slate-800 text-slate-100 focus:ring-emerald-500 pr-10"
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-slate-800"
                                >
                                    <Smile className="h-4 w-4 text-slate-400 hover:text-emerald-400" />
                                </Button>
                            </div>
                            <Button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={!isConnected}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                    </div>
                </div>
            </Card>
        </div>
    );
}
