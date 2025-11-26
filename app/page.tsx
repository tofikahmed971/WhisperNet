"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Shield, Zap, Eye, Users, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import Image from "next/image";

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [userLimit, setUserLimit] = useState("10");
  const [showJoinModal, setShowJoinModal] = useState(false);

  const createRoom = async () => {
    if (!nickname.trim()) {
      alert("Please enter a nickname");
      return;
    }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/room/${code}?nickname=${encodeURIComponent(nickname)}&limit=${userLimit}`);
  };

  const joinRoom = () => {
    if (!nickname.trim()) {
      alert("Please enter a nickname");
      return;
    }
    if (roomCode.trim()) {
      router.push(`/room/${roomCode.toUpperCase()}?nickname=${encodeURIComponent(nickname)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      {/* Hero Section */}
      <nav className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Lock className="w-6 h-6 text-slate-950" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              WhisperNet
            </span>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6">
        {/* Hero Content */}
        <div className="pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 mb-8">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">End-to-End Encrypted</span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Private Conversations,
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Zero Traces
            </span>
          </h1>

          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
            Secure, ephemeral chat rooms with military-grade encryption.
            No registration, no history, no compromises.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              onClick={() => setShowJoinModal(true)}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-6 text-lg font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-white px-8 py-6 text-lg backdrop-blur-sm"
            >
              Learn More
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-24">
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-emerald-500/50 transition-all group">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Lock className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">E2E Encryption</h3>
                <p className="text-slate-400">
                  Every message encrypted with unique keys. Nobody can intercept your conversations.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-emerald-500/50 transition-all group">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Eye className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Tracking</h3>
                <p className="text-slate-400">
                  Zero data collection. No accounts required. Your privacy is absolute.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-emerald-500/50 transition-all group">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Instant Setup</h3>
                <p className="text-slate-400">
                  Create or join rooms in seconds. No downloads, no hassle.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Features List */}
          <div className="max-w-4xl mx-auto mb-24">
            <h2 className="text-3xl font-bold text-white mb-12">
              Everything you need for secure communication
            </h2>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              {[
                { icon: MessageSquare, title: "Real-time Messaging", desc: "Instant message delivery with read receipts" },
                { icon: Users, title: "Group Chats", desc: "Secure rooms for multiple participants" },
                { icon: Shield, title: "Perfect Forward Secrecy", desc: "New keys for every session" },
                { icon: CheckCircle2, title: "Typing Indicators", desc: "Know when others are responding" },
              ].map((feature, i) => (
                <div key={i} className="flex gap-4 items-start p-4 rounded-lg bg-slate-900/30 border border-slate-800/50">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-slate-400 text-sm">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="container mx-auto px-6 text-center text-slate-500 text-sm">
          <p>© 2025 WhisperNet. Secure by design.</p>
        </div>
      </footer>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowJoinModal(false)}>
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Join WhisperNet</h2>
                <p className="text-slate-400 text-sm">Enter a nickname to get started</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Your Nickname</label>
                <Input
                  placeholder="Enter your display name"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-800">
                <label className="text-sm font-medium text-slate-300">Create Room</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Max Users"
                    value={userLimit}
                    onChange={(e) => setUserLimit(e.target.value)}
                    className="w-24 bg-slate-950 border-slate-800 text-slate-100 focus:ring-emerald-500"
                    min={2}
                    max={50}
                  />
                  <Button
                    onClick={createRoom}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold"
                  >
                    Create Room
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-500">Or join existing</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Join Room</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Room Code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-100 focus:ring-emerald-500"
                  />
                  <Button
                    onClick={joinRoom}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-100"
                  >
                    Join
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
