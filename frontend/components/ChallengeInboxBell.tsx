"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useChallengeInbox } from "@/contexts/ChallengeInboxContext";
import { cn } from "@/lib/utils";

export function ChallengeInboxBell() {
    const { challenges, incomingCount, accept, decline, withdraw } = useChallengeInbox();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!panelRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const incoming = challenges.filter((c) => c.isIncoming);
    const outgoing = challenges.filter((c) => !c.isIncoming);

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={cn(
                    "relative rounded-md p-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900",
                    incomingCount > 0 && "text-amber-700"
                )}
                aria-label="Challenges"
            >
                <Bell className="h-5 w-5" />
                {incomingCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
                        {incomingCount > 9 ? "9+" : incomingCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-zinc-200 bg-white py-2 shadow-xl">
                    <div className="border-b border-zinc-100 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Challenges
                    </div>

                    {incoming.length === 0 && outgoing.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-zinc-500">
                            No pending challenges.
                        </p>
                    ) : (
                        <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
                            {incoming.length > 0 && (
                                <div className="px-2 pt-2">
                                    <div className="px-2 pb-1 text-[11px] font-medium uppercase text-zinc-400">
                                        Incoming
                                    </div>
                                    <ul className="space-y-2">
                                        {incoming.map((c) => (
                                            <li
                                                key={c.id}
                                                className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3"
                                            >
                                                <p className="text-sm font-medium text-zinc-900">
                                                    {c.challengerUsername ?? "Someone"} challenged you
                                                </p>
                                                <p className="mt-1 text-xs text-zinc-500">
                                                    {c.timeClass} · {c.initialSeconds}s + {c.incrementSeconds}{" "}
                                                    · {c.rated ? "Rated" : "Casual"}
                                                </p>
                                                <div className="mt-2 flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => void accept(c.id)}
                                                        className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void decline(c.id)}
                                                        className="flex-1 rounded-md border border-zinc-300 bg-white py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                                                    >
                                                        Decline
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {outgoing.length > 0 && (
                                <div className="px-2 pb-2 pt-3">
                                    <div className="px-2 pb-1 text-[11px] font-medium uppercase text-zinc-400">
                                        Outgoing
                                    </div>
                                    <ul className="space-y-2">
                                        {outgoing.map((c) => (
                                            <li
                                                key={c.id}
                                                className="rounded-lg border border-zinc-100 bg-white p-3"
                                            >
                                                <p className="text-sm text-zinc-800">
                                                    Waiting for{" "}
                                                    <span className="font-medium">
                                                        {c.opponentUsername ?? "opponent"}
                                                    </span>
                                                </p>
                                                <p className="mt-1 text-xs text-zinc-500">
                                                    {c.timeClass} · {c.rated ? "Rated" : "Casual"}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => void withdraw(c.id)}
                                                    className="mt-2 w-full rounded-md border border-zinc-300 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                                >
                                                    Withdraw
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
