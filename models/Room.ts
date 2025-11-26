import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
    roomId: string;
    createdAt: Date;
    expiresAt: Date;
}

const RoomSchema: Schema = new Schema({
    roomId: { type: String, required: true, unique: true },
    userLimit: { type: Number, default: 10 }, // Default limit
    participants: [
        {
            userId: String,
            nickname: String,
            joinedAt: { type: Date, default: Date.now },
        },
    ],
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, index: { expires: "1h" } }, // Auto-delete after 1 hour of inactivity (or custom logic)
});

export default mongoose.models.Room || mongoose.model<IRoom>('Room', RoomSchema);
