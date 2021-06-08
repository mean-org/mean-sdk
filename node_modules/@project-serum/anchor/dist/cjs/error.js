"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgramError = exports.IdlError = void 0;
class IdlError extends Error {
}
exports.IdlError = IdlError;
// An error from a user defined program.
class ProgramError extends Error {
    constructor(code, msg, ...params) {
        super(...params);
        this.code = code;
        this.msg = msg;
    }
    toString() {
        return this.msg;
    }
}
exports.ProgramError = ProgramError;
//# sourceMappingURL=error.js.map