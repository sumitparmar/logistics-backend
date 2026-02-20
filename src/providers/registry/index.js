const BorzoProvider = require("../borzo/borzo.provider");

const providers = Object.freeze({
  BORZO: new BorzoProvider(),
});

/**
 * Returns provider instance
 */
function getProvider(name) {
  if (!name) return null;

  const provider = providers[name];

  if (!provider) {
    throw new Error(`Provider not registered: ${name}`);
  }

  return provider;
}

/**
 * List registered providers
 */
function listProviders() {
  return Object.keys(providers);
}

module.exports = {
  getProvider,
  listProviders,
};
