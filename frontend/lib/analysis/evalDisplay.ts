import type { AnalysisResult_I } from "@/lib/analysis/stockfishBrowser";

/** 0 = all Black, 100 = all White (lichess-style vertical bar fill from bottom). */
export function evalBarWhitePercent(cp?: number, mate?: number): number {
    if (mate !== undefined && mate !== 0) {
        return mate > 0 ? 94 : 6;
    }
    const c = cp ?? 0;
    const p = 50 + 45 * Math.tanh(c / 220);
    return Math.min(97, Math.max(3, p));
}

export function formatEval(cp?: number, mate?: number): string {
    if (mate !== undefined && mate !== 0) {
        return mate > 0 ? `+M${mate}` : `-M${Math.abs(mate)}`;
    }
    const c = cp ?? 0;
    const x = (c / 100).toFixed(1);
    return `${c >= 0 ? "+" : ""}${x}`;
}

export function uciToBestMoveArrow(
    uci: string,
    color = "rgba(22, 163, 74, 0.92)"
): { startSquare: string; endSquare: string; color: string } | null {
    if (!uci || uci.length < 4) {
        return null;
    }
    const slice = uci.slice(0, 4);
    return {
        startSquare: slice.slice(0, 2),
        endSquare: slice.slice(2, 4),
        color,
    };
}

export function analysisSubtitle(res: AnalysisResult_I | null): string {
    if (!res) {
        return "";
    }
    const evalStr = formatEval(res.cp, res.mate);
    const bm = res.bestMoveUci ? ` Best ${res.bestMoveUci}` : "";
    return `${evalStr} · d${res.depth}${bm}`;
}
