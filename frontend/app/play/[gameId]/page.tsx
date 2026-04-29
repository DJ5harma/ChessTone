"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { useAuth } from "@/contexts/AuthWrapper";
import { Api } from "@/lib/api";
import { connectSocket, getSocket, joinGameRoom, leaveGameRoom } from "@/lib/socket";
import type { GameState, TerminationReason_I } from "@/lib/types";
import { fenAfterAppliedMoves } from "@/lib/chessReplay";
import { GameReplayBar } from "@/components/GameReplayBar";
import { EvalBar } from "@/components/EvalBar";
import { usePositionAnalysis } from "@/hooks/usePositionAnalysis";
import { analysisSubtitle, uciToBestMoveArrow } from "@/lib/analysis/evalDisplay";
import { cn } from "@/lib/utils";
import { StockfishBrowser } from "@/lib/analysis/stockfishBrowser";

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
    const [replayCursor, setReplayCursor] = useState(0);
    const [analysisOn, setAnalysisOn] = useState(false);
    const clocksRef = useRef({ white: 0, black: 0 });
    const computerMoveGenRef = useRef(0);

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

            if (state.status === "finished") {
                setReplayCursor(state.moves.length);
            } else {
                setReplayCursor(0);
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
        if (gameState?.status === "finished") {
            setAnalysisOn(true);
        } else if (gameState?.status === "active") {
            setAnalysisOn(false);
        }
    }, [gameState?.status]);

    useEffect(() => {
        clocksRef.current = { white: localWhiteMs, black: localBlackMs };
    }, [localWhiteMs, localBlackMs]);

    useEffect(() => {
        connectSocket();
        joinGameRoom(gameId);
        const socket = getSocket();
        const onState = (state: GameState) => {
            setGameState(state);
            setLocalWhiteMs(state.whiteClockMs);
            setLocalBlackMs(state.blackClockMs);
            if (state.status === "finished") {
                setReplayCursor(state.moves.length);
            } else {
                setReplayCursor(0);
            }
        };
        const onEnd = (payload: {
            result: GameState["result"];
            terminationReason: TerminationReason_I | null;
        }) => {
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

    useEffect(() => {
        if (!gameState || gameState.status !== "finished") {
            return;
        }
        const max = gameState.moves.length;
        setReplayCursor((c) => Math.min(c, max));
    }, [gameState?.status, gameState?.moves.length]);

    const isGameOver = gameState?.status === "finished";
    const maxReplay = gameState?.moves.length ?? 0;

    useEffect(() => {
        if (!isGameOver || !gameState) {
            return;
        }
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest?.("input, textarea, select, [contenteditable=true]")) {
                return;
            }
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                setReplayCursor((c) => Math.max(0, c - 1));
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                setReplayCursor((c) => Math.min(maxReplay, c + 1));
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isGameOver, gameState, maxReplay]);

    const isMyTurn = gameState?.sideToMove === myColor;
    const canMove =
        gameState?.isParticipant === true && !isGameOver && isMyTurn && !isSubmitting;

    const boardFen = useMemo(() => {
        if (!gameState) {
            return "";
        }
        if (isGameOver) {
            return fenAfterAppliedMoves(
                gameState.moves,
                replayCursor,
                gameState.startingFen
            );
        }
        return gameState.currentFen;
    }, [gameState, isGameOver, replayCursor]);

    const isComputerTurn = useMemo(
        () =>
            gameState != null &&
            gameState.isParticipant &&
            gameState.vsComputer === true &&
            gameState.status === "active" &&
            gameState.sideToMove !== myColor,
        [gameState, myColor]
    );

    const analysisDepth = 14;
    const { result: analysisResult, loading: analysisLoading, error: analysisError } =
        usePositionAnalysis(boardFen, analysisOn && !!boardFen && !isComputerTurn, analysisDepth);

    const analysisArrows = useMemo(() => {
        if (!analysisOn || !analysisResult?.bestMoveUci) {
            return [] as { startSquare: string; endSquare: string; color: string }[];
        }
        const a = uciToBestMoveArrow(analysisResult.bestMoveUci);
        return a ? [a] : [];
    }, [analysisOn, analysisResult]);

    useEffect(() => {
        if (!gameState?.vsComputer || gameState.status !== "active" || !gameState.isParticipant) {
            return;
        }
        if (gameState.sideToMove === myColor) {
            return;
        }

        const id = ++computerMoveGenRef.current;
        let cancelled = false;

        void (async () => {
            setIsSubmitting(true);
            try {
                const analysis = await StockfishBrowser.analyze(gameState.currentFen, 14);
                if (cancelled || id !== computerMoveGenRef.current) {
                    return;
                }
                if (!analysis.bestMoveUci) {
                    return;
                }
                await Api.post(`/games/${gameId}/move`, {
                    uci: analysis.bestMoveUci,
                    whiteClockMs: clocksRef.current.white,
                    blackClockMs: clocksRef.current.black,
                });
                if (cancelled || id !== computerMoveGenRef.current) {
                    return;
                }
                await loadGame();
            } catch {
                if (!cancelled && id === computerMoveGenRef.current) {
                    await loadGame();
                }
            } finally {
                if (id === computerMoveGenRef.current) {
                    setIsSubmitting(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        gameState?.vsComputer,
        gameState?.status,
        gameState?.sideToMove,
        gameState?.currentFen,
        gameState?.isParticipant,
        myColor,
        gameId,
        loadGame,
    ]);

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

    const showingReplay = isGameOver && maxReplay > 0;
    const isVsComputer = gameState.vsComputer === true;

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
                    {!isVsComputer && (
                        <>
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
                        </>
                    )}
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

            {showingReplay && (
                <GameReplayBar
                    cursor={replayCursor}
                    max={maxReplay}
                    onCursorChange={setReplayCursor}
                />
            )}

            <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                    <input
                        type="checkbox"
                        className="size-4 rounded border-zinc-300"
                        checked={analysisOn}
                        onChange={(e) => setAnalysisOn(e.target.checked)}
                    />
                    Engine analysis (local Stockfish)
                </label>
                {analysisOn && (
                    <span className="text-xs text-zinc-500">
                        {analysisLoading
                            ? "Analyzing…"
                            : analysisError ?? analysisSubtitle(analysisResult)}
                    </span>
                )}
            </div>

            <div className="grid gap-8 lg:grid-cols-[minmax(280px,420px)_1fr] lg:items-start">
                <div className="mx-auto w-full max-w-[420px] space-y-4">
                    <ClockCard
                        label={isVsComputer ? (myColor === "black" ? "You" : "Stockfish") : "Black"}
                        ms={blackDisplay}
                        rating={
                            isVsComputer && myColor === "white"
                                ? null
                                : gameState.participants.black.ratingBefore
                        }
                        active={gameState.sideToMove === "black" && !isGameOver}
                        highlight={myColor === "black"}
                    />
                    <div className="flex flex-row items-stretch justify-center gap-2">
                        {analysisOn && (
                            <EvalBar
                                cp={analysisResult?.cp}
                                mate={analysisResult?.mate}
                                loading={analysisLoading}
                                label={analysisSubtitle(analysisResult)}
                            />
                        )}
                        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-inner">
                            <Chessboard
                                options={{
                                    position: boardFen,
                                    boardOrientation: myColor,
                                    allowDragging: canMove,
                                    arrows: analysisArrows,
                                    clearArrowsOnPositionChange: false,
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
                    </div>
                    <ClockCard
                        label={isVsComputer ? (myColor === "white" ? "You" : "Stockfish") : "White"}
                        ms={whiteDisplay}
                        rating={
                            isVsComputer && myColor === "black"
                                ? null
                                : gameState.participants.white.ratingBefore
                        }
                        active={gameState.sideToMove === "white" && !isGameOver}
                        highlight={myColor === "white"}
                    />
                </div>

                <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                            Moves
                        </h2>
                        <ReplayMoveList
                            moves={gameState.moves}
                            replayCursor={isGameOver ? replayCursor : gameState.moves.length}
                            interactive={isGameOver && maxReplay > 0}
                            onGoTo={(applied) => setReplayCursor(applied)}
                        />
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

function ReplayMoveList({
    moves,
    replayCursor,
    interactive,
    onGoTo,
}: {
    moves: GameState["moves"];
    replayCursor: number;
    interactive: boolean;
    onGoTo: (appliedCount: number) => void;
}) {
    const rows: {
        num: number;
        white?: { san: string; halfIdx: number };
        black?: { san: string; halfIdx: number };
    }[] = [];

    for (let i = 0; i < moves.length; i++) {
        const w = moves[i];
        if (!w || w.color !== "white") {
            continue;
        }
        const b = moves[i + 1]?.color === "black" ? moves[i + 1] : undefined;
        rows.push({
            num: w.moveNumber,
            white: { san: w.san, halfIdx: i },
            black: b ? { san: b.san, halfIdx: i + 1 } : undefined,
        });
        if (b) {
            i++;
        }
    }

    const activeHalfIdx = replayCursor > 0 ? replayCursor - 1 : -1;

    return (
        <div className="mt-3 max-h-72 overflow-y-auto font-mono text-sm">
            <div className="flex flex-col gap-1">
                {rows.map((row) => (
                    <div key={row.num} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="w-7 shrink-0 text-zinc-400">{row.num}.</span>
                        {row.white && (
                            <button
                                type="button"
                                disabled={!interactive}
                                onClick={() => onGoTo(row.white!.halfIdx + 1)}
                                className={cn(
                                    "min-w-[2.75rem] rounded px-1.5 py-0.5 text-left",
                                    interactive && "hover:bg-zinc-100",
                                    activeHalfIdx === row.white!.halfIdx && "bg-amber-100 font-semibold text-zinc-900"
                                )}
                            >
                                {row.white.san}
                            </button>
                        )}
                        {row.black && (
                            <button
                                type="button"
                                disabled={!interactive}
                                onClick={() => onGoTo(row.black!.halfIdx + 1)}
                                className={cn(
                                    "min-w-[2.75rem] rounded px-1.5 py-0.5 text-left",
                                    interactive && "hover:bg-zinc-100",
                                    activeHalfIdx === row.black!.halfIdx && "bg-amber-100 font-semibold text-zinc-900"
                                )}
                            >
                                {row.black.san}
                            </button>
                        )}
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
