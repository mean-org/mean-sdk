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
        // const layout = BufferLayout.blob(16, property);

        // layout.decode = (buffer: Buffer) => {
        //     let str = "";
        //     for (var i = 0; i < buffer.length; i++) {
        //         str += String.fromCharCode(buffer[i]);
        //     }

        //     return str;
        // };

        // layout.encode = (str: String) => {
        //     var buf = new ArrayBuffer(str.length * 2);
        //     var bufView = new Uint16Array(buf);
        //     for (var i = 0, strLen = str.length; i < strLen; i++) {
        //         bufView[i] = str.charCodeAt(i);
        //     }
        //     return buf;
        // };

        // return layout;
        return BufferLayout.blob(32, property);

        // const rsl = BufferLayout.struct(
        //     [
        //         BufferLayout.u32('length'),
        //         BufferLayout.u32('lengthPadding'),
        //         BufferLayout.blob(BufferLayout.offset(BufferLayout.u32(), -8), 'chars'),
        //     ],
        //     property,
        // );
        // const _decode = rsl.decode.bind(rsl);
        // const _encode = rsl.encode.bind(rsl);

        // rsl.decode = (buffer: Buffer, offset: number) => {
        //     const data = _decode(buffer, offset);
        //     return data.chars.toString('utf8');
        // };

        // rsl.encode = (str: string, buffer: Buffer, offset: number) => {
        //     const data = {
        //         chars: Buffer.from(str, 'utf8'),
        //     };
        //     return _encode(data, buffer, offset);
        // };

        // return rsl;
    };

    /**
     * Stream layout
     */
    export const streamLayout: typeof BufferLayout.Structure = BufferLayout.struct([
        BufferLayout.u8('initialized'),
        string('stream_name'),
        publicKey('treasurer_address'),
        uint64('rate_amount'),
        uint64('rate_interval_in_seconds'),
        uint64('start_utc'),
        uint64('rate_cliff_in_seconds'),
        uint64('cliff_vest_amount'),
        uint64('cliff_vest_percent'),
        publicKey('beneficiary_withdrawal_address'),
        publicKey('escrow_token_address'),
        // uint64('escrow_vested_amount'),
        // uint64('escrow_unvested_amount'),
        publicKey('treasury_address'),
        uint64('escrow_estimated_depletion_utc'),
        uint64('total_deposits'),
        uint64('total_withdrawals')
    ]);

    // pub initialized: bool,
    // pub stream_name: String,
    // pub treasurer_address: Pubkey,
    // pub rate_amount: u64,
    // pub rate_interval_in_seconds: u64,
    // pub start_utc: u64,
    // pub rate_cliff_in_seconds: u64,
    // pub cliff_vest_amount: u64,
    // pub cliff_vest_percent: u64,
    // pub beneficiary_withdrawal_address: Pubkey,
    // pub escrow_token_address: Pubkey,
    // pub treasury_address: Pubkey,
    // pub treasury_estimated_depletion_utc: u64,
    // pub total_deposits: u64,
    // pub total_withdrawals: u64

    /**
     * Create stream instruction layout
     */
    export const createStreamLayout: typeof BufferLayout.Structure = BufferLayout.struct([
        BufferLayout.u8('tag'),
        string('stream_name'),
        publicKey('treasurer_address'),
        publicKey('beneficiary_withdrawal_address'),
        publicKey('escrow_token_address'),
        publicKey('treasury_address'),
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

}

