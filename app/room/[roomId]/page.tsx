import ChatRoom from "@/components/chat/ChatRoom";

interface PageProps {
    params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: PageProps) {
    const { roomId } = await params;

    return (
        <div className="min-h-screen bg-slate-950">
            <ChatRoom roomId={roomId} />
        </div>
    );
}
