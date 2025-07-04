const { ethers } = require('hardhat');

/**
 * Deploy core trading infrastructure contracts
 * @param {ConfigLoader} config - Configuration object
 * @param {ContractDeployer} deployer - Contract deployer instance
 * @param {Object} tokens - Previously deployed token contracts
 * @returns {Object} Object containing deployed core contracts
 */
async function deployCoreContracts(config, deployer, tokens) {
  const nativeToken = config.getNativeToken();

  // Deploy Vault (main trading contract)
  deployer.logger.log('Deploying Vault...', 'info');
  const vault = await deployer.deployContract('Vault', []);

  // Deploy USDG (stablecoin)
  deployer.logger.log('Deploying USDG...', 'info');
  const usdg = await deployer.deployContract('USDG', [vault.address]);

  // Deploy Router
  deployer.logger.log('Deploying Router...', 'info');
  const router = await deployer.deployContract('Router', [vault.address, usdg.address, nativeToken.address || ethers.constants.AddressZero]);

  // Deploy VaultPriceFeed
  deployer.logger.log('Deploying VaultPriceFeed...', 'info');
  const vaultPriceFeed = await deployer.deployContract('VaultPriceFeed', []);

  // Configure VaultPriceFeed
  await deployer.sendTransaction(
    vaultPriceFeed,
    'setMaxStrictPriceDeviation',
    [ethers.utils.parseUnits('0.5', 30)], // 0.5% max deviation
    'vaultPriceFeed.setMaxStrictPriceDeviation'
  );

  await deployer.sendTransaction(
    vaultPriceFeed,
    'setPriceSampleSpace',
    [3], // 3 sample space
    'vaultPriceFeed.setPriceSampleSpace'
  );

  await deployer.sendTransaction(
    vaultPriceFeed,
    'setIsAmmEnabled',
    [false], // Disable AMM
    'vaultPriceFeed.setIsAmmEnabled'
  );

  deployer.logger.log('VaultPriceFeed configured', 'success');

  // Deploy ShortsTracker
  deployer.logger.log('Deploying ShortsTracker...', 'info');
  const shortsTracker = await deployer.deployContract('ShortsTracker', [vault.address]);

  // Deploy GlpManager
  deployer.logger.log('Deploying GlpManager...', 'info');
  const glpManager = await deployer.deployContract('GlpManager', [
    vault.address,
    usdg.address,
    tokens.liquidity.address,
    shortsTracker.address,
    config.getGlpCooldownDuration() // 15 minutes cooldown
  ]);

  // Deploy VaultUtils
  deployer.logger.log('Deploying VaultUtils...', 'info');
  const vaultUtils = await deployer.deployContract('VaultUtils', [vault.address]);

  // Configure Vault with 1000x leverage
  deployer.logger.log('Configuring Vault with 1000x leverage...', 'info');
  
  // Set max leverage to 1000x (10,000,000 basis points)
  await deployer.sendTransaction(
    vault,
    'setMaxLeverage',
    [config.getMaxLeverageBasisPoints()],
    'vault.setMaxLeverage to 1000x'
  );

  await deployer.sendTransaction(
    vault,
    'setVaultUtils',
    [vaultUtils.address],
    'vault.setVaultUtils'
  );

  await deployer.sendTransaction(
    vault,
    'setPriceFeed',
    [vaultPriceFeed.address],
    'vault.setPriceFeed'
  );

  await deployer.sendTransaction(
    vault,
    'addRouter',
    [router.address],
    vault,
    'setUsdg',
    [usdg.address],
    'vault.setUsdg'
  );

  deployer.logger.log('Vault configuration completed', 'success');
  deployer.logger.log(`🎯 Max leverage set to ${config.getMaxLeverage()}x`, 'info');

  return {
    vault: vault.address,
    usdg: usdg.address,
    router: router.address,
    vaultPriceFeed: vaultPriceFeed.address,
    shortsTracker: shortsTracker.address,
    glpManager: glpManager.address,
    vaultUtils: vaultUtils.address
  };
}

module.exports = {
  deployCoreContracts
};
