"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { useAuth } from "@/contexts/AuthWrapper";
import { Api } from "@/lib/api";
import { connectSocket, getSocket, joinGameRoom, leaveGameRoom } from "@/lib/socket";
import type { GameState, TerminationReason_I } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function GamePage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const gameId = params.gameId as string;

    const [gameState, setGameState] = useState<GameState | null>(null);
    const [myColor, setMyColor] = useState<"white" | "black">("white");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [localWhiteMs, setLocalWhiteMs] = useState(0);
    const [localBlackMs, setLocalBlackMs] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadGame = useCallback(async () => {
        try {
            setError(null);
            const state = await Api.get<GameState>(`/games/${gameId}`);
            setGameState(state);
            setLocalWhiteMs(state.whiteClockMs);
            setLocalBlackMs(state.blackClockMs);

            const whiteId = state.participants.white.userId;
            const blackId = state.participants.black.userId;
            const currentUserId = user?.userId;
            if (currentUserId === whiteId) {
                setMyColor("white");
            } else if (currentUserId === blackId) {
                setMyColor("black");
            }
        } catch {
            setError("Could not load this game.");
            router.push("/play");
        } finally {
            setIsLoading(false);
        }
    }, [gameId, router, user?.userId]);

    useEffect(() => {
        void loadGame();
    }, [loadGame]);

    useEffect(() => {
        connectSocket();
        joinGameRoom(gameId);
        const socket = getSocket();
        const onState = (state: GameState) => {
            setGameState(state);
            setLocalWhiteMs(state.whiteClockMs);
            setLocalBlackMs(state.blackClockMs);
        };
        const onEnd = (payload: { result: GameState["result"]; terminationReason: TerminationReason_I | null }) => {
            setGameState((prev) =>
                prev
                    ? {
                          ...prev,
                          status: "finished",
                          result: payload.result,
                          terminationReason: payload.terminationReason,
                      }
                    : null
            );
        };
        socket.on("gameState", onState);
        socket.on("gameEnded", onEnd);
        return () => {
            leaveGameRoom(gameId);
            socket.off("gameState", onState);
            socket.off("gameEnded", onEnd);
        };
    }, [gameId]);

    useEffect(() => {
        if (gameState?.status !== "active") {
            return;
        }
        const side = gameState.sideToMove;
        const id = setInterval(() => {
            if (side === "white") {
                setLocalWhiteMs((w) => Math.max(0, w - 1000));
            } else {
                setLocalBlackMs((b) => Math.max(0, b - 1000));
            }
        }, 1000);
        return () => clearInterval(id);
    }, [gameState?.status, gameState?.sideToMove]);

    const isMyTurn = gameState?.sideToMove === myColor;
    const isGameOver = gameState?.status === "finished";
    const canMove =
        gameState?.isParticipant === true && !isGameOver && isMyTurn && !isSubmitting;

    const handlePieceDrop = useCallback(
        async (
            sourceSquare: string | null,
            targetSquare: string | null,
            pieceType: string
        ) => {
            if (!sourceSquare || !targetSquare) {
                return;
            }
            if (!gameState || !canMove) {
                return;
            }
            let uci = `${sourceSquare}${targetSquare}`;
            const isPawn = pieceType.toLowerCase() === "p";
            if (isPawn && (targetSquare[1] === "8" || targetSquare[1] === "1")) {
                uci += "q";
            }

            const whiteClockMs = localWhiteMs;
            const blackClockMs = localBlackMs;

            setIsSubmitting(true);
            try {
                await Api.post(`/games/${gameId}/move`, {
                    uci,
                    whiteClockMs,
                    blackClockMs,
                });
                await loadGame();
            } catch {
                await loadGame();
            } finally {
                setIsSubmitting(false);
            }
        },
        [gameId, gameState, canMove, loadGame, localWhiteMs, localBlackMs]
    );

    const whiteDisplay = localWhiteMs;
    const blackDisplay = localBlackMs;

    const handleResign = async () => {
        await Api.post(`/games/${gameId}/resign`, {});
        await loadGame();
    };

    const handleOfferDraw = async () => {
        await Api.post(`/games/${gameId}/draw/offer`, {});
    };

    const handleAcceptDraw = async () => {
        await Api.post(`/games/${gameId}/draw/accept`, {});
        await loadGame();
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-zinc-600">
                Loading game…
            </div>
        );
    }

    if (error || !gameState) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
                {error ?? "Game unavailable."}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                    type="button"
                    onClick={() => router.push("/play")}
                    className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline"
                >
                    ← Lobby
                </button>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => void handleOfferDraw()}
                        disabled={!!isGameOver}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 disabled:opacity-40"
                    >
                        Offer draw
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleAcceptDraw()}
                        disabled={!!isGameOver}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm disabled:opacity-40"
                    >
                        Accept draw
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleResign()}
                        disabled={!!isGameOver}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-red-700 disabled:opacity-40"
                    >
                        Resign
                    </button>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[minmax(280px,420px)_1fr] lg:items-start">
                <div className="mx-auto w-full max-w-[420px] space-y-4">
                    <ClockCard
                        label="Black"
                        ms={blackDisplay}
                        rating={gameState.participants.black.ratingBefore}
                        active={gameState.sideToMove === "black" && !isGameOver}
                        highlight={myColor === "black"}
                    />
                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-inner">
                        <Chessboard
                            options={{
                                position: gameState.currentFen,
                                boardOrientation: myColor,
                                allowDragging: canMove,
                                onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
                                    void handlePieceDrop(
                                        sourceSquare,
                                        targetSquare,
                                        piece.pieceType
                                    );
                                    return true;
                                },
                            }}
                        />
                    </div>
                    <ClockCard
                        label="White"
                        ms={whiteDisplay}
                        rating={gameState.participants.white.ratingBefore}
                        active={gameState.sideToMove === "white" && !isGameOver}
                        highlight={myColor === "white"}
                    />
                </div>

                <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                            Moves
                        </h2>
                        <MoveList moves={gameState.moves} />
                    </div>

                    {isGameOver && (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                            <h3 className="text-lg font-semibold text-zinc-900">Game over</h3>
                            <p className="mt-2 text-2xl font-semibold text-zinc-800">
                                {gameState.result === "white_win" && "White wins"}
                                {gameState.result === "black_win" && "Black wins"}
                                {gameState.result === "draw" && "Draw"}
                            </p>
                            <p className="mt-2 text-sm capitalize text-zinc-600">
                                {gameState.terminationReason?.replace(/_/g, " ") ?? ""}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ClockCard(props: {
    label: string;
    ms: number;
    rating: number | null;
    active: boolean;
    highlight: boolean;
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm",
                props.active ? "border-emerald-400 bg-emerald-50/80" : "border-zinc-200 bg-white",
                props.highlight && "ring-2 ring-zinc-900/10"
            )}
        >
            <div>
                <div className="text-xs font-medium uppercase text-zinc-500">{props.label}</div>
                <div className="text-sm text-zinc-700">{props.rating ?? "—"} rating</div>
            </div>
            <div className="font-mono text-2xl tabular-nums text-zinc-900">{formatTime(props.ms)}</div>
        </div>
    );
}

function MoveList({
    moves,
}: {
    moves: GameState["moves"];
}) {
    const rows: { num: number; white?: string; black?: string }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
        const whiteMove = moves[i];
        const blackMove = moves[i + 1];
        if (whiteMove?.color === "white") {
            rows.push({
                num: whiteMove.moveNumber,
                white: whiteMove.san,
                black: blackMove?.color === "black" ? blackMove.san : undefined,
            });
        }
    }

    return (
        <div className="mt-3 max-h-72 overflow-y-auto font-mono text-sm">
            <div className="grid grid-cols-[2rem_1fr_1fr] gap-x-2 gap-y-1">
                {rows.map((p) => (
                    <div key={`${p.num}-${p.white ?? ""}-${p.black ?? ""}`} className="contents">
                        <span className="text-zinc-400">{p.num}.</span>
                        <span>{p.white ?? ""}</span>
                        <span>{p.black ?? ""}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function formatTime(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
