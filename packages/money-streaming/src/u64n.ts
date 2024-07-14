import { Buffer } from 'buffer';
import { BN } from 'bn.js';

/**
 * u64Number
 */
export class u64Number extends BN {
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
}
