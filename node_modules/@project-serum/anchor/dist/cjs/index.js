"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = exports.utils = exports.web3 = exports.BN = exports.Provider = exports.getProvider = exports.setProvider = exports.Coder = exports.Program = exports.workspace = void 0;
const bn_js_1 = __importDefault(require("bn.js"));
exports.BN = bn_js_1.default;
const web3 = __importStar(require("@solana/web3.js"));
exports.web3 = web3;
const provider_1 = __importStar(require("./provider"));
exports.Provider = provider_1.default;
Object.defineProperty(exports, "Wallet", { enumerable: true, get: function () { return provider_1.NodeWallet; } });
const coder_1 = __importDefault(require("./coder"));
exports.Coder = coder_1.default;
const workspace_1 = __importDefault(require("./workspace"));
exports.workspace = workspace_1.default;
const utils_1 = __importDefault(require("./utils"));
exports.utils = utils_1.default;
const program_1 = require("./program");
Object.defineProperty(exports, "Program", { enumerable: true, get: function () { return program_1.Program; } });
let _provider = null;
function setProvider(provider) {
    _provider = provider;
}
exports.setProvider = setProvider;
function getProvider() {
    if (_provider === null) {
        return provider_1.default.local();
    }
    return _provider;
}
exports.getProvider = getProvider;
//# sourceMappingURL=index.js.map