import { AmmPoolInfo, ChainInfo, ProtocolInfo, TokenInfo } from "./types"
import { 
  CHAINS as Chains, 
  TOKENS as Tokens, 
  PROTOCOLS as Protocols, 
  AMM_POOLS as Amm_Pools

} from "./data.json"

export const CHAINS: ChainInfo[] = [];
export const TOKENS: TokenInfo[] = [];
export const PROTOCOLS: ProtocolInfo[] = [];
export const AMM_POOLS: AmmPoolInfo[] = [];

const initialize = () => {

  // init chains
  for (const chain of Chains) {
    CHAINS.push(Object.assign({}, chain));
  }
  
  // init tokens
  for (const token of Tokens) {
    TOKENS.push(Object.assign({}, token));
  }

  // init protocols
  for (const protocol of Protocols) {
    PROTOCOLS.push(Object.assign({}, protocol));
  }

  // init amm pools
  for (const pool of Amm_Pools) {
    AMM_POOLS.push(Object.assign({}, pool));
  }
};

initialize();
