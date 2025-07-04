const { ethers } = require('hardhat');

/**
 * Deploy complete staking system including reward trackers, distributors, vesters and reward router
 * @param {ConfigLoader} config - Configuration object
 * @param {ContractDeployer} deployer - Contract deployer instance
 * @param {Object} tokens - Previously deployed token contracts
 * @param {Object} coreContracts - Previously deployed core contracts
 * @returns {Object} Object containing deployed staking contracts
 */
async function deployStakingSystem(config, deployer, tokens, coreContracts) {
  const nativeToken = config.getNativeToken();
  const vestingDuration = config.getVestingDuration();

  // Deploy GMX staking trackers
  const gmxStakingContracts = await deployGmxStaking(config, deployer, tokens, nativeToken);
  
  // Deploy GLP staking trackers
  const glpStakingContracts = await deployGlpStaking(config, deployer, tokens, nativeToken);

  // Deploy vesters
  const vesters = await deployVesters(config, deployer, tokens, gmxStakingContracts, glpStakingContracts, vestingDuration);

  // Deploy RewardRouter
  const rewardRouter = await deployRewardRouter(config, deployer, tokens, gmxStakingContracts, glpStakingContracts, vesters, coreContracts, nativeToken);

  // Configure staking system
  await configureStakingSystem(config, deployer, tokens, gmxStakingContracts, glpStakingContracts, vesters, rewardRouter, coreContracts);

  return {
    // GMX staking
    stakedGmxTracker: gmxStakingContracts.stakedGmxTracker,
    stakedGmxDistributor: gmxStakingContracts.stakedGmxDistributor,
    bonusGmxTracker: gmxStakingContracts.bonusGmxTracker,
    bonusGmxDistributor: gmxStakingContracts.bonusGmxDistributor,
    feeGmxTracker: gmxStakingContracts.feeGmxTracker,
    feeGmxDistributor: gmxStakingContracts.feeGmxDistributor,

    // GLP staking
    feeGlpTracker: glpStakingContracts.feeGlpTracker,
    feeGlpDistributor: glpStakingContracts.feeGlpDistributor,
    stakedGlpTracker: glpStakingContracts.stakedGlpTracker,
    stakedGlpDistributor: glpStakingContracts.stakedGlpDistributor,

    // Vesters
    gmxVester: vesters.gmxVester,
    glpVester: vesters.glpVester,

    // Router
    rewardRouter
  };
}

/**
 * Deploy GMX staking infrastructure
 */
async function deployGmxStaking(config, deployer, tokens, nativeToken) {
  const govSymbol = config.getGovernanceToken().symbol;

  // Deploy Staked GMX Tracker
  deployer.logger.log(`Deploying Staked ${govSymbol} Tracker...`, 'info');
  const stakedGmxTracker = await deployer.deployContract('RewardTracker', [
    `Staked ${govSymbol}`,
    `s${govSymbol}`
  ]);

  const stakedGmxDistributor = await deployer.deployContract('RewardDistributor', [
    tokens.escrowed.address,
    stakedGmxTracker.address
  ]);

  await deployer.sendTransaction(
    stakedGmxTracker,
    'initialize',
    [[tokens.governance.address, tokens.escrowed.address], stakedGmxDistributor.address],
    'stakedGmxTracker.initialize'
  );

  await deployer.sendTransaction(
    stakedGmxDistributor,
    'updateLastDistributionTime',
    [],
    'stakedGmxDistributor.updateLastDistributionTime'
  );

  // Deploy Bonus GMX Tracker
  deployer.logger.log(`Deploying Bonus ${govSymbol} Tracker...`, 'info');
  const bonusGmxTracker = await deployer.deployContract('RewardTracker', [
    `Staked + Bonus ${govSymbol}`,
    `sb${govSymbol}`
  ]);

  const bonusGmxDistributor = await deployer.deployContract('BonusDistributor', [
    tokens.bonus.address,
    bonusGmxTracker.address
  ]);

  await deployer.sendTransaction(
    bonusGmxTracker,
    'initialize',
    [[stakedGmxTracker.address], bonusGmxDistributor.address],
    'bonusGmxTracker.initialize'
  );

  await deployer.sendTransaction(
    bonusGmxDistributor,
    'updateLastDistributionTime',
    [],
    'bonusGmxDistributor.updateLastDistributionTime'
  );

  // Deploy Fee GMX Tracker
  deployer.logger.log(`Deploying Fee ${govSymbol} Tracker...`, 'info');
  const feeGmxTracker = await deployer.deployContract('RewardTracker', [
    `Staked + Bonus + Fee ${govSymbol}`,
    `sbf${govSymbol}`
  ]);

  const feeGmxDistributor = await deployer.deployContract('RewardDistributor', [
    nativeToken.address,
    feeGmxTracker.address
  ]);

  await deployer.sendTransaction(
    feeGmxTracker,
    'initialize',
    [[bonusGmxTracker.address, tokens.bonus.address], feeGmxDistributor.address],
    'feeGmxTracker.initialize'
  );

  await deployer.sendTransaction(
    feeGmxDistributor,
    'updateLastDistributionTime',
    [],
    'feeGmxDistributor.updateLastDistributionTime'
  );

  // Set tracker modes
  await setTrackerModes(deployer, [stakedGmxTracker, bonusGmxTracker, feeGmxTracker]);

  return {
    stakedGmxTracker,
    stakedGmxDistributor,
    bonusGmxTracker,
    bonusGmxDistributor,
    feeGmxTracker,
    feeGmxDistributor
  };
}

