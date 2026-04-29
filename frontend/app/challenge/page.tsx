"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Api } from "@/lib/api";
import { useChallengeInbox } from "@/contexts/ChallengeInboxContext";

type SearchHit = { id: string; username: string; displayName: string | null };

export default function ChallengePage() {
    const router = useRouter();
    const { refresh } = useChallengeInbox();
    const [query, setQuery] = useState("");
    const [hits, setHits] = useState<SearchHit[]>([]);
    const [selected, setSelected] = useState<SearchHit | null>(null);
    const [rated, setRated] = useState(true);
    const [timeClass, setTimeClass] = useState<"bullet" | "blitz" | "rapid" | "classical">("blitz");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const search = async () => {
        setError(null);
        const q = query.trim();
        if (!q) {
            setHits([]);
            return;
        }
        try {
            const res = await Api.get<SearchHit[]>(`/users?q=${encodeURIComponent(q)}&limit=15`);
            setHits(res);
        } catch {
            setError("Search failed.");
        }
    };

    const sendChallenge = async () => {
        if (!selected) {
            setError("Select an opponent.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await Api.post("/matchmaking/challenge", {
                opponentId: selected.id,
                rated,
                timeClass,
                initialSeconds: tcInitial(timeClass),
                incrementSeconds: tcInc(timeClass),
                delaySeconds: 0,
            });
            await refresh();
            router.push("/play");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not create challenge.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mx-auto max-w-lg space-y-8">
            <div>
                <h1 className="text-2xl font-semibold text-zinc-900">Challenge</h1>
                <p className="mt-2 text-sm text-zinc-600">
                    Search by username, pick your opponent, then send a rated or casual challenge.
                </p>
            </div>

            <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <label className="block text-sm font-medium text-zinc-700">Find user</label>
                <div className="flex gap-2">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void search()}
                        className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm"
                        placeholder="Username"
                    />
                    <button
                        type="button"
                        onClick={() => void search()}
                        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                    >
                        Search
                    </button>
                </div>

                {hits.length > 0 && (
                    <ul className="max-h-48 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/80">
                        {hits.map((h) => (
                            <li key={h.id}>
                                <button
                                    type="button"
                                    onClick={() => setSelected(h)}
                                    className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-white ${
                                        selected?.id === h.id ? "bg-white ring-1 ring-zinc-300" : ""
                                    }`}
                                >
                                    <span className="font-medium text-zinc-900">{h.username}</span>
                                    {h.displayName && (
                                        <span className="text-xs text-zinc-500">{h.displayName}</span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className="text-xs font-medium text-zinc-500">Time class</label>
                        <select
                            value={timeClass}
                            onChange={(e) =>
                                setTimeClass(e.target.value as typeof timeClass)
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        >
                            <option value="bullet">Bullet</option>
                            <option value="blitz">Blitz</option>
                            <option value="rapid">Rapid</option>
                            <option value="classical">Classical</option>
                        </select>
                    </div>
                    <div className="flex items-end gap-2 pb-1">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                            <input
                                type="checkbox"
                                checked={rated}
                                onChange={(e) => setRated(e.target.checked)}
                                className="rounded border-zinc-400"
                            />
                            Rated
                        </label>
                    </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                    type="button"
                    disabled={busy || !selected}
                    onClick={() => void sendChallenge()}
                    className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-40"
                >
                    {busy ? "Sending…" : "Send challenge"}
                </button>
            </div>

            <button
                type="button"
                onClick={() => router.push("/play")}
                className="text-sm text-zinc-600 underline-offset-4 hover:underline"
            >
                ← Back to play
            </button>
        </div>
    );
}

function tcInitial(tc: string): number {
    switch (tc) {
        case "bullet":
            return 60;
        case "blitz":
            return 180;
        case "rapid":
            return 600;
        case "classical":
            return 1800;
        default:
            return 180;
    }
}

function tcInc(tc: string): number {
    switch (tc) {
        case "bullet":
            return 0;
        case "blitz":
            return 2;
        case "rapid":
            return 5;
        case "classical":
            return 30;
        default:
            return 2;
    }
}
