const healthStore = require("./providerHealth");
const { getProvider, listProviders } = require("./registry");

const CHECK_INTERVAL_MS = 60 * 1000;

//  Pings a single provider and updates health store

async function pingProvider(providerName) {
  try {
    const provider = getProvider(providerName);

    if (typeof provider.healthCheck !== "function") {
      throw new Error(`healthCheck not implemented for ${providerName}`);
    }

    await provider.healthCheck();

    healthStore.markUp(providerName);
  } catch (err) {
    healthStore.markDown(providerName);
  }
}

//  Starts background health monitoring

async function startProviderHealthJob() {
  // Run once immediately on startup
  const providers = listProviders();

  for (const providerName of providers) {
    await pingProvider(providerName);
  }

  // Run periodically
  setInterval(async () => {
    const providers = listProviders();

    for (const providerName of providers) {
      await pingProvider(providerName);
    }
  }, CHECK_INTERVAL_MS);
}

module.exports = startProviderHealthJob;
