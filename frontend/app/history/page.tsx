"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthWrapper";
import { Api } from "@/lib/api";
import type { GameHistoryEntry } from "@/lib/types";

function outcomeForUser(game: GameHistoryEntry, userId: string): string {
    if (game.result === "draw") {
        return "Draw";
    }
    const isWhite = game.participants.white.userId === userId;
    if (game.result === "white_win") {
        return isWhite ? "Win" : "Loss";
    }
    if (game.result === "black_win") {
        return isWhite ? "Loss" : "Win";
    }
    return "—";
}

export default function HistoryPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [games, setGames] = useState<GameHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        void loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const result = await Api.get<GameHistoryEntry[]>("/games/history");
            setGames(result);
        } catch {
            /* ignore */
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) {
        return null;
    }

    if (isLoading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-zinc-600">
                Loading history…
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Game history</h1>
                <p className="mt-2 text-zinc-600">Open a game to review moves on the board.</p>
            </div>

            {games.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center text-zinc-500">
                    No finished games yet.
                </div>
            ) : (
                <ul className="space-y-2">
                    {games.map((game) => (
                        <li key={game.id}>
                            <button
                                type="button"
                                onClick={() => router.push(`/play/${game.id}`)}
                                className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                            >
                                <div className="flex flex-wrap items-center gap-3">
                                    <span
                                        className={`font-semibold ${
                                            outcomeForUser(game, user.userId) === "Win"
                                                ? "text-emerald-700"
                                                : outcomeForUser(game, user.userId) === "Loss"
                                                  ? "text-red-600"
                                                  : "text-zinc-600"
                                        }`}
                                    >
                                        {outcomeForUser(game, user.userId)}
                                    </span>
                                    <span className="capitalize text-zinc-600">{game.timeClass}</span>
                                    <span className="text-sm text-zinc-400">
                                        {game.rated ? "Rated" : "Casual"}
                                    </span>
                                </div>
                                <span className="text-sm text-zinc-500">
                                    {game.endedAt ? new Date(game.endedAt).toLocaleString() : ""}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
