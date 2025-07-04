require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-contract-sizer")
require('@typechain/hardhat')

module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: "https://arbitrum-mainnet.infura.io/v3/84842078b09946638c03157f83405213",
        blockNumber: 170000000
      },
      allowUnlimitedContractSize: true,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
        initialIndex: 0,
        accountsBalance: "10000000000000000000000" // 10,000 ETH
      }
    }
  },
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10
      }
    }
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
}
