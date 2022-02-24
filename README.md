# Mean Protocol SDK
Typescript SDKs for the Mean Protocol

You can install the full Mean Protocol SDK, which will install all interoperable smart contracts (programs), or run specific commands for the individual program you want to leverage in your dapp, as shown below.

**To install the SDK that has all the programs run:**

```
npm i @mean-dao/mean-protocol
```
<br/>

**To install the SDK that only contains the Money Streaming client, run:**

```
npm i @mean-dao/money-streaming
```

Here are some code examples of how to use the MoneyStreaming SDK:

- Initiatilze an instance of the MoneyStreaming

```
const mspAccount = new PublicKey("H6wJxgkcc93yeUFnsZHgor3Q3pSWgGpEysfqKrwLtMko");
const moneyStreaming = new MoneyStreaming("https://api.mainnet-beta.solana.com", mspAccount);
const wallet = new PublicKey("DjsyGs6HpszmH9N4UJgr1huBrWgysvUc1gSBk8MPbNfY");
```

- List all streams from the blockchain. The wallet is passed 2 times to retrieve the streams where the wallet acts either as a treasurer OR as a beneficiary. Both parameters are optional. If we don't pass any of both then we will get all streams of the Money Streaming program:

```
const listStreamsObject = {
    treasurer: wallet,
    beneficiary: wallet,
}
let treasurerStreams = await moneyStreaming.listStreams(listStreamsObject);

```

- Refresh all previously retrieved streams with the option of `hardUpdate` which forces the SDK to get the data from the blockchain instead of refresh it in the client:

```
let cachedStreams = await moneyStreaming.refreshStreams(treasurerStreams, wallet, wallet);
```

- Show a resume for all the retrieved streams of the wallet:

```
let resume: any = {
    totalNet: 0,
    incomingAmount: 0,
    outgoingAmount: 0,
    totalAmount: 0
};

for (let stream of cachedStreams) {

    const streamIsOutgoing = 
        stream.treasurerAddress &&
        typeof stream.treasurerAddress !== 'string'
            ? stream.treasurerAddress.equals(wallet)
            : stream.treasurerAddress === wallet.toBase58();

    let streamBalance = 0;

    if (streamIsOutgoing) {
        streamBalance = stream.escrowUnvestedAmount - stream.totalWithdrawals;
        resume['outgoingAmount'] = resume['outgoingAmount'] + 1;  
    } else {
        streamBalance = stream.escrowVestedAmount - stream.totalWithdrawals;
        resume['incomingAmount'] = resume['incomingAmount'] + 1;  
    }

    resume['totalNet'] = resume['totalNet'] + streamBalance;
}

resume['totalAmount'] = cachedStreams.length;
console.log('My money streams resume', resume);
```

- Get data from a specific stream instead of the whole user streams list:

```
const streamAccount = new PublicKey('3ccJxgkeettdFnsZHgor3Q3pSWgGpEysfDmlLoiAAs');
const streamInfo =  await moneyStreaming.getStream(streamAccount);
```

- Refresh the previously retrieved stream data without getting it from the blockchain or use `hardUpdate` parameter that forces to get data from the blockchain instead of refreshing it from the previously retrieved stream data:

```
const cachedStreamData = await moneyStreaming.refreshStream(streamInfo);
```

<br/>

**To install the SDK that only contains the Distributed DCA client, run:**

```
npm i @mean-dao/ddca
```

**To install the SDK that only contains the Hybrid Liquidity Aggregator client, run:**

```
npm i @mean-dao/hybrid-liquidity-ag
```
