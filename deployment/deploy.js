#!/usr/bin/env node

const { ethers } = require('hardhat');
const { ConfigLoader } = require('./utils/config');
const { DeploymentLogger, ContractDeployer } = require('./utils/helpers');
const path = require('path');

// Import deployment modules
const { deployTokens } = require('./modules/tokens');
const { deployCoreContracts } = require('./modules/core');
const { deployStakingSystem } = require('./modules/staking');
const { deployGovernance } = require('./modules/governance');
const { setupSystem } = require('./modules/setup');

async function main() {
  console.log('🚀 Starting GMX Fork Deployment');
  console.log('================================\n');

  const configPath = process.env.CONFIG_PATH || path.join(__dirname, 'config', 'config.json');
  
  // Check if config exists, if not use example
  const fs = require('fs');
  if (!fs.existsSync(configPath)) {
    const examplePath = path.join(__dirname, 'config', 'config.example.json');
    if (fs.existsSync(examplePath)) {
      console.log(`📋 Config not found at ${configPath}`);
      console.log(`📋 Please copy ${examplePath} to ${configPath} and customize it`);
      console.log(`📋 Example: cp ${examplePath} ${configPath}`);
      process.exit(1);
    } else {
      throw new Error(`Config file not found: ${configPath}`);
    }
  }

  // Initialize configuration and logging
  const config = new ConfigLoader(configPath);
  const logger = new DeploymentLogger();
  
  logger.log(`Deploying ${config.getProjectName()}`, 'info');
  logger.log(`Target Network: ${config.getNetwork().name} (Chain ID: ${config.getNetwork().chainId})`, 'info');
  logger.log(`Max Leverage: ${config.getMaxLeverage()}x`, 'info');
  logger.log(`Governance Token: ${config.getGovernanceToken().symbol}`, 'info');
  logger.log(`Liquidity Token: ${config.getLiquidityToken().symbol}`, 'info');

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  logger.log(`Deployer: ${deployer.address}`, 'info');
  
  const balance = await deployer.getBalance();
  logger.log(`Deployer Balance: ${ethers.utils.formatEther(balance)} ${config.getNativeToken().symbol}`, 'info');

  const contractDeployer = new ContractDeployer(logger, deployer);

  try {
    // Phase 1: Deploy Token Contracts
    logger.log('\n📄 Phase 1: Deploying Token Contracts', 'info');
    logger.log('=====================================', 'info');
    const tokens = await deployTokens(config, contractDeployer);

    // Phase 2: Deploy Core Contracts
    logger.log('\n🏗️  Phase 2: Deploying Core Contracts', 'info');
    logger.log('=====================================', 'info');
    const coreContracts = await deployCoreContracts(config, contractDeployer, tokens);

    // Phase 3: Deploy Staking System
    logger.log('\n🥩 Phase 3: Deploying Staking System', 'info');
    logger.log('=====================================', 'info');
    const stakingContracts = await deployStakingSystem(config, contractDeployer, tokens, coreContracts);

    // Phase 4: Deploy Governance
    logger.log('\n🏛️  Phase 4: Deploying Governance System', 'info');
    logger.log('==========================================', 'info');
    const governanceContracts = await deployGovernance(config, contractDeployer, tokens, coreContracts, stakingContracts);

    // Phase 5: System Setup and Configuration
    logger.log('\n⚙️  Phase 5: System Setup and Configuration', 'info');
    logger.log('===========================================', 'info');
    await setupSystem(config, contractDeployer, tokens, coreContracts, stakingContracts, governanceContracts);

    // Save deployment data
    logger.saveDeployments();
    logger.saveLogs();

    // Generate summary
    await generateDeploymentSummary(config, logger, tokens, coreContracts, stakingContracts, governanceContracts);

    logger.log('\n🎉 Deployment Complete!', 'success');
    logger.log('========================', 'success');

  } catch (error) {
    logger.log(`\n❌ Deployment failed: ${error.message}`, 'error');
    logger.log(error.stack, 'error');
    
    logger.saveDeployments();
    logger.saveLogs();
    
    process.exit(1);
  }
}

