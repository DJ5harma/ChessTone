"use client";

import { evalBarWhitePercent } from "@/lib/analysis/evalDisplay";

type EvalBarProps = {
    cp?: number;
    mate?: number;
    label?: string;
    loading?: boolean;
};

export function EvalBar(props: EvalBarProps) {
    const pct = evalBarWhitePercent(props.cp, props.mate);

    return (
        <div className="flex flex-col items-center gap-1">
            <div
                className="relative w-8 shrink-0 overflow-hidden rounded-md border border-zinc-300 bg-zinc-900 shadow-inner sm:w-9"
                style={{ minHeight: "min(420px, 85vw)" }}
                title={props.label}
            >
                <div
                    className="absolute bottom-0 left-0 right-0 bg-zinc-100 transition-[height] duration-300 ease-out"
                    style={{ height: `${pct}%` }}
                />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px bg-rose-500/70" />
            </div>
            {props.loading && (
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    …
                </span>
            )}
        </div>
    );
}
