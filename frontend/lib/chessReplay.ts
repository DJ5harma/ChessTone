import { Chess } from "chess.js";
import type { Square } from "chess.js";

export const STANDARD_START_FEN =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Apply a UCI move (or SAN fallback) — mirrors server logic. */
export function applyUci(chess: Chess, uci: string) {
    const clean = uci.trim();
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(clean)) {
        const promotion = clean[4]?.toLowerCase() as "q" | "r" | "b" | "n" | undefined;
        return chess.move({
            from: clean.slice(0, 2) as Square,
            to: clean.slice(2, 4) as Square,
            ...(promotion ? { promotion } : {}),
        });
    }
    return chess.move(clean);
}

/**
 * `appliedCount` = number of half-moves applied from `moves` (0 … moves.length).
 */
export function fenAfterAppliedMoves(
    moves: { uci: string }[],
    appliedCount: number,
    startingFen?: string | null
): string {
    const fen = startingFen?.trim() || STANDARD_START_FEN;
    const chess = new Chess(fen);
    const n = Math.min(Math.max(0, appliedCount), moves.length);
    for (let i = 0; i < n; i++) {
        const row = moves[i];
        if (!row?.uci) {
            break;
        }
        applyUci(chess, row.uci);
    }
    return chess.fen();
}
