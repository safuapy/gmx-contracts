const fs = require('fs');
const path = require('path');

class ConfigLoader {
  constructor(configFile = 'config.example.json') {
    this.configFile = configFile;
    this.config = null;
  }

  async load() {
    const configPath = path.join(__dirname, this.configFile);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    this.config = JSON.parse(configData);
    return this.config;
  }

  // Project info
  getProjectName() {
    return this.config.project.name;
  }

  getProjectDescription() {
    return this.config.project.description;
  }

  // Token configurations
  getGovernanceTokenName() {
    return this.config.tokens.governance.name;
  }

  getGovernanceTokenSymbol() {
    return this.config.tokens.governance.symbol;
  }

  getLiquidityTokenName() {
    return this.config.tokens.liquidity.name;
  }

  getLiquidityTokenSymbol() {
    return this.config.tokens.liquidity.symbol;
  }

  getEscrowedTokenName() {
    return this.config.tokens.escrowed.name;
  }

  getEscrowedTokenSymbol() {
    return this.config.tokens.escrowed.symbol;
  }

  getBonusTokenName() {
    return this.config.tokens.bonus.name;
  }

  getBonusTokenSymbol() {
    return this.config.tokens.bonus.symbol;
  }

  // Settings
  getMaxLeverage() {
    return parseInt(this.config.settings.maxLeverage);
  }

  getMaxLeverageBasisPoints() {
    return this.getMaxLeverage() * 10000; // Convert to basis points
  }

  // Network info
  getChainId() {
    return parseInt(this.config.network.chainId);
  }

  getNetworkName() {
    return this.config.network.name;
  }

  // Supported tokens
  getSupportedTokens() {
    return this.config.supportedTokens || [];
  }

  // Fees
  getFees() {
    return this.config.fees;
  }

  // Governance
  getGovernanceSettings() {
    return this.config.governance;
  }
}

module.exports = { ConfigLoader };
