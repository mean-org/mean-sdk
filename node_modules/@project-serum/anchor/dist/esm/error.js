export class IdlError extends Error {
}
// An error from a user defined program.
export class ProgramError extends Error {
    constructor(code, msg, ...params) {
        super(...params);
        this.code = code;
        this.msg = msg;
    }
    toString() {
        return this.msg;
    }
}
//# sourceMappingURL=error.js.map