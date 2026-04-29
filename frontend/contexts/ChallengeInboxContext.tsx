"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthWrapper";
import { Api } from "@/lib/api";
import { connectSocket, getSocket } from "@/lib/socket";
import type { ChallengeListItem } from "@/lib/types";

type ChallengeReceivedPayload = {
    challenge: ChallengeListItem;
};

interface ChallengeInboxContextValue {
    challenges: ChallengeListItem[];
    incomingCount: number;
    refresh: () => Promise<void>;
    accept: (challengeId: string) => Promise<void>;
    decline: (challengeId: string) => Promise<void>;
    withdraw: (challengeId: string) => Promise<void>;
}

const ChallengeInboxContext = createContext<ChallengeInboxContextValue | null>(null);

function mergeById(prev: ChallengeListItem[], next: ChallengeListItem): ChallengeListItem[] {
    const idx = prev.findIndex((c) => c.id === next.id);
    if (idx === -1) {
        return [...prev, next];
    }
    const copy = [...prev];
    copy[idx] = next;
    return copy;
}

export function ChallengeInboxProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);

    const refresh = useCallback(async () => {
        if (!user) {
            return;
        }
        try {
            const list = await Api.get<ChallengeListItem[]>("/matchmaking/challenge");
            setChallenges(list);
        } catch {
            /* ignore */
        }
    }, [user]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        connectSocket();
        const socket = getSocket();

        const onReceived = (payload: ChallengeReceivedPayload) => {
            setChallenges((prev) => mergeById(prev, payload.challenge));
        };

        const removeById = (challengeId: string) => {
            setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
        };

        const onWithdrawn = ({ challengeId }: { challengeId: string }) => {
            removeById(challengeId);
        };

        const onDeclined = ({ challengeId }: { challengeId: string }) => {
            removeById(challengeId);
        };

        const onAccepted = (payload: { challengeId: string; gameId: string }) => {
            removeById(payload.challengeId);
            const next = `/play/${payload.gameId}`;
            if (pathname === next) {
                return;
            }
            router.push(next);
        };

        socket.on("challengeReceived", onReceived);
        socket.on("challengeWithdrawn", onWithdrawn);
        socket.on("challengeDeclined", onDeclined);
        socket.on("challengeAccepted", onAccepted);

        return () => {
            socket.off("challengeReceived", onReceived);
            socket.off("challengeWithdrawn", onWithdrawn);
            socket.off("challengeDeclined", onDeclined);
            socket.off("challengeAccepted", onAccepted);
        };
    }, [router, pathname]);

    const accept = useCallback(
        async (challengeId: string) => {
            const res = await Api.post<{ game: { id: string } }>(
                `/matchmaking/challenge/${challengeId}/accept`,
                {}
            );
            setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
            router.push(`/play/${res.game.id}`);
        },
        [router]
    );

    const decline = useCallback(async (challengeId: string) => {
        await Api.post(`/matchmaking/challenge/${challengeId}/decline`, {});
        setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
    }, []);

    const withdraw = useCallback(async (challengeId: string) => {
        await Api.post(`/matchmaking/challenge/${challengeId}/withdraw`, {});
        setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
    }, []);

    const incomingCount = useMemo(
        () => challenges.filter((c) => c.isIncoming).length,
        [challenges]
    );

    const value = useMemo(
        () => ({
            challenges,
            incomingCount,
            refresh,
            accept,
            decline,
            withdraw,
        }),
        [challenges, incomingCount, refresh, accept, decline, withdraw]
    );

    return (
        <ChallengeInboxContext.Provider value={value}>{children}</ChallengeInboxContext.Provider>
    );
}

export function useChallengeInbox() {
    const ctx = useContext(ChallengeInboxContext);
    if (!ctx) {
        throw new Error("useChallengeInbox must be used within ChallengeInboxProvider");
    }
    return ctx;
}
