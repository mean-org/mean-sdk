import { Buffer } from 'buffer';
import BN from 'bn.js';
// const Buffer = require('buffer');

/**
 * 64-bit class
 */
export class u64Number extends BN {

    // constructor(
    //     number: number | string | number[] | Uint8Array | Buffer | BN,
    //     base?: number | 'hex',
    //     endian?: BN.Endianness
    // ) {
    //     super(number, base, endian);
    // }

    /**
     * Convert to Buffer
     */
    toBuffer(): Buffer {

        const reverse = super.toArray().reverse();
        const buffer = Buffer.from(reverse);

        if (buffer.length === 8) {
            return buffer;
        }

        const zeroPad = Buffer.alloc(8);
        buffer.copy(zeroPad);

        return zeroPad;
    }

    /**
     * Construct a u64 from Buffer
     */
    static fromBuffer(buffer: Buffer): u64Number {
        return new u64Number(
            [...buffer]
                .reverse()
                .map(i => `00${i.toString(16)}`.slice(-2))
                .join(''),
            16,
        );
    }
}