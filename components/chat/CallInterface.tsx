"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { Card } from "@/components/ui/card";

interface CallInterfaceProps {
    localStream: MediaStream | null;
    remoteStreams: Map<string, MediaStream>;
    onLeave: () => void;
    nicknames: Map<string, string>;
}

export default function CallInterface({ localStream, remoteStreams, onLeave, nicknames }: CallInterfaceProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsVideoOff(!isVideoOff);
        }
    };

    return (
        <div className="fixed inset-0 bg-background/95 z-50 flex flex-col p-4">
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 p-4 overflow-y-auto">
                {/* Local Video */}
                <Card className="relative overflow-hidden bg-black/50 aspect-video flex items-center justify-center">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`w-full h-full object-cover ${isVideoOff ? "hidden" : ""}`}
                    />
                    {isVideoOff && (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            Video Off
                        </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
                        You {isMuted && "(Muted)"}
                    </div>
                </Card>

                {/* Remote Videos */}
                {Array.from(remoteStreams.entries()).map(([socketId, stream]) => (
                    <RemoteVideo
                        key={socketId}
                        stream={stream}
                        nickname={nicknames.get(socketId) || `User ${socketId.slice(0, 4)}`}
                    />
                ))}
            </div>

            {/* Controls */}
            <div className="h-20 flex items-center justify-center gap-4 bg-card border-t border-border rounded-t-xl">
                <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="icon"
                    className="rounded-full h-12 w-12"
                    onClick={toggleMute}
                >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button
                    variant="destructive"
                    size="icon"
                    className="rounded-full h-14 w-14"
                    onClick={onLeave}
                >
                    <PhoneOff className="w-6 h-6" />
                </Button>
                <Button
                    variant={isVideoOff ? "destructive" : "secondary"}
                    size="icon"
                    className="rounded-full h-12 w-12"
                    onClick={toggleVideo}
                >
                    {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </Button>
            </div>
        </div>
    );
}

function RemoteVideo({ stream, nickname }: { stream: MediaStream; nickname: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <Card className="relative overflow-hidden bg-black/50 aspect-video flex items-center justify-center">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
                {nickname}
            </div>
        </Card>
    );
}
