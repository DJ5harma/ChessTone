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

export interface UserResponse_I {
    id: string;
    username: string;
    displayName: string | null;
    countryCode: string | null;
    createdAt: Date;
}

export interface AuthPayload_I {
    userId: string;
    username: string;
}

export interface GameState_I {
    id: string;
    status: GameStatus_I;
    rated: boolean;
    timeClass: TimeClass_I;
    initialSeconds: number;
    incrementSeconds: number;
    delaySeconds: number;
    startingFen: string;
    currentFen: string;
    sideToMove: ChessColor_I;
    whiteClockMs: number;
    blackClockMs: number;
    halfmoveClock: number;
    fullmoveNumber: number;
    result: GameResult_I;
    terminationReason: TerminationReason_I | null;
    startedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface GameParticipant_I {
    gameId: string;
    userId: string;
    color: ChessColor_I;
    joinedAt: Date;
    leftAt: Date | null;
    ratingBefore: number | null;
    ratingAfter: number | null;
    ratingDelta: number | null;
    username?: string;
}

export interface Move_I {
    id: number;
    gameId: string;
    plyIndex: number;
    moveNumber: number;
    color: ChessColor_I;
    uci: string;
    san: string;
    fenBefore: string;
    fenAfter: string;
    whiteClockMs: number;
    blackClockMs: number;
    playedAt: Date;
}