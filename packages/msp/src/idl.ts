import { Idl } from '@project-serum/anchor';

const IDL: Idl = {
  version: "2.1.0",
  name: "msp",
  instructions: [
    {
      "name": "createTreasury",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "treasurer",
          "isMut": true,
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
        },
        {
          "name": "solFeePayedByTreasury",
          "type": "bool"
        }
      ]
    },
    {
      "name": "createStream",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
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
          "name": "feeTreasuryToken",
          "isMut": true,
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
          "name": "cliffVestAmountUnits",
          "type": "u64"
        },
        {
          "name": "cliffVestPercent",
          "type": "u64"
        },
        {
          "name": "feePayedByTreasurer",
          "type": "bool"
        }
      ]
    },
    {
      "name": "withdraw",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "beneficiary",
          "isMut": true,
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
        }
      ],
      "args": []
    },
    {
      "name": "refreshTreasuryData",
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
      "args": [
        {
          "name": "totalStreams",
          "type": "u64"
        }
      ]
    },
    {
      "name": "transferStream",
      "accounts": [
        {
          "name": "beneficiary",
          "isMut": true,
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
    },
    {
      "name": "getStream",
      "accounts": [
        {
          "name": "stream",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "addFunds",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "contributor",
          "isMut": true,
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
      "name": "allocate",
      "accounts": [
        {
          "name": "payer",
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
      "name": "closeStream",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "treasurer",
          "isMut": true,
          "isSigner": true
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
      "args": []
    },
    {
      "name": "closeTreasury",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "treasurer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "treasurerTreasuryToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "destinationAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "destinationTokenAccount",
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
      "args": []
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
            "name": "lastManualResumeRemainingAllocationUnitsSnap",
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
          },
          {
            "name": "lastAutoStopBlockTime",
            "type": "u64"
          },
          {
            "name": "feePayedByTreasurer",
            "type": "bool"
          },
          {
            "name": "startUtcInSeconds",
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
          },
          {
            "name": "solFeePayedByTreasury",
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
            "name": "Opened"
          },
          {
            "name": "Locked"
          }
        ]
      }
    }
  ],
  events: [
    {
      "name": "StreamEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "initialized",
          "type": "bool",
          "index": false
        },
        {
          "name": "name",
          "type": {
            "array": [
              "u8",
              32
            ]
          },
          "index": false
        },
        {
          "name": "treasurerAddress",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "rateAmountUnits",
          "type": "u64",
          "index": false
        },
        {
          "name": "rateIntervalInSeconds",
          "type": "u64",
          "index": false
        },
        {
          "name": "startUtc",
          "type": "u64",
          "index": false
        },
        {
          "name": "cliffVestAmountUnits",
          "type": "u64",
          "index": false
        },
        {
          "name": "cliffVestPercent",
          "type": "u64",
          "index": false
        },
        {
          "name": "beneficiaryAddress",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "beneficiaryAssociatedToken",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "treasuryAddress",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "allocationAssignedUnits",
          "type": "u64",
          "index": false
        },
        {
          "name": "allocationReservedUnits",
          "type": "u64",
          "index": false
        },
        {
          "name": "totalWithdrawalsUnits",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastWithdrawalUnits",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastWithdrawalSlot",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastWithdrawalBlockTime",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastManualStopWithdrawableUnitsSnap",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastManualStopSlot",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastManualStopBlockTime",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastManualResumeRemainingAllocationUnitsSnap",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastManualResumeSlot",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastManualResumeBlockTime",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastKnownTotalSecondsInPausedStatus",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastAutoStopBlockTime",
          "type": "u64",
          "index": false
        },
        {
          "name": "feePayedByTreasurer",
          "type": "bool",
          "index": false
        },
        {
          "name": "status",
          "type": "string",
          "index": false
        },
        {
          "name": "isManualPause",
          "type": "bool",
          "index": false
        },
        {
          "name": "cliffUnits",
          "type": "u64",
          "index": false
        },
        {
          "name": "currentBlockTime",
          "type": "u64",
          "index": false
        },
        {
          "name": "secondsSinceStart",
          "type": "u64",
          "index": false
        },
        {
          "name": "estDepletionTime",
          "type": "u64",
          "index": false
        },
        {
          "name": "fundsLeftInStream",
          "type": "u64",
          "index": false
        },
        {
          "name": "fundsSentToBeneficiary",
          "type": "u64",
          "index": false
        },
        {
          "name": "withdrawableUnitsWhilePaused",
          "type": "u64",
          "index": false
        },
        {
          "name": "nonStopEarningUnits",
          "type": "u64",
          "index": false
        },
        {
          "name": "missedUnitsWhilePaused",
          "type": "u64",
          "index": false
        },
        {
          "name": "entitledEarningsUnits",
          "type": "u64",
          "index": false
        },
        {
          "name": "withdrawableUnitsWhileRunning",
          "type": "u64",
          "index": false
        },
        {
          "name": "beneficiaryRemainingAllocation",
          "type": "u64",
          "index": false
        },
        {
          "name": "beneficiaryWithdrawableAmount",
          "type": "u64",
          "index": false
        },
        {
          "name": "lastKnownStopBlockTime",
          "type": "u64",
          "index": false
        }
      ]
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
    },
    {
      "code": 6024,
      "name": "StreamAlreadyRunning",
      "msg": "The stream is already running"
    },
    {
      "code": 6025,
      "name": "StreamAlreadyPaused",
      "msg": "The stream is already paused"
    },
    {
      "code": 6026,
      "name": "StreamZeroRemainingAllocation",
      "msg": "Stream allocation assigned is zero"
    },
    {
      "code": 6027,
      "name": "ZeroContributionAmount",
      "msg": "Contribution amount is zero"
    },
    {
      "code": 6028,
      "name": "ZeroWithdrawalAmount",
      "msg": "Withdrawal amount is zero"
    },
    {
      "code": 6029,
      "name": "StreamIsScheduled",
      "msg": "Stream has not started"
    },
    {
      "code": 6030,
      "name": "CloseLockedStreamNotAllowedWhileRunning",
      "msg": "Streams in a Lock treasury can not be closed while running"
    },
    {
      "code": 6031,
      "name": "PauseOrResumeLockedStreamNotAllowed",
      "msg": "Streams in a Locked treasury can not be paused or resumed"
    },
    {
      "code": 6032,
      "name": "ReservedAllocationExceedWithdrawableAmount",
      "msg": "Can not pause a stream if the reserved allocation is greater than the withdrawable amount"
    },
    {
      "code": 6033,
      "name": "AddFundsNotAllowedOnLockedStreams",
      "msg": "Can not add funds to a stream from a locked treasury"
    },
    {
      "code": 6034,
      "name": "InvalidStreamRate",
      "msg": "Invalid stream rate"
    },
    {
      "code": 6035,
      "name": "InvalidCliff",
      "msg": "Invalid cliff"
    },
    {
      "code": 6036,
      "name": "InsufficientLamports",
      "msg": "Insufficient lamports"
    },
    {
      "code": 6037,
      "name": "TreasuryContainsStreams",
      "msg": "This treasury contains one or more streams"
    },
    {
      "code": 6038,
      "name": "InsufficientFunds",
      "msg": "Insufficient funds"
    }
  ]
}

export default IDL;