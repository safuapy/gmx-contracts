const hre = require("hardhat");
const path = require("path");
const { ConfigLoader } = require("./utils/config");
const { DeploymentLogger, ContractDeployer } = require("./utils/helpers");

async function main() {
  const logger = new DeploymentLogger();
  
  try {
    // Load test configuration
    const configFileName = process.env.CONFIG_PATH || "config.test.json";
    const configPath = path.join(__dirname, "config", configFileName);
    logger.log(`Loading configuration from: ${configPath}`, 'info');
    
    const config = new ConfigLoader(configPath);
    
    // Get network info
    const network = await hre.ethers.provider.getNetwork();
    logger.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`, 'info');
    
    // Get deployer account
    const [signer] = await hre.ethers.getSigners();
    const balance = await signer.getBalance();
    
    logger.log(`Deployer: ${signer.address}`, 'info');
    logger.log(`Balance: ${hre.ethers.utils.formatEther(balance)} ETH`, 'info');
    
    if (balance.lt(hre.ethers.utils.parseEther("1"))) {
      logger.log("Insufficient balance for deployment (need at least 1 ETH)", 'error');
      return;
    }
    
    // Create contract deployer
    const deployer = new ContractDeployer(logger, signer);
    
    // Import deployment modules
    const { deployTokens } = require("./modules/tokens");
    const { deployCoreContracts } = require("./modules/core");
    
    logger.log("=== STARTING TESTDEX DEPLOYMENT ===", 'info');
    logger.log(`Project: ${config.getProjectName()}`, 'info');
    logger.log(`Governance Token: ${config.getGovernanceToken().symbol}`, 'info');
    logger.log(`Liquidity Token: ${config.getLiquidityToken().symbol}`, 'info');
    logger.log(`Max Leverage: ${config.getMaxLeverage()}x`, 'info');
    
    // Phase 1: Deploy Tokens
    logger.log("=== Phase 1: Deploying Custom Tokens ===", 'info');
    await deployTokens(config, deployer);
    logger.log("✅ Token deployment completed", 'success');
    
    // Get deployed tokens for core deployment (match what core module expects)
    const tokens = {
      governance: deployer.getContract('CustomGovernanceToken'),
      liquidity: deployer.getContract('CustomLiquidityToken'),
      escrowed: deployer.getContract('CustomEscrowedToken'),
      bonus: deployer.getContract('MintableBaseToken')
    };
    
    // Phase 2: Deploy Core Contracts  
    logger.log("=== Phase 2: Deploying Core Contracts ===", 'info');
    await deployCoreContracts(config, deployer, tokens);
    logger.log("✅ Core deployment completed", 'success');
    
    // Display deployment summary
    logger.log("=== DEPLOYMENT SUMMARY ===", 'info');
    const allContracts = deployer.getAllContracts();
    Object.entries(allContracts).forEach(([name, contract]) => {
      logger.log(`  ${name}: ${contract.address}`, 'info');
    });
    
    // Save deployment data
    logger.saveDeployments();
    logger.saveLogs();
    
    logger.log("🎉 TestDEX deployment completed successfully!", 'success');
    
  } catch (error) {
    logger.log(`Deployment failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
