const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// Track room users: RoomId -> UserId -> SocketCount
const roomUsers = new Map();
// Track room limits: RoomId -> Limit
const roomLimits = new Map();
// Track nicknames: SocketId -> Nickname
const socketNicknames = new Map();

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    const userId = socket.handshake.auth.userId;

    if (!userId) {
        console.log("No userId provided, ignoring");
        return;
    }

    socket.on("join-room", async ({ roomId, nickname, userLimit }) => {
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
        const roomUserMap = roomUsers.get(roomId);

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
        // Broadcast to others in the room
        socket.to(data.roomId).emit("receive-message", data);
    });

    socket.on("message-delivered", (data) => {
        // data: { roomId, messageId, senderId, recipientId }
        io.to(data.roomId).emit("message-status", {
            messageId: data.messageId,
            status: "delivered",
            recipientId: data.recipientId,
            originalSenderId: data.senderId
        });
    });

    socket.on("message-read", (data) => {
        io.to(data.roomId).emit("message-status", {
            messageId: data.messageId,
            status: "read",
            recipientId: data.recipientId,
            originalSenderId: data.senderId
        });
    });

    socket.on("signal", (data) => {
        // WebRTC/Key Exchange signaling
        // data: { target, signal, sender }
        io.to(data.target).emit("signal", {
            sender: socket.id,
            signal: data.signal,
        });
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

httpServer.listen(3001, () => {
    console.log("Test server ready on http://localhost:3001");
});
