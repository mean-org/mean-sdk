export module Layout {

    const BufferLayout = require('buffer-layout');

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
        return BufferLayout.blob(32, property);
    };

    /**
     * Stream layout
     */
    export const streamLayout: typeof BufferLayout.Structure = BufferLayout.struct([
        BufferLayout.u8('initialized'),
        string('stream_name'),
        publicKey('treasurer_address'),
        BufferLayout.f64('rate_amount'),
        uint64('rate_interval_in_seconds'),
        BufferLayout.nu64('start_utc'),
        uint64('rate_cliff_in_seconds'),
        BufferLayout.f64('cliff_vest_amount'),
        BufferLayout.f64('cliff_vest_percent'),
        publicKey('beneficiary_address'),
        publicKey('stream_associated_token'),
        publicKey('treasury_address'),
        BufferLayout.nu64('escrow_estimated_depletion_utc'),
        BufferLayout.f64('total_deposits'),
        BufferLayout.f64('total_withdrawals'),
        BufferLayout.f64('escrow_vested_amount_snap'),
        uint64('escrow_vested_amount_snap_block_height'),
        uint64('auto_off_clock_in_seconds'),
        BufferLayout.u8('is_streaming')
    ]);

    /**
     * Create stream instruction layout
     */
    export const createStreamLayout: typeof BufferLayout.Structure = BufferLayout.struct([
        BufferLayout.u8('tag'),
        publicKey('beneficiary_address'),
        string('stream_name'),
        BufferLayout.f64('funding_amount'),
        BufferLayout.f64('rate_amount'),
        uint64('rate_interval_in_seconds'),
        BufferLayout.nu64('start_utc'),
        uint64('rate_cliff_in_seconds'),
        BufferLayout.f64('cliff_vest_amount'),
        BufferLayout.f64('cliff_vest_percent'),
        uint64('auto_off_clock_in_seconds')
    ]);

    /**
     * Add funds instruction layout
     */
    export const addFundsLayout: typeof BufferLayout.Structure = BufferLayout.struct([
        BufferLayout.u8('tag'),
        BufferLayout.f64('contribution_amount'),
        BufferLayout.u8('resume')
    ]);

    /**
     * Withdraw instruction layout
     */
    export const withdrawLayout: typeof BufferLayout.Structure = BufferLayout.struct([
        BufferLayout.u8('tag'),
        BufferLayout.f64('withdrawal_amount')
    ]);

    /**
     * Set stream clock instruction layout
     */
    export const assertClockLayout: typeof BufferLayout.Structure = BufferLayout.struct([
        BufferLayout.u8('tag')
    ]);

    export const approveDelegationLayout: typeof BufferLayout.Structure = BufferLayout.struct([
        BufferLayout.u8('instruction'),
        BufferLayout.f64('amount')
    ]);
}

