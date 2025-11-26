import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dbConnect from "./lib/db";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "8000", 10);
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(async () => {
    try {
        await dbConnect(); // Connect to DB on startup
    } catch (e) {
        console.warn("MongoDB connection failed, running in memory-only mode:", e);
    }

    const httpServer = createServer(handler);

    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    console.log("✓ Socket.IO server initialized");

    // Track room users: RoomId -> UserId -> SocketCount
    const roomUsers = new Map<string, Map<string, number>>();
    // Track room limits: RoomId -> Limit
    const roomLimits = new Map<string, number>();
    // Track nicknames: SocketId -> Nickname
    const socketNicknames = new Map<string, string>();

    io.on("connection", (socket) => {
        console.log("\n========================================");
        console.log("NEW CLIENT CONNECTED:", socket.id);
        console.log("========================================\n");
        process.stdout.write(''); // Force flush

        const userId = socket.handshake.auth.userId;

        if (!userId) {
            console.log("No userId provided, ignoring");
            return;
        }

        socket.on("join-room", async ({ roomId, nickname, userLimit }: { roomId: string; nickname?: string; userLimit?: number }) => {
            // Set limit if provided (room creation)
            if (userLimit && !roomLimits.has(roomId)) {
                roomLimits.set(roomId, userLimit);
            }

            // Check limit
            const currentLimit = roomLimits.get(roomId) || 10; // Default 10
            const users = roomUsers.get(roomId);
            const currentUniqueUsers = users ? users.size : 0;

            // If user is NEW to the room (not just a refresh) and room is full
            const isNewUser = !users || !users.has(userId);

            if (isNewUser && currentUniqueUsers >= currentLimit) {
                socket.emit("error", "Room is full");
                return;
            }

            socket.join(roomId);
            if (nickname) {
                socketNicknames.set(socket.id, nickname);
            }
            console.log(`Socket ${socket.id} (User ${userId}) joined room ${roomId}`);

            // Initialize room tracking if needed
            if (!roomUsers.has(roomId)) {
                roomUsers.set(roomId, new Map());
            }
            const roomUserMap = roomUsers.get(roomId)!;

            // Increment socket count for this user
            const currentCount = roomUserMap.get(userId) || 0;
            roomUserMap.set(userId, currentCount + 1);

            // ALWAYS notify others about the new socket for Key Exchange
            // Include nickname in the event
            socket.to(roomId).emit("user-joined", { socketId: socket.id, userId, nickname });

            // Broadcast new unique user count to EVERYONE (including sender)
            io.to(roomId).emit("room-info", { count: roomUserMap.size, limit: currentLimit });
        });

        socket.on("send-message", (data) => {
            // data: { roomId, encryptedMessage, senderId, messageId }
            console.log("Received send-message. MessageId:", data.messageId, "Room:", data.roomId, "Sender:", data.senderId);
            // Broadcast to others in the room
            socket.to(data.roomId).emit("receive-message", data);
            console.log("Broadcasted receive-message to room:", data.roomId);
        });

        socket.on("message-delivered", (data) => {
            // data: { roomId, messageId, senderId, recipientId }
            console.log("Received message-delivered:", data, "Broadcasting to room:", data.roomId);

            // Check who's in the room
            const roomSockets = io.sockets.adapter.rooms.get(data.roomId);
            console.log(`Room ${data.roomId} has sockets:`, roomSockets ? Array.from(roomSockets) : 'NONE');

            io.to(data.roomId).emit("message-status", {
                messageId: data.messageId,
                status: "delivered",
                recipientId: data.recipientId,
                originalSenderId: data.senderId
            });
            console.log("Broadcasted message-status (delivered) to room", data.roomId);
        });

        socket.on("message-read", (data) => {
            console.log("Received message-read:", data, "Broadcasting to room:", data.roomId);

            // Check who's in the room
            const roomSockets = io.sockets.adapter.rooms.get(data.roomId);
            console.log(`Room ${data.roomId} has sockets:`, roomSockets ? Array.from(roomSockets) : 'NONE');

            io.to(data.roomId).emit("message-status", {
                messageId: data.messageId,
                status: "read",
                recipientId: data.recipientId,
                originalSenderId: data.senderId
            });
            console.log("Broadcasted message-status (read) to room", data.roomId);
        });

        socket.on("signal", (data) => {
            // WebRTC/Key Exchange signaling
            // data: { target, signal, sender }
            io.to(data.target).emit("signal", {
                sender: socket.id,
                signal: data.signal,
            });
        });

        socket.on("typing-start", ({ roomId }) => {
            const nickname = socketNicknames.get(socket.id) || `User ${socket.id.slice(0, 4)}`;
            console.log(`Socket ${socket.id} (${nickname}) started typing in room ${roomId}`);

            // Check who's in the room
            const roomSockets = io.sockets.adapter.rooms.get(roomId);
            console.log(`Sockets in room ${roomId}:`, roomSockets ? Array.from(roomSockets) : 'none');
            console.log(`Broadcasting to room (excluding ${socket.id})`);

            socket.to(roomId).emit("user-typing", { socketId: socket.id, nickname });
            console.log(`Broadcasted user-typing to room ${roomId}`);
        });

        socket.on("typing-stop", ({ roomId }) => {
            console.log(`Socket ${socket.id} stopped typing in room ${roomId}`);
            socket.to(roomId).emit("user-stopped-typing", { socketId: socket.id });
            console.log(`Broadcasted user-stopped-typing to room ${roomId}`);
        });

        socket.on("disconnecting", () => {
            for (const roomId of socket.rooms) {
                if (roomId !== socket.id) {
                    const users = roomUsers.get(roomId);
                    if (users) {
                        const currentCount = users.get(userId) || 0;
                        if (currentCount > 1) {
                            users.set(userId, currentCount - 1);
                        } else {
                            users.delete(userId);
                            if (users.size === 0) {
                                roomUsers.delete(roomId);
                                roomLimits.delete(roomId);
                            }
                        }

                        // Always notify about socket leaving for Key Cleanup
                        socket.to(roomId).emit("user-left", { socketId: socket.id, userId });
                        socketNicknames.delete(socket.id);

                        // Broadcast new count
                        io.to(roomId).emit("room-info", { count: users.size });
                    }
                }
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
