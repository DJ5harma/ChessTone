"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthWrapper";
import { Api } from "@/lib/api";
import { useState, useEffect } from "react";
import type { UserProfile } from "@/lib/types";

export default function ProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const username = params.username as string;
        if (username) {
            loadProfile(username);
        }
    }, [params.username]);

    const loadProfile = async (username: string) => {
        try {
            const result = await Api.get<UserProfile>(`/users/${username}`);
            setProfile(result);
        } catch {
            router.push("/play");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">Loading profile...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                <button onClick={() => router.push("/play")} className="mb-6 text-blue-500 hover:underline">
                    ← Back to Play
                </button>

                <div className="bg-white rounded-lg border p-6">
                    <h1 className="text-3xl font-bold mb-2">{profile?.username}</h1>
                    <p className="text-gray-500 mb-6">
                        Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ""}
                    </p>

                    <h2 className="text-xl font-semibold mb-4">Ratings</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {profile?.ratings.map((r) => (
                            <div key={r.timeClass} className="bg-gray-50 rounded-lg p-4">
                                <div className="text-sm text-gray-500 capitalize">{r.timeClass}</div>
                                <div className="text-2xl font-bold">{r.rating}</div>
                                <div className="text-sm text-gray-500">
                                    {r.gamesPlayed} games • {r.wins}W-{r.losses}L-{r.draws}D
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}