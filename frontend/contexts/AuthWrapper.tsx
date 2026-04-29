"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import type { AuthResponse, UserProfile } from "@/lib/types";
import { AppShell } from "@/components/AppShell";

interface AuthContextType {
    user: { userId: string; username: string } | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthWrapper");
    }
    return context;
}

export function AuthWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<{ userId: string; username: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showAuth, setShowAuth] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            setShowAuth(true);
            setIsLoading(false);
            return;
        }

        Api.get<AuthResponse>("/auth/me")
            .then((profile) => {
                const p = profile as unknown as UserProfile;
                const uId = p.userId || p.id;
                setUser({ userId: uId, username: p.username || "" });
                connectSocket();
            })
            .catch(() => {
                localStorage.removeItem("token");
                setShowAuth(true);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const login = async (username: string, password: string) => {
        const response = await Api.post<AuthResponse>("/auth/login", { username, password });
        localStorage.setItem("token", response.token);
        setUser({ userId: response.userId, username: response.username || "" });
        setShowAuth(false);
        connectSocket();
        router.push("/play");
    };

    const register = async (username: string, password: string) => {
        const response = await Api.post<AuthResponse>("/auth/register", { username, password });
        localStorage.setItem("token", response.token);
        setUser({ userId: response.userId, username });
        setShowAuth(false);
        connectSocket();
        router.push("/play");
    };

    const logout = () => {
        localStorage.removeItem("token");
        setUser(null);
        disconnectSocket();
        setShowAuth(true);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">Loading...</div>
            </div>
        );
    }

    if (showAuth || !user) {
        return (
            <AuthForm
                onLogin={login}
                onRegister={register}
            />
        );
    }

    return (
        <AuthContext.Provider value={{ user, isLoading: false, login, register, logout }}>
            <AppShell>{children}</AppShell>
        </AuthContext.Provider>
    );
}

function AuthForm({ onLogin, onRegister }: { onLogin: (u: string, p: string) => Promise<void>; onRegister: (u: string, p: string) => Promise<void> }) {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            if (isRegister) {
                await onRegister(username, password);
            } else {
                await onLogin(username, password);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
                <h1 className="text-2xl font-bold text-center mb-6">ChessTone</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                            minLength={6}
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm">{error}</div>}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                    >
                        {isLoading ? "Loading..." : isRegister ? "Register" : "Login"}
                    </button>
                </form>

                <div className="mt-4 text-center">
                    <button
                        onClick={() => setIsRegister(!isRegister)}
                        className="text-blue-500 hover:underline"
                    >
                        {isRegister ? "Already have an account? Login" : "Need an account? Register"}
                    </button>
                </div>
            </div>
        </div>
    );
}