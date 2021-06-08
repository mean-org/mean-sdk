export declare class IdlError extends Error {
}
export declare class ProgramError extends Error {
    readonly code: number;
    readonly msg: string;
    constructor(code: number, msg: string, ...params: any[]);
    toString(): string;
}
//# sourceMappingURL=error.d.ts.map