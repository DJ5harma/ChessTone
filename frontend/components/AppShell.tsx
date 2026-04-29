"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthWrapper";
import { cn } from "@/lib/utils";

const nav = [
    { href: "/play", label: "Play" },
    { href: "/history", label: "History" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    if (!user) {
        return <>{children}</>;
    }

    return (
        <div className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
            <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
                    <Link href="/play" className="font-semibold tracking-tight text-zinc-900">
                        ChessTone
                    </Link>
                    <nav className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
                        {nav.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                    pathname === item.href || pathname.startsWith(item.href + "/")
                                        ? "bg-zinc-900 text-white"
                                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link
                            href={`/profile/${encodeURIComponent(user.username)}`}
                            className={cn(
                                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                pathname.startsWith("/profile")
                                    ? "bg-zinc-900 text-white"
                                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                            )}
                        >
                            Profile
                        </Link>
                    </nav>
                    <div className="flex items-center gap-3">
                        <span className="hidden max-w-[12rem] truncate text-sm text-zinc-500 sm:inline">
                            {user.username}
                        </span>
                        <button
                            type="button"
                            onClick={() => logout()}
                            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        </div>
    );
}