/**
 * Deploy GLP staking infrastructure
 */
async function deployGlpStaking(config, deployer, tokens, nativeToken) {
  const liqSymbol = config.getLiquidityToken().symbol;

  // Deploy Fee GLP Tracker
  deployer.logger.log(`Deploying Fee ${liqSymbol} Tracker...`, 'info');
  const feeGlpTracker = await deployer.deployContract('RewardTracker', [
    `Fee ${liqSymbol}`,
    `f${liqSymbol}`
  ]);

  const feeGlpDistributor = await deployer.deployContract('RewardDistributor', [
    nativeToken.address,
    feeGlpTracker.address
  ]);

  await deployer.sendTransaction(
    feeGlpTracker,
    'initialize',
    [[tokens.liquidity.address], feeGlpDistributor.address],
    'feeGlpTracker.initialize'
  );

  await deployer.sendTransaction(
    feeGlpDistributor,
    'updateLastDistributionTime',
    [],
    'feeGlpDistributor.updateLastDistributionTime'
  );

  // Deploy Staked GLP Tracker
  deployer.logger.log(`Deploying Staked ${liqSymbol} Tracker...`, 'info');
  const stakedGlpTracker = await deployer.deployContract('RewardTracker', [
    `Fee + Staked ${liqSymbol}`,
    `fs${liqSymbol}`
  ]);

  const stakedGlpDistributor = await deployer.deployContract('RewardDistributor', [
    tokens.escrowed.address,
    stakedGlpTracker.address
  ]);

  await deployer.sendTransaction(
    stakedGlpTracker,
    'initialize',
    [[feeGlpTracker.address], stakedGlpDistributor.address],
    'stakedGlpTracker.initialize'
  );

  await deployer.sendTransaction(
    stakedGlpDistributor,
    'updateLastDistributionTime',
    [],
    'stakedGlpDistributor.updateLastDistributionTime'
  );

  // Set tracker modes
  await setTrackerModes(deployer, [feeGlpTracker, stakedGlpTracker]);

  return {
    feeGlpTracker,
    feeGlpDistributor,
    stakedGlpTracker,
    stakedGlpDistributor
  };
}

/**
 * Deploy vesting contracts
 */
async function deployVesters(config, deployer, tokens, gmxStaking, glpStaking, vestingDuration) {
  const govSymbol = config.getGovernanceToken().symbol;
  const liqSymbol = config.getLiquidityToken().symbol;

  // Deploy GMX Vester
  deployer.logger.log(`Deploying ${govSymbol} Vester...`, 'info');
  const gmxVester = await deployer.deployContract('Vester', [
    `Vested ${govSymbol}`,
    `v${govSymbol}`,
    vestingDuration,
    tokens.escrowed.address,
    gmxStaking.feeGmxTracker.address,
    tokens.governance.address,
    gmxStaking.stakedGmxTracker.address
  ]);

  // Deploy GLP Vester
  deployer.logger.log(`Deploying ${liqSymbol} Vester...`, 'info');
  const glpVester = await deployer.deployContract('Vester', [
    `Vested ${liqSymbol}`,
    `v${liqSymbol}`,
    vestingDuration,
    tokens.escrowed.address,
    glpStaking.stakedGlpTracker.address,
    tokens.governance.address,
    glpStaking.stakedGlpTracker.address
  ]);

  return {
    gmxVester,
    glpVester
  };
}

/**
 * Deploy RewardRouter
 */
async function deployRewardRouter(config, deployer, tokens, gmxStaking, glpStaking, vesters, coreContracts, nativeToken) {
  deployer.logger.log('Deploying RewardRouterV2...', 'info');
  const rewardRouter = await deployer.deployContract('RewardRouterV2', []);

  await deployer.sendTransaction(
    rewardRouter,
    'initialize',
    [
      nativeToken.address,
      tokens.governance.address,
      tokens.escrowed.address,
      tokens.bonus.address,
      tokens.liquidity.address,
      gmxStaking.stakedGmxTracker.address,
      gmxStaking.bonusGmxTracker.address,
      gmxStaking.feeGmxTracker.address,
      glpStaking.feeGlpTracker.address,
      glpStaking.stakedGlpTracker.address,
      coreContracts.glpManager.address,
      vesters.gmxVester.address,
      vesters.glpVester.address
    ],
    'rewardRouter.initialize'
  );

  return rewardRouter;
}