async function generateDeploymentSummary(config, logger, tokens, coreContracts, stakingContracts, governanceContracts) {
  const summary = {
    project: {
      name: config.getProjectName(),
      description: config.get('project.description'),
      deployedAt: new Date().toISOString(),
      network: config.getNetwork()
    },
    tokens: {
      governance: {
        name: config.getGovernanceToken().name,
        symbol: config.getGovernanceToken().symbol,
        address: tokens.governance.address
      },
      liquidity: {
        name: config.getLiquidityToken().name,
        symbol: config.getLiquidityToken().symbol,
        address: tokens.liquidity.address
      },
      escrowed: {
        name: config.getEscrowedToken().name,
        symbol: config.getEscrowedToken().symbol,
        address: tokens.escrowed.address
      }
    },
    contracts: {
      core: {
        vault: coreContracts.vault.address,
        router: coreContracts.router.address,
        usdg: coreContracts.usdg.address,
        glpManager: coreContracts.glpManager.address,
        priceFeed: coreContracts.vaultPriceFeed.address
      },
      staking: {
        rewardRouter: stakingContracts.rewardRouter.address,
        stakedGmxTracker: stakingContracts.stakedGmxTracker.address,
        stakedGlpTracker: stakingContracts.stakedGlpTracker.address,
        gmxVester: stakingContracts.gmxVester.address,
        glpVester: stakingContracts.glpVester.address
      },
      governance: {
        timelock: governanceContracts.timelock.address
      }
    },
    settings: {
      maxLeverage: config.getMaxLeverage(),
      leverageBasisPoints: config.getMaxLeverageBasisPoints(),
      liquidationFeeUsd: config.getLiquidationFeeUsd().toString(),
      fees: config.getFees()
    },
    supportedTokens: config.getSupportedTokens().map(token => ({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      isStable: token.isStable,
      isShortable: token.isShortable
    }))
  };

  // Save summary
  const fs = require('fs');
  const outputPath = path.join(logger.outputDir, 'deployment-summary.json');
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  
  logger.log(`\n📊 DEPLOYMENT SUMMARY`, 'success');
  logger.log(`=====================`, 'success');
  logger.log(`Project: ${summary.project.name}`, 'info');
  logger.log(`Network: ${summary.project.network.name}`, 'info');
  logger.log(`Governance Token: ${summary.tokens.governance.symbol} (${summary.tokens.governance.address})`, 'info');
  logger.log(`Liquidity Token: ${summary.tokens.liquidity.symbol} (${summary.tokens.liquidity.address})`, 'info');
  logger.log(`Vault: ${summary.contracts.core.vault}`, 'info');
  logger.log(`Router: ${summary.contracts.core.router}`, 'info');
  logger.log(`RewardRouter: ${summary.contracts.staking.rewardRouter}`, 'info');
  logger.log(`Timelock: ${summary.contracts.governance.timelock}`, 'info');
  logger.log(`Max Leverage: ${summary.settings.maxLeverage}x`, 'info');
  logger.log(`Supported Tokens: ${summary.supportedTokens.length}`, 'info');
  logger.log(`\n📁 Files saved to: ${logger.outputDir}/`, 'success');
  logger.log(`- deployment-summary.json`, 'info');
  logger.log(`- deployments.json`, 'info');
  logger.log(`- deployment.log`, 'info');

  // Generate quick setup commands
  const quickSetup = `
# Quick Setup Commands (run these after deployment)
# Replace addresses with actual deployed addresses

# Add liquidity to the pool
npx hardhat run scripts/post-deployment/add-initial-liquidity.js --network ${config.getNetwork().name}

# Set up price feeds
npx hardhat run scripts/post-deployment/setup-price-feeds.js --network ${config.getNetwork().name}

# Configure token weights
npx hardhat run scripts/post-deployment/configure-tokens.js --network ${config.getNetwork().name}

# Initialize staking rewards
npx hardhat run scripts/post-deployment/setup-rewards.js --network ${config.getNetwork().name}
`;

  const setupPath = path.join(logger.outputDir, 'post-deployment-commands.txt');
  fs.writeFileSync(setupPath, quickSetup);
  
  logger.log(`- post-deployment-commands.txt`, 'info');
  logger.log(`\n🔄 Next steps:`, 'warning');
  logger.log(`1. Verify contracts on block explorer`, 'warning');
  logger.log(`2. Add initial liquidity to the pools`, 'warning');
  logger.log(`3. Configure price feeds and token settings`, 'warning');
  logger.log(`4. Set up staking rewards distribution`, 'warning');
  logger.log(`5. Transfer governance to community multisig`, 'warning');
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = { main }; 