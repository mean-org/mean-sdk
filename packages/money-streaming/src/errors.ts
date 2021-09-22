
/**
 * Errors constants
 */
export class Errors {
    static InvalidParameters: string = 'InvalidParameters';
    static Unauthorized: string = 'Unauthorized';
    static AccountNotCredited: string = 'AccountNotCredited';
    static AccountNotFound: string = 'AccountNotFound';
    static TokensDoNotMatch: string = 'TokensDoNotMatch';
    static InvalidInitializer: string = 'InvalidInitializer';
    static InvalidStreamTerms: string = 'InvalidStreamTerms';
}

interface MSPError extends Error { }

interface MSPErrorConstructor {
    new(name: string, message?: string): MSPError;
    (name: string, message?: string): MSPError;
    readonly prototype: MSPError;
}

export declare var MSPError: MSPErrorConstructor;

export { }