const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

class ConfigLoader {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = null;
    this.loadConfig();
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      this.validateConfig();
    } catch (error) {
      throw new Error(`Failed to load config from ${this.configPath}: ${error.message}`);
    }
  }

  validateConfig() {
    const required = [
      'project.name',
      'tokens.governance.symbol',
      'tokens.liquidity.symbol',
      'settings.maxLeverage',
      'network.chainId',
      'network.nativeToken.address'
    ];

    for (const field of required) {
      if (!this.getNestedValue(field)) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }

    // Validate leverage is within reasonable bounds
    const maxLeverage = parseInt(this.config.settings.maxLeverage);
    if (maxLeverage < 1 || maxLeverage > 2000) {
      throw new Error(`Invalid maxLeverage: ${maxLeverage}. Must be between 1 and 2000.`);
    }

    // Validate token symbols are unique
    const symbols = [
      this.config.tokens.governance.symbol,
      this.config.tokens.liquidity.symbol,
      this.config.tokens.escrowed.symbol,
      this.config.tokens.bonus.symbol
    ];

    const uniqueSymbols = new Set(symbols);
    if (uniqueSymbols.size !== symbols.length) {
      throw new Error('All token symbols must be unique');
    }

    // Validate addresses are valid
    if (!ethers.utils.isAddress(this.config.network.nativeToken.address)) {
      throw new Error(`Invalid native token address: ${this.config.network.nativeToken.address}`);
    }

    // Validate supported tokens
    for (const token of this.config.supportedTokens) {
      if (!ethers.utils.isAddress(token.address)) {
        throw new Error(`Invalid token address for ${token.symbol}: ${token.address}`);
      }
      if (!ethers.utils.isAddress(token.priceFeed)) {
        throw new Error(`Invalid price feed address for ${token.symbol}: ${token.priceFeed}`);
      }
    }
  }

  getNestedValue(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
  }

  get(path) {
    return this.getNestedValue(path);
  }

  // Getters for common values
  getProjectName() {
    return this.config.project.name;
  }

  getGovernanceToken() {
    return this.config.tokens.governance;
  }

  getLiquidityToken() {
    return this.config.tokens.liquidity;
  }

  getEscrowedToken() {
    return this.config.tokens.escrowed;
  }

  getBonusToken() {
    return this.config.tokens.bonus;
  }

  getMaxLeverage() {
    return parseInt(this.config.settings.maxLeverage);
  }

  getMaxLeverageBasisPoints() {
    return this.getMaxLeverage() * 10000; // Convert to basis points
  }

  getLiquidationFeeUsd() {
    return ethers.utils.parseUnits(this.config.settings.liquidationFeeUsd, 30); // 30 decimals for USD
  }

  getFundingInterval() {
    return parseInt(this.config.settings.fundingInterval);
  }

  getFundingRateFactor() {
    return parseInt(this.config.settings.fundingRateFactor);
  }

  getStableFundingRateFactor() {
    return parseInt(this.config.settings.stableFundingRateFactor);
  }

  getGlpCooldownDuration() {
    return parseInt(this.config.settings.glpCooldownDuration);
  }

  getVestingDuration() {
    return parseInt(this.config.settings.vestingDuration);
  }

  getFees() {
    return {
      taxBasisPoints: parseInt(this.config.fees.taxBasisPoints),
      stableTaxBasisPoints: parseInt(this.config.fees.stableTaxBasisPoints),
      mintBurnFeeBasisPoints: parseInt(this.config.fees.mintBurnFeeBasisPoints),
      swapFeeBasisPoints: parseInt(this.config.fees.swapFeeBasisPoints),
      stableSwapFeeBasisPoints: parseInt(this.config.fees.stableSwapFeeBasisPoints),
      marginFeeBasisPoints: parseInt(this.config.fees.marginFeeBasisPoints),
      minProfitTime: parseInt(this.config.fees.minProfitTime),
      hasDynamicFees: this.config.fees.hasDynamicFees
    };
  }

  getGovernance() {
    return {
      timelockBuffer: parseInt(this.config.governance.timelockBuffer),
      maxTokenSupply: this.config.governance.maxTokenSupply,
      marginFeeBasisPoints: parseInt(this.config.governance.marginFeeBasisPoints),
      maxMarginFeeBasisPoints: parseInt(this.config.governance.maxMarginFeeBasisPoints)
    };
  }

  getNetwork() {
    return this.config.network;
  }

  getNativeToken() {
    return this.config.network.nativeToken;
  }

  getSupportedTokens() {
    return this.config.supportedTokens;
  }

  getPriceFeeds() {
    return this.config.priceFeeds;
  }

  // Helper to expand decimals for a value
  expandDecimals(value, decimals = 18) {
    return ethers.utils.parseUnits(value.toString(), decimals);
  }

  // Helper to convert USD to internal representation (30 decimals)
  toUsd(value) {
    return ethers.utils.parseUnits(value.toString(), 30);
  }
}

module.exports = { ConfigLoader }; 