import { Idl } from '@project-serum/anchor';

const IDL: Idl = {
  version: "0.8.0",
  name: "msp",
  instructions: [
    {
      "name": "createTreasury",
      "accounts": [
        {
          "name": "treasurer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "treasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "msp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "slot",
          "type": "u64"
        },
        {
          "name": "treasuryBump",
          "type": "u8"
        },
        {
          "name": "treasuryMintBump",
          "type": "u8"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "treasuryType",
          "type": "u8"
        },
        {
          "name": "autoClose",
          "type": "bool"
        }
      ]
    },
    {
      "name": "createStream",
      "accounts": [
        {
          "name": "initializer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "treasurer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "treasury",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "beneficiary",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stream",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "feeTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "msp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "startUtc",
          "type": "u64"
        },
        {
          "name": "rateAmountUnits",
          "type": "u64"
        },
        {
          "name": "rateIntervalInSeconds",
          "type": "u64"
        },
        {
          "name": "allocationAssignedUnits",
          "type": "u64"
        },
        {
          "name": "allocationReservedUnits",
          "type": "u64"
        },
        {
          "name": "cliffVestAmountUnits",
          "type": "u64"
        },
        {
          "name": "cliffVestPercent",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addFunds",
      "accounts": [
        {
          "name": "contributor",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "contributorToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "contributorTreasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "treasuryMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stream",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "feeTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "msp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "allocationType",
          "type": "u8"
        },
        {
          "name": "allocationStream",
          "type": {
            "option": "publicKey"
          }
        }
      ]
    },
    {
      "name": "withdraw",
      "accounts": [
        {
          "name": "beneficiary",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "beneficiaryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "treasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stream",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTreasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "msp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pauseStream",
      "accounts": [
        {
          "name": "initializer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "treasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stream",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "msp",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "resumeStream",
      "accounts": [
        {
          "name": "initializer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "treasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stream",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "msp",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "closeStream",
      "accounts": [
        {
          "name": "initializer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "treasurer",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "treasurerToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasurerTreasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "beneficiary",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "beneficiaryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "treasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stream",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTreasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "msp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "autoCloseTreasury",
          "type": "bool"
        }
      ]
    },
    {
      "name": "closeTreasury",
      "accounts": [
        {
          "name": "treasurer",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "treasurerToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasurerTreasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "treasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTreasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "msp",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "refreshTreasuryBalance",
      "accounts": [
        {
          "name": "treasurer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "associatedToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "treasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "treasuryToken",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "transferStream",
      "accounts": [
        {
          "name": "beneficiary",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "stream",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "newBeneficiary",
          "type": "publicKey"
        }
      ]
    }
  ],
  accounts: [
    {
      "name": "Stream",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "initialized",
            "type": "bool"
          },
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "treasurerAddress",
            "type": "publicKey"
          },
          {
            "name": "rateAmountUnits",
            "type": "u64"
          },
          {
            "name": "rateIntervalInSeconds",
            "type": "u64"
          },
          {
            "name": "startUtc",
            "type": "u64"
          },
          {
            "name": "cliffVestAmountUnits",
            "type": "u64"
          },
          {
            "name": "cliffVestPercent",
            "type": "u64"
          },
          {
            "name": "beneficiaryAddress",
            "type": "publicKey"
          },
          {
            "name": "beneficiaryAssociatedToken",
            "type": "publicKey"
          },
          {
            "name": "treasuryAddress",
            "type": "publicKey"
          },
          {
            "name": "allocationAssignedUnits",
            "type": "u64"
          },
          {
            "name": "allocationReservedUnits",
            "type": "u64"
          },
          {
            "name": "totalWithdrawalsUnits",
            "type": "u64"
          },
          {
            "name": "lastWithdrawalUnits",
            "type": "u64"
          },
          {
            "name": "lastWithdrawalSlot",
            "type": "u64"
          },
          {
            "name": "lastWithdrawalBlockTime",
            "type": "u64"
          },
          {
            "name": "lastManualStopWithdrawableUnitsSnap",
            "type": "u64"
          },
          {
            "name": "lastManualStopSlot",
            "type": "u64"
          },
          {
            "name": "lastManualStopBlockTime",
            "type": "u64"
          },
          {
            "name": "lastManualResumeAllocationChangeUnits",
            "type": "u64"
          },
          {
            "name": "lastManualResumeSlot",
            "type": "u64"
          },
          {
            "name": "lastManualResumeBlockTime",
            "type": "u64"
          },
          {
            "name": "lastKnownTotalSecondsInPausedStatus",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Treasury",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "initialized",
            "type": "bool"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "treasurerAddress",
            "type": "publicKey"
          },
          {
            "name": "associatedTokenAddress",
            "type": "publicKey"
          },
          {
            "name": "mintAddress",
            "type": "publicKey"
          },
          {
            "name": "labels",
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "lastKnownBalanceUnits",
            "type": "u64"
          },
          {
            "name": "lastKnownBalanceSlot",
            "type": "u64"
          },
          {
            "name": "lastKnownBalanceBlockTime",
            "type": "u64"
          },
          {
            "name": "allocationReservedUnits",
            "type": "u64"
          },
          {
            "name": "allocationAssignedUnits",
            "type": "u64"
          },
          {
            "name": "totalWithdrawalsUnits",
            "type": "u64"
          },
          {
            "name": "totalStreams",
            "type": "u64"
          },
          {
            "name": "createdOnUtc",
            "type": "u64"
          },
          {
            "name": "treasuryType",
            "type": "u8"
          },
          {
            "name": "autoClose",
            "type": "bool"
          }
        ]
      }
    }
  ],
  types: [
    {
      "name": "StreamStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Scheduled"
          },
          {
            "name": "Running"
          },
          {
            "name": "Paused"
          }
        ]
      }
    },
    {
      "name": "TreasuryType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Open"
          },
          {
            "name": "Locked"
          }
        ]
      }
    }
  ],
  errors: [
    {
      "code": 6000,
      "name": "InvalidProgramId",
      "msg": "Invalid Money Streaming Program ID"
    },
    {
      "code": 6001,
      "name": "InvalidOwner",
      "msg": "Invalid account owner"
    },
    {
      "code": 6002,
      "name": "NotAuthorized",
      "msg": "Not Authorized"
    },
    {
      "code": 6003,
      "name": "Overflow",
      "msg": "Overflow"
    },
    {
      "code": 6004,
      "name": "InvalidAssociatedToken",
      "msg": "Invalid associated token address"
    },
    {
      "code": 6005,
      "name": "InvalidFeeTreasuryAccount",
      "msg": "Invalid fee treasury account"
    },
    {
      "code": 6006,
      "name": "InvalidTreasuryMintDecimals",
      "msg": "Invalid treasury mint decimals"
    },
    {
      "code": 6007,
      "name": "TreasuryAlreadyInitialized",
      "msg": "Treasury is already initialized"
    },
    {
      "code": 6008,
      "name": "TreasuryNotInitialized",
      "msg": "Treasury is not initialized"
    },
    {
      "code": 6009,
      "name": "InvalidTreasuryVersion",
      "msg": "Invalid treasury version"
    },
    {
      "code": 6010,
      "name": "InvalidTreasuryMint",
      "msg": "Invalid treasury mint address"
    },
    {
      "code": 6011,
      "name": "InvalidTreasury",
      "msg": "Invalid treasury account"
    },
    {
      "code": 6012,
      "name": "InvalidTreasurySize",
      "msg": "Invalid treasury size"
    },
    {
      "code": 6013,
      "name": "InvalidTreasurer",
      "msg": "Invalid treasurer"
    },
    {
      "code": 6014,
      "name": "InvalidBeneficiary",
      "msg": "Invalid beneficiary"
    },
    {
      "code": 6015,
      "name": "InvalidArgument",
      "msg": "Invalid argument"
    },
    {
      "code": 6016,
      "name": "StreamNotInitialized",
      "msg": "Stream not initialized"
    },
    {
      "code": 6017,
      "name": "StreamAlreadyInitialized",
      "msg": "Stream is already initialized"
    },
    {
      "code": 6018,
      "name": "InvalidStreamVersion",
      "msg": "Invalid stream version"
    },
    {
      "code": 6019,
      "name": "InvalidStreamSize",
      "msg": "Invalid stream size"
    },
    {
      "code": 6020,
      "name": "InvalidStream",
      "msg": "Invalid stream account"
    },
    {
      "code": 6021,
      "name": "InvalidRequestedStreamAllocation",
      "msg": "Invalid requested stream allocation"
    },
    {
      "code": 6022,
      "name": "InvalidWithdrawalAmount",
      "msg": "Invalid withdrawal amount"
    },
    {
      "code": 6023,
      "name": "StringTooLong",
      "msg": "The string length is larger than 32 bytes"
    }
  ]
}

export default IDL;