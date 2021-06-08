import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';
export declare const DEX_PID: PublicKey;
export declare const SWAP_PID: PublicKey;
export declare const USDC_PUBKEY: PublicKey;
export declare const USDT_PUBKEY: PublicKey;
export declare function getVaultOwnerAndNonce(marketPublicKey: PublicKey, dexProgramId?: PublicKey): Promise<(BN | PublicKey)[]>;
export declare function getAssociatedTokenAddress(associatedProgramId: PublicKey, programId: PublicKey, mint: PublicKey, owner: PublicKey): Promise<PublicKey>;
//# sourceMappingURL=utils.d.ts.map