export type TimeClass_I = "bullet" | "blitz" | "rapid" | "classical";
export type ChessColor_I = "white" | "black";
export type GameStatus_I = "active" | "finished" | "aborted" | "cancelled";
export type GameResult_I = "white_win" | "black_win" | "draw" | "none";
export type TerminationReason_I =
    | "checkmate"
    | "resignation"
    | "timeout"
    | "stalemate"
    | "draw_agreement"
    | "threefold_repetition"
    | "insufficient_material"
    | "fifty_move_rule"
    | "abort"
    | "disconnect";
export type ChallengeStatus_I =
    | "pending"
    | "accepted"
    | "declined"
    | "withdrawn"
    | "expired";

export interface UserProfile {
    id: string;
    userId?: string;
    username: string;
    displayName: string | null;
    countryCode: string | null;
    createdAt: string;
    ratings: Array<{
        timeClass: TimeClass_I;
        rating: number;
        gamesPlayed: number;
        wins: number;
        losses: number;
        draws: number;
        peakRating: number;
    }>;
    isOnline: boolean;
}

export interface AuthResponse {
    token: string;
    userId: string;
    username?: string;
}

export interface GameState {
    id: string;
    status: GameStatus_I;
    rated: boolean;
    timeClass: TimeClass_I;
    initialSeconds: number;
    incrementSeconds: number;
    delaySeconds: number;
    currentFen: string;
    sideToMove: ChessColor_I;
    whiteClockMs: number;
    blackClockMs: number;
    result: GameResult_I;
    terminationReason: TerminationReason_I | null;
    participants: {
        white: {
            userId: string;
            ratingBefore: number | null;
            ratingAfter: number | null;
            ratingDelta: number | null;
        };
        black: {
            userId: string;
            ratingBefore: number | null;
            ratingAfter: number | null;
            ratingDelta: number | null;
        };
    };
    moves: Array<{
        plyIndex: number;
        moveNumber: number;
        color: ChessColor_I;
        uci: string;
        san: string;
        fenAfter: string;
    }>;
    isParticipant: boolean;
}

export interface GameHistoryEntry {
    id: string;
    timeClass: TimeClass_I;
    rated: boolean;
    result: GameResult_I;
    terminationReason: TerminationReason_I | null;
    endedAt: string | null;
    participants: {
        white: {
            userId: string;
            ratingBefore: number | null;
            ratingAfter: number | null;
            ratingDelta: number | null;
        };
        black: {
            userId: string;
            ratingBefore: number | null;
            ratingAfter: number | null;
            ratingDelta: number | null;
        };
    };
}

export interface QueueStatus {
    inQueue: boolean;
    matched?: boolean;
    game?: GameState;
    queuePosition?: number;
    queueEntry?: unknown;
}

export interface Challenge {
    id: string;
    challengerId: string;
    opponentId: string;
    rated: boolean;
    timeClass: TimeClass_I;
    initialSeconds: number;
    incrementSeconds: number;
    delaySeconds: number;
    createdAt: string;
    isIncoming: boolean;
}