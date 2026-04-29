"use client";

import { useRouter } from "next/navigation";
import { Api } from "@/lib/api";

export default function PlayPage() {
    const router = useRouter();

    const handleJoinQueue = async (timeClass: string, rated: boolean) => {
        const result = await Api.post<{ matched?: boolean; gameId?: string }>("/matchmaking/queue/join", {
            timeClass,
            rated,
            initialSeconds: getInitialSeconds(timeClass),
            incrementSeconds: getIncrement(timeClass),
            delaySeconds: 0,
        });

        if (result.gameId) {
            router.push(`/play/${result.gameId}`);
            return;
        }

        router.push("/queue");
    };

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Play</h1>
                <p className="mt-2 text-zinc-600">
                    Quick match by time control, or challenge someone from the Challenge page.
                </p>
            </div>

            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-zinc-900">Quick play</h2>
                <p className="mt-1 text-sm text-zinc-500">Find an opponent with matching pool settings.</p>
                <div className="mt-6 space-y-4">
                    {[
                        { name: "Bullet", timeClass: "bullet", label: "1+0" },
                        { name: "Blitz", timeClass: "blitz", label: "3+2" },
                        { name: "Rapid", timeClass: "rapid", label: "10+5" },
                        { name: "Classical", timeClass: "classical", label: "30+30" },
                    ].map((tc) => (
                        <div
                            key={tc.timeClass}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                        >
                            <div className="text-sm font-medium text-zinc-700">
                                {tc.name}{" "}
                                <span className="font-normal text-zinc-500">({tc.label})</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleJoinQueue(tc.timeClass, true)}
                                    className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-zinc-800 sm:flex-none"
                                >
                                    Rated
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleJoinQueue(tc.timeClass, false)}
                                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 sm:flex-none"
                                >
                                    Casual
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
                <button
                    type="button"
                    onClick={() => router.push("/challenge")}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-6 text-left shadow-sm transition hover:bg-emerald-50"
                >
                    <div className="text-lg font-semibold text-emerald-900">Challenge</div>
                    <p className="mt-2 text-sm text-emerald-800/90">Invite a player by username.</p>
                </button>
                <button
                    type="button"
                    onClick={() => router.push("/history")}
                    className="rounded-xl border border-violet-200 bg-violet-50/80 p-6 text-left shadow-sm transition hover:bg-violet-50"
                >
                    <div className="text-lg font-semibold text-violet-900">History</div>
                    <p className="mt-2 text-sm text-violet-900/80">Review finished games and results.</p>
                </button>
            </section>
        </div>
    );
}

function getInitialSeconds(timeClass: string): number {
    switch (timeClass) {
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

function getIncrement(timeClass: string): number {
    switch (timeClass) {
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
