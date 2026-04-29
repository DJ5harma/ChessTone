import type { GameHistoryEntry, TerminationReason_I } from "@/lib/types";

/** e.g. 3+2, 1+0; falls back to seconds when not whole minutes */
export function formatHistoryClock(game: Pick<GameHistoryEntry, "initialSeconds" | "incrementSeconds" | "delaySeconds">): string {
    const { initialSeconds, incrementSeconds, delaySeconds } = game;
    if (initialSeconds % 60 === 0) {
        const m = initialSeconds / 60;
        let s = `${m}+${incrementSeconds}`;
        if (delaySeconds > 0) {
            s += ` (${delaySeconds}s delay)`;
        }
        return s;
    }
    let s = `${initialSeconds}s+${incrementSeconds}`;
    if (delaySeconds > 0) {
        s += ` (${delaySeconds}s delay)`;
    }
    return s;
}

export function opponentLabel(game: GameHistoryEntry, viewerUserId: string): string {
    const opp =
        game.participants.white.userId === viewerUserId
            ? game.participants.black
            : game.participants.white;
    return opp.displayName ?? opp.username ?? "Opponent";
}

export function viewerWasWhite(game: GameHistoryEntry, viewerUserId: string): boolean {
    return game.participants.white.userId === viewerUserId;
}

export function viewerRatingDelta(game: GameHistoryEntry, viewerUserId: string): number | null {
    const side = viewerWasWhite(game, viewerUserId) ? game.participants.white : game.participants.black;
    return side.ratingDelta;
}

const TERMINATION_LABELS: Partial<Record<TerminationReason_I, string>> = {
    checkmate: "Checkmate",
    resignation: "Resignation",
    timeout: "Time",
    stalemate: "Stalemate",
    draw_agreement: "Draw agreed",
    threefold_repetition: "Threefold",
    insufficient_material: "Insufficient material",
    fifty_move_rule: "50-move rule",
    abort: "Aborted",
    disconnect: "Disconnect",
};

export function terminationLabel(reason: TerminationReason_I | null): string {
    if (!reason) {
        return "";
    }
    return TERMINATION_LABELS[reason] ?? reason.replace(/_/g, " ");
}