/**
 * Configure staking system permissions and handlers
 */
async function configureStakingSystem(config, deployer, tokens, gmxStaking, glpStaking, vesters, rewardRouter, coreContracts) {
  // Set GlpManager handler
  await deployer.sendTransaction(
    coreContracts.glpManager,
    'setHandler',
    [rewardRouter.address, true],
    'glpManager.setHandler(rewardRouter)'
  );

  // Configure GMX staking handlers
  await deployer.sendTransaction(
    gmxStaking.stakedGmxTracker,
    'setHandler',
    [rewardRouter.address, true],
    'stakedGmxTracker.setHandler(rewardRouter)'
  );

  await deployer.sendTransaction(
    gmxStaking.stakedGmxTracker,
    'setHandler',
    [gmxStaking.bonusGmxTracker.address, true],
    'stakedGmxTracker.setHandler(bonusGmxTracker)'
  );

  await deployer.sendTransaction(
    gmxStaking.bonusGmxTracker,
    'setHandler',
    [rewardRouter.address, true],
    'bonusGmxTracker.setHandler(rewardRouter)'
  );

  await deployer.sendTransaction(
    gmxStaking.bonusGmxTracker,
    'setHandler',
    [gmxStaking.feeGmxTracker.address, true],
    'bonusGmxTracker.setHandler(feeGmxTracker)'
  );

  await deployer.sendTransaction(
    gmxStaking.feeGmxTracker,
    'setHandler',
    [rewardRouter.address, true],
    'feeGmxTracker.setHandler(rewardRouter)'
  );

  // Configure GLP staking handlers
  await deployer.sendTransaction(
    glpStaking.feeGlpTracker,
    'setHandler',
    [rewardRouter.address, true],
    'feeGlpTracker.setHandler(rewardRouter)'
  );

  await deployer.sendTransaction(
    glpStaking.feeGlpTracker,
    'setHandler',
    [glpStaking.stakedGlpTracker.address, true],
    'feeGlpTracker.setHandler(stakedGlpTracker)'
  );

  await deployer.sendTransaction(
    glpStaking.stakedGlpTracker,
    'setHandler',
    [rewardRouter.address, true],
    'stakedGlpTracker.setHandler(rewardRouter)'
  );

  // Configure vester handlers
  await deployer.sendTransaction(
    vesters.gmxVester,
    'setHandler',
    [rewardRouter.address, true],
    'gmxVester.setHandler(rewardRouter)'
  );

  await deployer.sendTransaction(
    vesters.glpVester,
    'setHandler',
    [rewardRouter.address, true],
    'glpVester.setHandler(rewardRouter)'
  );

  // Configure escrowed token handlers
  await deployer.sendTransaction(
    tokens.escrowed,
    'setHandler',
    [gmxStaking.stakedGmxDistributor.address, true],
    'escrowed.setHandler(stakedGmxDistributor)'
  );

  await deployer.sendTransaction(
    tokens.escrowed,
    'setHandler',
    [glpStaking.stakedGlpDistributor.address, true],
    'escrowed.setHandler(stakedGlpDistributor)'
  );

  await deployer.sendTransaction(
    tokens.escrowed,
    'setHandler',
    [vesters.gmxVester.address, true],
    'escrowed.setHandler(gmxVester)'
  );

  await deployer.sendTransaction(
    tokens.escrowed,
    'setHandler',
    [vesters.glpVester.address, true],
    'escrowed.setHandler(glpVester)'
  );

  // Configure bonus token handlers
  await deployer.sendTransaction(
    tokens.bonus,
    'setMinter',
    [gmxStaking.bonusGmxDistributor.address, true],
    'bonus.setMinter(bonusGmxDistributor)'
  );

  await deployer.sendTransaction(
    tokens.bonus,
    'setHandler',
    [gmxStaking.feeGmxTracker.address, true],
    'bonus.setHandler(feeGmxTracker)'
  );

  deployer.logger.log('Staking system configured successfully', 'success');
}

/**
 * Set tracker modes (private transfer, staking, claiming)
 */
async function setTrackerModes(deployer, trackers) {
  for (const tracker of trackers) {
    await deployer.sendTransaction(
      tracker,
      'setInPrivateTransferMode',
      [true],
      `${tracker.constructor.name}.setInPrivateTransferMode`
    );

    await deployer.sendTransaction(
      tracker,
      'setInPrivateStakingMode',
      [true],
      `${tracker.constructor.name}.setInPrivateStakingMode`
    );

    // Set claiming mode for bonus trackers
    if (tracker.constructor.name === 'bonusGmxTracker') {
      await deployer.sendTransaction(
        tracker,
        'setInPrivateClaimingMode',
        [true],
        `${tracker.constructor.name}.setInPrivateClaimingMode`
      );
    }
  }
}

module.exports = {
  deployStakingSystem
}; 