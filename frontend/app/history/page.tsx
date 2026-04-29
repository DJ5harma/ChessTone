"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthWrapper";
import { Api } from "@/lib/api";
import type { GameHistoryEntry } from "@/lib/types";
import {
    formatHistoryClock,
    opponentLabel,
    terminationLabel,
    viewerRatingDelta,
    viewerWasWhite,
} from "@/lib/historyDisplay";
import { cn } from "@/lib/utils";

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
                <p className="mt-2 text-zinc-600">
                    Opponent, result, time control, and when each game ended. Open a row to review on the board.
                </p>
            </div>

            {games.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center text-zinc-500">
                    No finished games yet.
                </div>
            ) : (
                <ul className="space-y-3">
                    {games.map((game) => {
                        const outcome = outcomeForUser(game, user.userId);
                        const delta = viewerRatingDelta(game, user.userId);
                        const ended = game.endedAt ? parseISO(game.endedAt) : null;
                        const started = game.startedAt ? parseISO(game.startedAt) : null;

                        return (
                            <li key={game.id}>
                                <button
                                    type="button"
                                    onClick={() => router.push(`/play/${game.id}`)}
                                    className="flex w-full flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                                >
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                            <span
                                                className={cn(
                                                    "text-lg font-semibold tabular-nums",
                                                    outcome === "Win" && "text-emerald-700",
                                                    outcome === "Loss" && "text-red-600",
                                                    outcome === "Draw" && "text-zinc-600"
                                                )}
                                            >
                                                {outcome}
                                            </span>
                                            <span className="truncate font-medium text-zinc-900">
                                                vs {opponentLabel(game, user.userId)}
                                            </span>
                                            {game.vsComputer && (
                                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                                                    Computer
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
                                            <span className="capitalize">{game.timeClass}</span>
                                            <span className="text-zinc-400">·</span>
                                            <span className="font-mono text-zinc-700">
                                                {formatHistoryClock(game)}
                                            </span>
                                            <span className="text-zinc-400">·</span>
                                            <span>{game.rated ? "Rated" : "Casual"}</span>
                                            <span className="text-zinc-400">·</span>
                                            <span>
                                                {viewerWasWhite(game, user.userId)
                                                    ? "You · White"
                                                    : "You · Black"}
                                            </span>
                                            <span className="text-zinc-400">·</span>
                                            <span>{game.moveCount} moves</span>
                                            {game.terminationReason && (
                                                <>
                                                    <span className="text-zinc-400">·</span>
                                                    <span>{terminationLabel(game.terminationReason)}</span>
                                                </>
                                            )}
                                        </div>
                                        {(started || ended) && (
                                            <div className="text-xs text-zinc-500">
                                                {started && (
                                                    <span>
                                                        Started {format(started, "MMM d, yyyy · HH:mm")}
                                                    </span>
                                                )}
                                                {started && ended && <span className="mx-2">→</span>}
                                                {ended && (
                                                    <span>Ended {format(ended, "MMM d, yyyy · HH:mm")}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1 sm:text-right">
                                        {game.rated && delta != null && (
                                            <span
                                                className={cn(
                                                    "font-mono text-sm font-semibold tabular-nums",
                                                    delta > 0 && "text-emerald-700",
                                                    delta < 0 && "text-red-600",
                                                    delta === 0 && "text-zinc-600"
                                                )}
                                            >
                                                {delta > 0 ? `+${delta}` : `${delta}`} rating
                                            </span>
                                        )}
                                        {game.rated && delta == null && (
                                            <span className="text-xs text-zinc-400">Rating —</span>
                                        )}
                                        {!game.rated && (
                                            <span className="text-xs text-zinc-400">Unrated</span>
                                        )}
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
