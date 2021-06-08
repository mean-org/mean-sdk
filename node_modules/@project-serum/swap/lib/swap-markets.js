"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const serum_1 = require("@project-serum/serum");
const web3_js_1 = require("@solana/web3.js");
const utils_1 = require("./utils");
// Utility class to parse the token list for markets.
class SwapMarkets {
    constructor(provider, tokenList) {
        this.provider = provider;
        this.tokenList = tokenList;
    }
    tokens() {
        return this.tokenList
            .getList()
            .filter((t) => {
            var _a, _b;
            const isUsdxQuoted = ((_a = t.extensions) === null || _a === void 0 ? void 0 : _a.serumV3Usdt) || ((_b = t.extensions) === null || _b === void 0 ? void 0 : _b.serumV3Usdc);
            return isUsdxQuoted;
        })
            .map((t) => new web3_js_1.PublicKey(t.address));
    }
    pairs(mint) {
        var _a, _b;
        const tokenList = this.tokenList.getList();
        const mintInfo = this.tokenList
            .getList()
            .filter((t) => t.address === mint.toString())[0];
        if (mintInfo === undefined) {
            return [];
        }
        const pairs = new Set();
        // Add all tokens that also have USDC quoted markets.
        if ((_a = mintInfo.extensions) === null || _a === void 0 ? void 0 : _a.serumV3Usdc) {
            pairs.add(utils_1.USDC_PUBKEY.toString());
            let iter = tokenList
                .filter((t) => { var _a; return t.address !== mintInfo.address && ((_a = t.extensions) === null || _a === void 0 ? void 0 : _a.serumV3Usdc); })
                .map((t) => t.address);
            iter.forEach(pairs.add, pairs);
        }
        // Add all tokens that also have USDT quoted markets.
        if ((_b = mintInfo.extensions) === null || _b === void 0 ? void 0 : _b.serumV3Usdt) {
            pairs.add(utils_1.USDT_PUBKEY.toString());
            tokenList
                .filter((t) => { var _a; return t.address !== mintInfo.address && ((_a = t.extensions) === null || _a === void 0 ? void 0 : _a.serumV3Usdt); })
                .map((t) => t.address)
                .forEach(pairs.add, pairs);
        }
        return [...pairs].map((t) => new web3_js_1.PublicKey(t));
    }
    // Returns the `usdxMint` quoted market address *if* no open orders account
    // already exists.
    async getMarketAddressIfNeeded(usdxMint, baseMint) {
        const marketAddress = this.getMarketAddress(usdxMint, baseMint);
        if (marketAddress === null) {
            throw new Error('Market not found');
        }
        let accounts = await serum_1.OpenOrders.findForMarketAndOwner(this.provider.connection, marketAddress, this.provider.wallet.publicKey, utils_1.DEX_PID);
        if (accounts[0] !== undefined) {
            throw new Error('Open orders account already exists');
        }
        return marketAddress;
    }
    // Returns the `usdxMint` quoted market address.
    getMarketAddress(usdxMint, baseMint) {
        const market = this.tokenList
            .getList()
            .filter((t) => {
            var _a, _b;
            if (t.address !== (baseMint === null || baseMint === void 0 ? void 0 : baseMint.toString())) {
                return false;
            }
            if (usdxMint.equals(utils_1.USDC_PUBKEY)) {
                return ((_a = t.extensions) === null || _a === void 0 ? void 0 : _a.serumV3Usdc) !== undefined;
            }
            else if (usdxMint.equals(utils_1.USDT_PUBKEY)) {
                return ((_b = t.extensions) === null || _b === void 0 ? void 0 : _b.serumV3Usdt) !== undefined;
            }
            else {
                return false;
            }
        })
            .map((t) => {
            if (usdxMint.equals(utils_1.USDC_PUBKEY)) {
                return new web3_js_1.PublicKey(t.extensions.serumV3Usdc);
            }
            else {
                return new web3_js_1.PublicKey(t.extensions.serumV3Usdt);
            }
        })[0];
        if (market === undefined) {
            return null;
        }
        return market;
    }
    // Returns true if there's a trade across two USDC quoted markets
    // `fromMint` `toMint`.
    usdcPathExists(fromMint, toMint) {
        const fromMarket = this.tokenList
            .getList()
            .filter((t) => t.address === fromMint.toString())
            .filter((t) => { var _a; return ((_a = t.extensions) === null || _a === void 0 ? void 0 : _a.serumV3Usdc) !== undefined; })[0];
        const toMarket = this.tokenList
            .getList()
            .filter((t) => t.address === toMint.toString())
            .filter((t) => { var _a; return ((_a = t.extensions) === null || _a === void 0 ? void 0 : _a.serumV3Usdc) !== undefined; })[0];
        return fromMarket !== undefined && toMarket !== undefined;
    }
    route(fromMint, toMint) {
        if (fromMint.equals(utils_1.USDC_PUBKEY) || fromMint.equals(utils_1.USDT_PUBKEY)) {
            const market = this.getMarketAddress(fromMint, toMint);
            if (market === null) {
                return null;
            }
            return [market];
        }
        else if (toMint.equals(utils_1.USDC_PUBKEY) || toMint.equals(utils_1.USDT_PUBKEY)) {
            const market = this.getMarketAddress(toMint, fromMint);
            if (market === null) {
                return null;
            }
            return [market];
        }
        else {
            let fromMarket = this.getMarketAddress(utils_1.USDC_PUBKEY, fromMint);
            let toMarket = this.getMarketAddress(utils_1.USDC_PUBKEY, toMint);
            if (fromMarket === null || toMarket === null) {
                fromMarket = this.getMarketAddress(utils_1.USDT_PUBKEY, fromMint);
                toMarket = this.getMarketAddress(utils_1.USDT_PUBKEY, toMint);
                if (fromMarket === null || toMarket === null) {
                    return null;
                }
            }
            return [fromMarket, toMarket];
        }
    }
}
exports.default = SwapMarkets;
//# sourceMappingURL=swap-markets.js.map