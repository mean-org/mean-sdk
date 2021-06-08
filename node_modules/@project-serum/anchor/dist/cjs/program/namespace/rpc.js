"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const context_1 = require("../context");
class RpcFactory {
    // Builds the rpc namespace.
    static build(idlIx, txFn, idlErrors, provider) {
        const rpc = async (...args) => {
            const tx = txFn(...args);
            const [, ctx] = context_1.splitArgsAndCtx(idlIx, [...args]);
            try {
                const txSig = await provider.send(tx, ctx.signers, ctx.options);
                return txSig;
            }
            catch (err) {
                console.log("Translating error", err);
                let translatedErr = common_1.translateError(idlErrors, err);
                if (translatedErr === null) {
                    throw err;
                }
                throw translatedErr;
            }
        };
        return rpc;
    }
}
exports.default = RpcFactory;
//# sourceMappingURL=rpc.js.map