"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Api } from "@/lib/api";
import { connectSocket, onMatchFound } from "@/lib/socket";

type QueuePayload = {
    inQueue: boolean;
    activeGameId?: string;
    queuePosition?: number;
};

export default function QueuePage() {
    const router = useRouter();
    const [phase, setPhase] = useState<"waiting" | "leaving">("waiting");
    const [waitSeconds, setWaitSeconds] = useState(0);

    useEffect(() => {
        connectSocket();
        const unsub = onMatchFound(({ gameId }) => {
            router.replace(`/play/${gameId}`);
        });
        return () => {
            unsub();
        };
    }, [router]);

    useEffect(() => {
        const tick = setInterval(() => setWaitSeconds((t) => t + 1), 1000);
        return () => clearInterval(tick);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            try {
                const status = await Api.get<QueuePayload>("/matchmaking/queue/status");
                if (cancelled) {
                    return;
                }
                if (status.activeGameId) {
                    router.replace(`/play/${status.activeGameId}`);
                    return;
                }
                if (!status.inQueue) {
                    router.replace("/play");
                }
            } catch {
                router.replace("/play");
            }
        };

        poll();
        const interval = setInterval(poll, 2000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [router]);

    const handleLeave = async () => {
        setPhase("leaving");
        try {
            await Api.post("/matchmaking/queue/leave", {});
        } finally {
            router.push("/play");
        }
    };

    const minutes = Math.floor(waitSeconds / 60);
    const seconds = waitSeconds % 60;

    if (phase === "leaving") {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-zinc-600">
                Leaving queue…
            </div>
        );
    }

    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
            <div className="text-5xl" aria-hidden>
                ♟
            </div>
            <h1 className="mt-8 text-2xl font-semibold text-zinc-900">Finding an opponent</h1>
            <p className="mt-3 text-zinc-600">
                Waiting {minutes}:{seconds.toString().padStart(2, "0")}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
                You will join automatically when the server pairs you. Stay on this page.
            </p>
            <button
                type="button"
                onClick={() => void handleLeave()}
                className="mt-10 rounded-lg border border-zinc-300 bg-white px-6 py-2.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
                Cancel
            </button>
        </div>
    );
}
