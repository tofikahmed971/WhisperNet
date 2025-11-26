const io = require("socket.io-client");

const SERVER_URL = "http://localhost:3001";
const ROOM_ID = "receipts-test-room";

const createClient = (name) => {
    const socket = io(SERVER_URL, {
        auth: { userId: `user-${name}` },
    });
    return socket;
};

const client1 = createClient("Sender");
const client2 = createClient("Receiver");

client1.on("connect", () => {
    console.log("Sender connected");
    client1.emit("join-room", { roomId: ROOM_ID });
});

client1.onAny((event, ...args) => {
    console.log(`Sender received event: ${event}`);
});

client2.on("connect", () => {
    console.log("Receiver connected");
    client2.emit("join-room", { roomId: ROOM_ID });
});

// Flow:
// 1. Sender sends message
// 2. Receiver receives -> emits delivered -> emits read
// 3. Sender receives status updates

const messageId = "test-msg-id-123";

client1.on("message-status", (data) => {
    console.log(`Sender received status update: ${data.status} for msg ${data.messageId}`);
});

client2.on("receive-message", (data) => {
    console.log("Receiver got message:", data.messageId);

    // Simulate frontend behavior
    console.log("Receiver emitting delivered...");
    client2.emit("message-delivered", {
        roomId: ROOM_ID,
        messageId: data.messageId,
        senderId: data.senderId,
        recipientId: client2.id
    });

    setTimeout(() => {
        console.log("Receiver emitting read...");
        client2.emit("message-read", {
            roomId: ROOM_ID,
            messageId: data.messageId,
            senderId: data.senderId,
            recipientId: client2.id
        });
    }, 1000);
});

setTimeout(() => {
    console.log("Sender sending message...");
    client1.emit("send-message", {
        roomId: ROOM_ID,
        payload: { content: "encrypted", keys: {} }, // Dummy payload
        senderId: "user-Sender", // In real app this is socket.id usually, but server uses what we send? 
        // Wait, server uses socket.id for sender usually? 
        // In ChatRoom.tsx: senderId: socket.id
        messageId: messageId
    });
}, 2000);

setTimeout(() => {
    client1.disconnect();
    client2.disconnect();
    console.log("Done");
}, 5000);
