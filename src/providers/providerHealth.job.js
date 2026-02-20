const healthStore = require("./providerHealth");
const { getProvider, listProviders } = require("./registry");

const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Pings a single provider and updates health store
 */
async function pingProvider(providerName) {
  console.log("Pinging provider:", providerName);

  try {
    const provider = getProvider(providerName);

    if (typeof provider.healthCheck !== "function") {
      throw new Error(`healthCheck not implemented for ${providerName}`);
    }

    await provider.healthCheck();

    healthStore.markUp(providerName);
    console.log(`PROVIDER UP: ${providerName}`);
  } catch (err) {
    console.log("PING ERROR:", err?.response?.data || err?.message || err);

    healthStore.markDown(providerName);
    console.log(`PROVIDER DOWN: ${providerName}`);
  }
}

/**
 * Starts background health monitoring
 */
async function startProviderHealthJob() {
  console.log("Provider health recovery job started");

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
