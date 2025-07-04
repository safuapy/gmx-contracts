const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

class DeploymentLogger {
  constructor(outputDir = 'deployment/output') {
    this.outputDir = outputDir;
    this.deployments = {};
    this.logs = [];
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    
    this.logs.push(logEntry);
    
    // Color output based on type
    let colorCode = colors.reset;
    switch (type) {
      case 'success': colorCode = colors.green; break;
      case 'error': colorCode = colors.red; break;
      case 'warning': colorCode = colors.yellow; break;
      case 'info': colorCode = colors.blue; break;
      case 'deploy': colorCode = colors.magenta; break;
    }
    
    console.log(`${colorCode}${logEntry}${colors.reset}`);
  }

  logDeploy(contractName, address, tx) {
    const deployInfo = {
      address,
      transactionHash: tx.deployTransaction?.hash || tx.hash,
      blockNumber: tx.deployTransaction?.blockNumber || tx.blockNumber,
      gasUsed: tx.deployTransaction?.gasUsed?.toString() || 'N/A',
      timestamp: new Date().toISOString()
    };

    this.deployments[contractName] = deployInfo;
    this.log(`Deployed ${contractName} at ${address}`, 'deploy');
    return deployInfo;
  }

  saveDeployments() {
    const outputPath = path.join(this.outputDir, 'deployments.json');
    fs.writeFileSync(outputPath, JSON.stringify(this.deployments, null, 2));
    this.log(`Saved deployments to ${outputPath}`, 'success');
  }

  saveLogs() {
    const outputPath = path.join(this.outputDir, 'deployment.log');
    fs.writeFileSync(outputPath, this.logs.join('\n'));
    this.log(`Saved logs to ${outputPath}`, 'success');
  }

  getDeployment(contractName) {
    return this.deployments[contractName];
  }

  getAllDeployments() {
    return this.deployments;
  }
}

class ContractDeployer {
  constructor(logger, signer) {
    this.logger = logger;
    this.signer = signer;
    this.deployedContracts = {};
  }

  async deployContract(contractName, args = [], options = {}) {
    try {
      this.logger.log(`Deploying ${contractName}...`, 'info');
      
      const ContractFactory = await ethers.getContractFactory(contractName, this.signer);
      const contract = await ContractFactory.deploy(...args, options);
      
      await contract.deployed();
      
      this.deployedContracts[contractName] = contract;
      this.logger.logDeploy(contractName, contract.address, contract);
      
      return contract;
    } catch (error) {
      this.logger.log(`Failed to deploy ${contractName}: ${error.message}`, 'error');
      throw error;
    }
  }

  async deployContractAt(contractName, address) {
    try {
      const contract = await ethers.getContractAt(contractName, address, this.signer);
      this.deployedContracts[contractName] = contract;
      this.logger.log(`Connected to existing ${contractName} at ${address}`, 'info');
      return contract;
    } catch (error) {
      this.logger.log(`Failed to connect to ${contractName} at ${address}: ${error.message}`, 'error');
      throw error;
    }
  }

  async sendTransaction(contract, method, args = [], description = '') {
    try {
      const desc = description || `${contract.constructor.name}.${method}`;
      this.logger.log(`Executing ${desc}...`, 'info');
      
      const tx = await contract[method](...args);
      const receipt = await tx.wait();
      
      this.logger.log(`✓ ${desc} - Gas used: ${receipt.gasUsed}`, 'success');
      return receipt;
    } catch (error) {
      const desc = description || `${contract.constructor.name}.${method}`;
      this.logger.log(`Failed ${desc}: ${error.message}`, 'error');
      throw error;
    }
  }

  getContract(contractName) {
    return this.deployedContracts[contractName];
  }

  getAllContracts() {
    return this.deployedContracts;
  }
}

// Utility functions
async function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function waitForConfirmations(tx, confirmations = 1) {
  console.log(`Waiting for ${confirmations} confirmations...`);
  return await tx.wait(confirmations);
}

function expandDecimals(value, decimals = 18) {
  return ethers.utils.parseUnits(value.toString(), decimals);
}

function toUsd(value) {
  return ethers.utils.parseUnits(value.toString(), 30);
}

function formatTokenAmount(amount, decimals = 18) {
  return ethers.utils.formatUnits(amount, decimals);
}

async function verifyBalance(token, account, expectedAmount, description = '') {
  const balance = await token.balanceOf(account);
  const expected = ethers.BigNumber.from(expectedAmount);
  
  if (!balance.eq(expected)) {
    throw new Error(
      `Balance verification failed for ${description}: expected ${expected.toString()}, got ${balance.toString()}`
    );
  }
  
  return true;
}

async function ensureTransactionSuccess(tx, description = '') {
  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    throw new Error(`Transaction failed: ${description}`);
  }
  return receipt;
}

// Network configuration helpers
const NETWORK_CONFIGS = {
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeToken: {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      symbol: 'ETH',
      decimals: 18
    }
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://base.llamarpc.com',
    blockExplorer: 'https://basescan.org',
    nativeToken: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'ETH',
      decimals: 18
    }
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: 'https://opt-mainnet.g.alchemy.com/v2/demo',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeToken: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'ETH',
      decimals: 18
    }
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon.llamarpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeToken: {
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      symbol: 'MATIC',
      decimals: 18
    }
  }
};

function getNetworkConfig(networkName) {
  const config = NETWORK_CONFIGS[networkName.toLowerCase()];
  if (!config) {
    throw new Error(`Unsupported network: ${networkName}`);
  }
  return config;
}

function validateNetwork(config) {
  const requiredFields = ['chainId', 'name', 'rpcUrl', 'nativeToken'];
  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Missing required network config field: ${field}`);
    }
  }
  
  if (!ethers.utils.isAddress(config.nativeToken.address)) {
    throw new Error(`Invalid native token address: ${config.nativeToken.address}`);
  }
}

// Contract verification helpers
async function generateVerificationData(deployments) {
  const verificationData = {};
  
  for (const [contractName, deployment] of Object.entries(deployments)) {
    verificationData[contractName] = {
      address: deployment.address,
      constructorArguments: deployment.constructorArguments || [],
      contract: deployment.contractPath || `contracts/${contractName}.sol:${contractName}`
    };
  }
  
  return verificationData;
}

module.exports = {
  DeploymentLogger,
  ContractDeployer,
  sleep,
  waitForConfirmations,
  expandDecimals,
  toUsd,
  formatTokenAmount,
  verifyBalance,
  ensureTransactionSuccess,
  getNetworkConfig,
  validateNetwork,
  generateVerificationData,
  colors
}; 