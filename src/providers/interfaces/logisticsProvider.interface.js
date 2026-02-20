class LogisticsProvider {
  async calculatePrice(payload) {
    throw new Error("calculatePrice() not implemented");
  }

  async createOrder(payload) {
    throw new Error("createOrder() not implemented");
  }

  async getOrder(orderId) {
    throw new Error("getOrder() not implemented");
  }

  async cancelOrder(orderId) {
    throw new Error("cancelOrder() not implemented");
  }

  async healthCheck() {
    throw new Error("healthCheck() not implemented");
  }
}

module.exports = LogisticsProvider;
