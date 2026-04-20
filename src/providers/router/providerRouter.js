const { getProvider, listProviders } = require("../registry");
const healthStore = require("../providerHealth.store");

class ProviderRouter {
  getAvailableProvider() {
    const directBorzo =
      getProvider("BORZO") || getProvider("borzo") || getProvider("Borzo");

    if (directBorzo) {
      return directBorzo;
    }

    const providers =
      typeof listProviders === "function" ? listProviders() : [];

    for (const name of providers) {
      const provider = getProvider(name);
      if (provider) {
        return provider;
      }
    }

    throw new Error("No providers available");
  }

  async calculatePrice(payload) {
    const provider = this.getAvailableProvider();
    return provider.calculatePrice(payload);
  }

  async createOrder(payload) {
    const provider = this.getAvailableProvider();
    return provider.createOrder(payload);
  }

  async getOrder(orderId) {
    const provider = this.getAvailableProvider();
    return provider.getOrder(orderId);
  }

  async cancelOrder(payload) {
    const provider = this.getAvailableProvider();
    return provider.cancelOrder(payload);
  }

  async editOrder(payload) {
    const provider = this.getAvailableProvider();
    return provider.editOrder(payload);
  }

  async listOrders(filters) {
    const provider = this.getAvailableProvider();
    return provider.listOrders(filters);
  }

  async getCourierInfo(orderId) {
    const provider = this.getAvailableProvider();
    return provider.getCourierInfo(orderId);
  }

  async getClientProfile() {
    const provider = this.getAvailableProvider();
    return provider.getClientProfile();
  }

  async getBankCards() {
    const provider = this.getAvailableProvider();
    return provider.getBankCards();
  }

  async getLabels(params) {
    const provider = this.getAvailableProvider();
    return provider.getLabels(params);
  }
}

module.exports = new ProviderRouter();
