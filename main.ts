import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
    LAMPORTS_PER_SOL,
    Account,
    sendAndConfirmTransaction,
    Signer,
    SendOptions,
    AccountInfo,

} from '@solana/web3.js';

import {
    getProgramAccount,
    getPayerAccount,
    // StreamLayout,
    STREAM_SIZE,
    publicKey,
    uint64,
    AVAILABLE_PROGRAM_ACTIONS,
    PROGRAM_ACTIONS,
    PROGRAM_ID,
    cstring,
    toBuffer

} from './src/utils';

import * as BufferLayout from 'buffer-layout';
import * as BN from 'bn.js';

const prompt = require('prompt-sync')();
const connection = new Connection('https://devnet.solana.com');

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function create_stream() {

    // console.log('Creating accounts');
    // console.log('');
    // const programAccount = await getProgramAccount();
    // console.log('Program account: ' + programAccount.publicKey.toBase58());
    // const payerAccount = await getPayerAccount();
    // console.log('Payer account: ' + payerAccount.publicKey.toBase58());
    // console.log('');

    // // const treasurerPublicKey = new PublicKey(prompt('Type your secret key: '));
    // const treasurerPrivateKeyArray = prompt('Type your private key: ');
    // const treasurerPrivateKey = Buffer.from(JSON.parse(treasurerPrivateKeyArray))
    // console.log('');
    // const treasurerAccount = Keypair.fromSecretKey(treasurerPrivateKey);
    // const treasurerAccountInfo = (await connection.getAccountInfo(treasurerAccount.publicKey));
    // console.log('My account');
    // console.log('');
    // console.log(`Address: ${treasurerAccount.publicKey.toBase58()}`);
    // console.log(`Balance: ${treasurerAccountInfo.lamports / LAMPORTS_PER_SOL} SOL`);
    // console.log('');

    // const beneficiaryAddressKey = new PublicKey(prompt('Type the beneficiary account address: '));
    // console.log('');
    // const beneficiaryAccount = (await connection.getAccountInfo(beneficiaryAddressKey));
    // console.log('Beneficiary account');
    // console.log('');
    // console.log(`Address: ${beneficiaryAddressKey.toBase58()}`);
    // console.log(`Balance: ${beneficiaryAccount.lamports / LAMPORTS_PER_SOL} SOL`);
    // console.log('');

    // let treasuryAccount: Keypair;
    // let treasuryAddressKey: PublicKey;
    // let createTreasuryInstruction: TransactionInstruction;
    // const treasuryAddress = prompt('Type the account address to use as the escrow of this stream (OPTIONAL): ');
    // console.log('');

    // if (treasuryAddress.length) {
    //     treasuryAddressKey = new PublicKey(treasuryAddress);
    // } else {
    //     console.log('Creating a new treasury account');
    //     console.log('');

    //     await connection.getMinimumBalanceForRentExemption(0)
    //         .then((amount) => {
    //             treasuryAccount = Keypair.generate();
    //             treasuryAddressKey = treasuryAccount.publicKey;
    //             createTreasuryInstruction = SystemProgram.createAccount({
    //                 fromPubkey: treasurerAccount.publicKey,
    //                 newAccountPubkey: treasuryAddressKey,
    //                 lamports: amount,
    //                 space: 0,
    //                 programId: programAccount.publicKey
    //             });
    //         })
    //         .catch((e) => { console.log(e); })
    //         .finally(() => { });
    // }

    // // let streamFriendlyName = prompt('Enter a friendly name for the money stream (OPTIONAL): ');
    // let initialAmount = prompt('Initial deposit amount (OPTIONAL): ');
    // let rateAmount = prompt('Rate amount: ');
    // let rateInterval = prompt('Rate interval in seconds (OPTIONAL, default HOUR = 60 seconds): ');

    // console.log('');
    // console.log('Creating the money stream');

    // let streamAccount = Keypair.generate(); //Keypair;
    // let createStreamAccountInstruction: TransactionInstruction;

    // await connection.getMinimumBalanceForRentExemption(StreamLayout.span)
    //     .then((amount) => {
    //         streamAccount = Keypair.generate();
    //         createStreamAccountInstruction = SystemProgram.createAccount({
    //             fromPubkey: treasurerAccount.publicKey,
    //             newAccountPubkey: streamAccount.publicKey,
    //             lamports: amount,
    //             space: StreamLayout.span,
    //             programId: programAccount.publicKey
    //         });
    //     })
    //     .catch((e) => { console.log(e); })
    //     .finally(() => { });

    // const createStreamLayout = BufferLayout.struct([
    //     BufferLayout.u8('tag'),
    //     // cstring('stream_name'),
    //     BufferLayout.blob(32, 'treasurer_address'),
    //     BufferLayout.blob(32, 'treasury_address'),
    //     BufferLayout.blob(32, 'beneficiary_withdrawal_address'),
    //     BufferLayout.blob(32, 'escrow_token_address'),
    //     BufferLayout.blob(8, 'funding_amount'),
    //     BufferLayout.nu64('rate_amount'),
    //     BufferLayout.nu64('rate_interval_in_seconds'),
    //     BufferLayout.nu64('start_utc'),
    //     BufferLayout.nu64('rate_cliff_in_seconds'),
    //     BufferLayout.nu64('cliff_vest_amount'),
    //     BufferLayout.nu64('cliff_vest_percent')
    // ]);

    // let data = Buffer.alloc(createStreamLayout.span)
    // {
    //     // let fundingAmount = parseFloat(initialAmount) * LAMPORTS_PER_SOL;

    //     console.log(initialAmount);

    //     const decodedData = {
    //         tag: 0,
    //         // stream_name: streamFriendlyName,
    //         treasurer_address: Buffer.from(treasurerAccount.publicKey.toBuffer()),
    //         treasury_address: Buffer.from(treasuryAddressKey.toBuffer()),
    //         beneficiary_withdrawal_address: Buffer.from(beneficiaryAddressKey.toBuffer()),
    //         escrow_token_address: Buffer.from(streamAccount.publicKey.toBuffer()),
    //         funding_amount: Buffer.from(new BN(parseInt(initialAmount)).toBuffer("le", 8)),
    //         rate_amount: parseInt(rateAmount),
    //         rate_interval_in_seconds: rateInterval.length ? parseInt(rateInterval) : 60,
    //         start_utc: Date.now(),
    //         rate_cliff_in_seconds: 0,
    //         cliff_vest_amount: 0,
    //         cliff_vest_percent: 100,
    //     };

    //     console.log(decodedData);
    //     const encodeLength = createStreamLayout.encode(decodedData, data);
    //     data = data.slice(0, encodeLength);
    // };

    // console.log(data);

    // const createStreamInstruction = new TransactionInstruction({
    //     keys: [
    //         { pubkey: treasurerAccount.publicKey, isSigner: true, isWritable: false },
    //         { pubkey: beneficiaryAddressKey, isSigner: false, isWritable: false },
    //         { pubkey: treasuryAddressKey, isSigner: false, isWritable: true },
    //         { pubkey: streamAccount.publicKey, isSigner: false, isWritable: true },
    //     ],
    //     programId: programAccount.publicKey,
    //     data
    // });

    // const createStreamTx = new Transaction();
    // createStreamTx.feePayer = treasurerAccount.publicKey;
    // let signers: Array<Signer> = [treasurerAccount];

    // if (createTreasuryInstruction !== null) {
    //     createStreamTx.add(createTreasuryInstruction);
    //     signers.push(treasuryAccount);
    // }

    // signers.push(streamAccount);
    // createStreamTx.add(createStreamAccountInstruction, createStreamInstruction);
    // let { blockhash } = await connection.getRecentBlockhash();
    // createStreamTx.recentBlockhash = blockhash
    // createStreamTx.sign(...signers);

    // console.log('');

    // const result = await connection.sendTransaction(
    //     createStreamTx,
    //     signers,
    //     {
    //         skipPreflight: false, preflightCommitment: 'singleGossip'
    //     });

    // if (!result.length) {
    //     console.log('Transaction failed :(');
    // } else {

    //     console.log(`Transaction ID: ${result}`);
    //     console.log('');

    //     let info = await connection.getAccountInfo(treasuryAccount.publicKey);
    //     console.log('');
    //     console.log('Treasury account');
    //     console.log('');
    //     console.log(`Address: ${treasuryAccount.publicKey.toBase58()}`);
    //     console.log(`Balance: ${(info !== null ? (info.lamports / LAMPORTS_PER_SOL) : 0)} SOL`);
    //     console.log('');

    //     info = await connection.getAccountInfo(streamAccount.publicKey);
    //     console.log('');
    //     console.log('Stream account');
    //     console.log('');
    //     console.log(`Address: ${streamAccount.publicKey.toBase58()}`);
    //     console.log(`Balance: ${(info !== null ? (info.lamports / LAMPORTS_PER_SOL) : 0)} SOL`);
    //     console.log('');
    // }
};

async function close_stream() {

}

async function main() {

    console.log('Initializing Streaming Program ...');
    console.log('Available program actions:');
    console.log('');

    AVAILABLE_PROGRAM_ACTIONS.forEach(function (action, index) {
        console.log(`ID: ${action.id} -> ${action.name}`);
    });

    console.log('');
    const id = parseInt(prompt('Select an action to ID execute : '));
    console.log('');

    switch (id) {
        case PROGRAM_ACTIONS.createStream: {
            await create_stream();
            break;
        }
        case PROGRAM_ACTIONS.createStream: {
            await close_stream();
            break;
        }
        default: {
            console.log('Closing program ...')
            sleep(1000);
            break;
        }
    }
}

main().then(
    () => process.exit(),
    (err: any) => {
        console.error(err);
        process.exit(-1);
    },
);