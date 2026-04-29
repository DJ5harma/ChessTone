"use client";

import {
    ChevronFirst,
    ChevronLast,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type GameReplayBarProps = {
    cursor: number;
    max: number;
    onCursorChange: (n: number) => void;
    className?: string;
};

/** cursor = number of half-moves applied (0 … max). */
export function GameReplayBar({ cursor, max, onCursorChange, className }: GameReplayBarProps) {
    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm",
                className
            )}
        >
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    title="Start position"
                    className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30"
                    disabled={cursor <= 0}
                    onClick={() => onCursorChange(0)}
                >
                    <ChevronFirst className="h-5 w-5" />
                </button>
                <button
                    type="button"
                    title="Previous move"
                    className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30"
                    disabled={cursor <= 0}
                    onClick={() => onCursorChange(cursor - 1)}
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                    type="button"
                    title="Next move"
                    className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30"
                    disabled={cursor >= max}
                    onClick={() => onCursorChange(cursor + 1)}
                >
                    <ChevronRight className="h-5 w-5" />
                </button>
                <button
                    type="button"
                    title="Final position"
                    className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30"
                    disabled={cursor >= max}
                    onClick={() => onCursorChange(max)}
                >
                    <ChevronLast className="h-5 w-5" />
                </button>
            </div>

            <label className="flex min-w-[10rem] flex-1 items-center gap-2">
                <span className="sr-only">Move</span>
                <input
                    type="range"
                    min={0}
                    max={max}
                    value={cursor}
                    onChange={(e) => onCursorChange(Number.parseInt(e.target.value, 10))}
                    className="h-2 flex-1 cursor-pointer accent-zinc-900"
                />
                <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-zinc-600">
                    {cursor}/{max}
                </span>
            </label>

            <span className="hidden text-xs text-zinc-400 sm:inline">Arrow keys</span>
        </div>
    );
}
