import { useState, useEffect, useRef, useCallback } from "react";
import { socket } from "@/lib/socket";

const STUN_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

export function useWebRTC(roomId: string) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

    const createPeer = useCallback((targetSocketId: string, initiator: boolean, stream: MediaStream) => {
        const peer = new RTCPeerConnection(STUN_SERVERS);
        peersRef.current.set(targetSocketId, peer);

        // Add local tracks
        stream.getTracks().forEach(track => peer.addTrack(track, stream));

        // Handle ICE candidates
        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("signal", {
                    target: targetSocketId,
                    signal: { type: "ice-candidate", candidate: event.candidate }
                });
            }
        };

        // Handle remote stream
        peer.ontrack = (event) => {
            console.log("Received remote track from:", targetSocketId);
            setRemoteStreams(prev => {
                const newMap = new Map(prev);
                newMap.set(targetSocketId, event.streams[0]);
                return newMap;
            });
        };

        // Create Offer if initiator
        if (initiator) {
            peer.createOffer()
                .then(offer => peer.setLocalDescription(offer))
                .then(() => {
                    socket.emit("signal", {
                        target: targetSocketId,
                        signal: { type: "offer", sdp: peer.localDescription }
                    });
                })
                .catch(err => console.error("Error creating offer:", err));
        }

        return peer;
    }, []);

    const joinCall = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            // socket.emit("join-call", { roomId }); // Moved to useEffect
            return stream;
        } catch (err) {
            console.error("Error accessing media devices:", err);
            alert("Could not access camera/microphone");
            return null;
        }
    }, [roomId]);

    const leaveCall = useCallback(() => {
        // Stop local stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }

        // Close all peers
        peersRef.current.forEach(peer => peer.close());
        peersRef.current.clear();
        setRemoteStreams(new Map());

        socket.emit("leave-call", { roomId });
    }, [localStream, roomId]);

    useEffect(() => {
        if (!localStream) return;

        const handleUserConnected = ({ socketId }: { socketId: string }) => {
            console.log("User connected to call:", socketId);
            // Initiate connection to new user
            createPeer(socketId, true, localStream);
        };

        const handleUserDisconnected = ({ socketId }: { socketId: string }) => {
            console.log("User disconnected from call:", socketId);
            if (peersRef.current.has(socketId)) {
                peersRef.current.get(socketId)!.close();
                peersRef.current.delete(socketId);
            }
            setRemoteStreams(prev => {
                const newMap = new Map(prev);
                newMap.delete(socketId);
                return newMap;
            });
        };

        const handleSignal = async (data: { sender: string; signal: any }) => {
            const { sender, signal } = data;

            // Ignore key exchange signals (offer-key, answer-key)
            if (signal.type === "offer-key" || signal.type === "answer-key") return;

            let peer = peersRef.current.get(sender);

            if (!peer) {
                // If receiving offer, create peer (not initiator)
                if (signal.type === "offer") {
                    peer = createPeer(sender, false, localStream);
                } else {
                    console.warn("Received signal for unknown peer:", sender);
                    return;
                }
            }

            try {
                if (signal.type === "offer") {
                    await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);
                    socket.emit("signal", {
                        target: sender,
                        signal: { type: "answer", sdp: peer.localDescription }
                    });
                } else if (signal.type === "answer") {
                    await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                } else if (signal.type === "ice-candidate") {
                    await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
                }
            } catch (err) {
                console.error("Error handling signal:", err);
            }
        };

        socket.on("user-connected-to-call", handleUserConnected);
        socket.on("user-disconnected-from-call", handleUserDisconnected);
        socket.on("signal", handleSignal);

        // Emit join-call AFTER listeners are set up
        socket.emit("join-call", { roomId });

        return () => {
            socket.off("user-connected-to-call", handleUserConnected);
            socket.off("user-disconnected-from-call", handleUserDisconnected);
            socket.off("signal", handleSignal);
            socket.emit("leave-call", { roomId }); // Ensure we leave when component unmounts/stream changes
        };
    }, [localStream, createPeer, roomId]);

    return { localStream, remoteStreams, joinCall, leaveCall };
}
