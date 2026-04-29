/**
 * Browser Stockfish (WASM lite single-threaded) via Web Worker + UCI.
 * Engine assets live under /stockfish/ (copied from node_modules/stockfish/bin).
 */

export type AnalysisResult_I = {
    fen: string;
    depth: number;
    /** Centipawns from White's perspective (positive = White better). */
    cp?: number;
    /** Full moves until mate from White's perspective (+ White mates, − Black mates). */
    mate?: number;
    bestMoveUci: string;
    pvUci: string[];
};

function trimLine(s: string): string {
    return s.replace(/\r/g, "").trim();
}

/** UCI score is from the side-to-move's POV; normalize to White's POV. */
export function normalizeScoreToWhite(
    fen: string,
    cpOrMate: { cp?: number; mate?: number }
): { cp?: number; mate?: number } {
    const stm = fen.trim().split(/\s+/)[1];
    if (!stm || (stm !== "w" && stm !== "b")) {
        return cpOrMate;
    }
    if (cpOrMate.mate !== undefined) {
        const m = cpOrMate.mate;
        return { mate: stm === "w" ? m : -m };
    }
    if (cpOrMate.cp !== undefined) {
        const c = cpOrMate.cp;
        return { cp: stm === "w" ? c : -c };
    }
    return {};
}

function parseInfoLine(line: string): {
    depth?: number;
    cp?: number;
    mate?: number;
    pv: string[];
} {
    const depthMatch = /\bdepth (\d+)\b/.exec(line);
    const depth = depthMatch ? Number(depthMatch[1]) : undefined;

    let cp: number | undefined;
    let mate: number | undefined;
    const scoreCp = /\bscore cp (-?\d+)\b/.exec(line);
    const scoreMate = /\bscore mate (-?\d+)\b/.exec(line);
    if (scoreCp) {
        cp = Number(scoreCp[1]);
    }
    if (scoreMate) {
        mate = Number(scoreMate[1]);
    }

    let pv: string[] = [];
    const pvMatch = /\bpv (.+)$/.exec(line);
    if (pvMatch) {
        pv = pvMatch[1].trim().split(/\s+/).filter(Boolean);
    }

    return { depth, cp, mate, pv };
}

function parseBestMove(line: string): string | null {
    const parts = trimLine(line).split(/\s+/);
    if (parts[0] !== "bestmove" || parts.length < 2) {
        return null;
    }
    const bm = parts[1];
    return bm === "(none)" ? null : bm;
}

class StockfishBrowserImpl {
    private worker: Worker | null = null;
    private lineBuf: string[] = [];
    private waiters: Array<(line: string) => void> = [];
    private readyPromise: Promise<void> | null = null;
    private lockChain: Promise<void> = Promise.resolve();

    private enqueueLines(text: string): void {
        const chunks = text.split("\n");
        for (const chunk of chunks) {
            const line = trimLine(chunk);
            if (!line) {
                continue;
            }
            const w = this.waiters.shift();
            if (w) {
                w(line);
            } else {
                this.lineBuf.push(line);
            }
        }
    }

    private nextLine(): Promise<string> {
        const ready = this.lineBuf.shift();
        if (ready !== undefined) {
            return Promise.resolve(ready);
        }
        return new Promise((resolve) => {
            this.waiters.push(resolve);
        });
    }

    private send(cmd: string): void {
        if (!this.worker) {
            throw new Error("Stockfish worker not started");
        }
        this.worker.postMessage(cmd);
    }

    private async drainUntil(predicate: (line: string) => boolean): Promise<string> {
        while (true) {
            const line = await this.nextLine();
            if (predicate(line)) {
                return line;
            }
        }
    }

    private async ensureWorker(): Promise<void> {
        if (this.worker) {
            return;
        }
        if (typeof Worker === "undefined") {
            throw new Error("Web Workers not available");
        }
        this.worker = new Worker("/stockfish/stockfish-18-lite-single.js");
        this.worker.onmessage = (ev: MessageEvent<string>) => {
            const data = typeof ev.data === "string" ? ev.data : String(ev.data ?? "");
            this.enqueueLines(data);
        };
        this.worker.onerror = (ev) => {
            console.error("Stockfish worker error", ev);
        };
    }

    private async ensureReady(): Promise<void> {
        await this.ensureWorker();
        if (this.readyPromise) {
            return this.readyPromise;
        }
        this.readyPromise = (async () => {
            this.send("uci");
            await this.drainUntil((l) => l === "uciok");
            this.send("isready");
            await this.drainUntil((l) => l === "readyok");
            this.send("setoption name MultiPV value 1");
        })();
        return this.readyPromise;
    }

    /** Serialize calls — only one search at a time. */
    private withLock<T>(fn: () => Promise<T>): Promise<T> {
        const run = this.lockChain.then(fn);
        this.lockChain = run.then(
            () => undefined,
            () => undefined
        );
        return run;
    }

    async analyze(fen: string, depth: number): Promise<AnalysisResult_I> {
        return this.withLock(() => this.analyzeInner(fen, depth));
    }

    /** After `stop`, engine emits `bestmove`; poll buffer so we never orphan `nextLine` waiters. */
    private async drainAfterStop(): Promise<void> {
        const deadline = Date.now() + 400;
        while (Date.now() < deadline) {
            while (this.lineBuf.length > 0) {
                const line = this.lineBuf.shift()!;
                if (line.startsWith("bestmove")) {
                    return;
                }
            }
            await new Promise((r) => setTimeout(r, 12));
        }
    }

    private async analyzeInner(fen: string, depth: number): Promise<AnalysisResult_I> {
        await this.ensureReady();

        this.send("stop");
        await this.drainAfterStop();

        this.send("ucinewgame");
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);

        let lastDepth = 0;
        let lastScore: { cp?: number; mate?: number } = {};
        let lastPv: string[] = [];

        while (true) {
            const line = await this.nextLine();
            if (line.startsWith("info")) {
                const p = parseInfoLine(line);
                if (p.depth !== undefined) {
                    lastDepth = p.depth;
                }
                if (p.cp !== undefined || p.mate !== undefined) {
                    lastScore = {};
                    if (p.mate !== undefined) {
                        lastScore.mate = p.mate;
                    } else if (p.cp !== undefined) {
                        lastScore.cp = p.cp;
                    }
                }
                if (p.pv.length > 0) {
                    lastPv = p.pv;
                }
                continue;
            }
            if (line.startsWith("bestmove")) {
                const bm = parseBestMove(line) ?? "";
                const white = normalizeScoreToWhite(fen, lastScore);
                return {
                    fen,
                    depth: lastDepth || depth,
                    cp: white.cp,
                    mate: white.mate,
                    bestMoveUci: bm,
                    pvUci: lastPv,
                };
            }
        }
    }

    terminate(): void {
        if (this.worker) {
            try {
                this.worker.postMessage("quit");
            } catch {
                /* ignore */
            }
            this.worker.terminate();
        }
        this.worker = null;
        this.readyPromise = null;
        this.lineBuf = [];
        this.waiters = [];
    }
}

export const StockfishBrowser = new StockfishBrowserImpl();
