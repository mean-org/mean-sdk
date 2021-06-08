import { translateError } from "../common";
import { splitArgsAndCtx } from "../context";
export default class RpcFactory {
    // Builds the rpc namespace.
    static build(idlIx, txFn, idlErrors, provider) {
        const rpc = async (...args) => {
            const tx = txFn(...args);
            const [, ctx] = splitArgsAndCtx(idlIx, [...args]);
            try {
                const txSig = await provider.send(tx, ctx.signers, ctx.options);
                return txSig;
            }
            catch (err) {
                console.log("Translating error", err);
                let translatedErr = translateError(idlErrors, err);
                if (translatedErr === null) {
                    throw err;
                }
                throw translatedErr;
            }
        };
        return rpc;
    }
}
//# sourceMappingURL=rpc.js.map