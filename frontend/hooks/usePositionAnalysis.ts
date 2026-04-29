"use client";

import { useEffect, useState } from "react";
import { StockfishBrowser, type AnalysisResult_I } from "@/lib/analysis/stockfishBrowser";

export function usePositionAnalysis(
    fen: string,
    enabled: boolean,
    depth = 14,
    debounceMs = 280
): {
    result: AnalysisResult_I | null;
    loading: boolean;
    error: string | null;
} {
    const [result, setResult] = useState<AnalysisResult_I | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled || !fen.trim()) {
            setResult(null);
            setError(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            setLoading(true);
            setError(null);
            StockfishBrowser.analyze(fen, depth)
                .then((r) => {
                    if (!cancelled) {
                        setResult(r);
                    }
                })
                .catch((e: unknown) => {
                    if (!cancelled) {
                        setError(e instanceof Error ? e.message : "Analysis failed");
                        setResult(null);
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setLoading(false);
                    }
                });
        }, debounceMs);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [fen, enabled, depth, debounceMs]);

    return { result, loading, error };
}
