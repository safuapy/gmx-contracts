const { ethers } = require('hardhat');

// First, create custom token contracts that inherit from GMX base contracts
// but allow custom names and symbols

/**
 * Deploy all token contracts with custom names and symbols
 * @param {ConfigLoader} config - Configuration object
 * @param {ContractDeployer} deployer - Contract deployer instance
 * @returns {Object} Object containing deployed token contracts
 */
async function deployTokens(config, deployer) {
  const govToken = config.getGovernanceToken();
  const liqToken = config.getLiquidityToken();
  const escToken = config.getEscrowedToken();
  const bonusToken = config.getBonusToken();

  deployer.logger.log(`Deploying governance token: ${govToken.name} (${govToken.symbol})`, 'info');
  
  // Deploy custom governance token (GMX equivalent)
  const governance = await deployer.deployContract('CustomGovernanceToken', [
    govToken.name,
    govToken.symbol
  ]);

  deployer.logger.log(`Deploying liquidity token: ${liqToken.name} (${liqToken.symbol})`, 'info');
  
  // Deploy custom liquidity token (GLP equivalent)
  const liquidity = await deployer.deployContract('CustomLiquidityToken', [
    liqToken.name,
    liqToken.symbol
  ]);

  deployer.logger.log(`Deploying escrowed token: ${escToken.name} (${escToken.symbol})`, 'info');
  
  // Deploy escrowed governance token (EsGMX equivalent)
  const escrowed = await deployer.deployContract('CustomEscrowedToken', [
    escToken.name,
    escToken.symbol
  ]);

  deployer.logger.log(`Deploying bonus token: ${bonusToken.name} (${bonusToken.symbol})`, 'info');
  
  // Deploy bonus token (bnGMX equivalent) - uses standard MintableBaseToken
  const bonus = await deployer.deployContract('MintableBaseToken', [
    bonusToken.name,
    bonusToken.symbol,
    0 // initial supply
  ]);

  // Set tokens to private transfer mode (required for GMX ecosystem)
  await deployer.sendTransaction(
    governance,
    'setInPrivateTransferMode',
    [true],
    'governance.setInPrivateTransferMode(true)'
  );

  await deployer.sendTransaction(
    liquidity,
    'setInPrivateTransferMode',
    [true],
    'liquidity.setInPrivateTransferMode(true)'
  );

  await deployer.sendTransaction(
    escrowed,
    'setInPrivateTransferMode',
    [true],
    'escrowed.setInPrivateTransferMode(true)'
  );

  deployer.logger.log('Token configurations completed', 'success');
}

module.exports = {
  deployTokens
};
