import { Buffer } from 'buffer';
import * as BN from 'bn.js';
import * as BufferLayout from 'buffer-layout';

/**
 * Public key layout
 */
export const publicKey = (property: string = 'publicKey'): Object => {
    return BufferLayout.blob(32, property);
};

/**
 * 64bit unsigned value layout
 */
export const uint64 = (property: string = 'uint64'): Object => {
    return BufferLayout.blob(8, property);
};

/**
 * String layout
 */
export const string = (property: string = 'string'): Object => {
    const layout = BufferLayout.blob(16, property);

    layout.decode = (buffer: Buffer) => {
        return String.fromCharCode.apply(null, new Uint16Array(buffer));
    };

    layout.encode = (str: String) => {
        var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
        var bufView = new Uint16Array(buf);
        for (var i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    };

    return layout;
};

export const StreamLayout: typeof BufferLayout.Structure = BufferLayout.struct([
    BufferLayout.u8('tag'),
    BufferLayout.u8('initialized'),
    string('stream_name'),
    publicKey('treasurer_address'),
    uint64('funding_amount'),
    uint64('rate_amount'),
    uint64('rate_interval_in_seconds'),
    uint64('start_utc'),
    uint64('rate_cliff_in_seconds'),
    uint64('cliff_vest_amount'),
    uint64('cliff_vest_percent'),
    publicKey('beneficiary_withdrawal_address'),
    publicKey('escrow_token_address'),
    uint64('escrow_vested_amount'),
    uint64('escrow_unvested_amount'),
    publicKey('treasury_address'),
    uint64('escrow_estimated_depletion_utc'),
    uint64('total_deposits'),
    uint64('total_withdrawals')
]);

/**
 * Create stream instruction layout
 */
export const createStreamLayout: typeof BufferLayout.Structure = BufferLayout.struct([
    BufferLayout.u8('tag'),
    string('stream_name'),
    publicKey('treasurer_address'),
    publicKey('treasury_address'),
    publicKey('beneficiary_withdrawal_address'),
    publicKey('escrow_token_address'),
    uint64('funding_amount'),
    uint64('rate_amount'),
    uint64('rate_interval_in_seconds'),
    uint64('start_utc'),
    uint64('rate_cliff_in_seconds'),
    uint64('cliff_vest_amount'),
    uint64('cliff_vest_percent')
]);

/**
 * Add funds instruction layout
 */
export const addFundsLayout: typeof BufferLayout.Structure = BufferLayout.struct([
    BufferLayout.u8('tag'),
    publicKey('contribution_token_address'),
    uint64('contribution_amount')
]);

