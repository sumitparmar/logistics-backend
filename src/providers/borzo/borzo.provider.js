const LogisticsProvider = require("../interfaces/logisticsProvider.interface");
const client = require("./borzo.http");

class BorzoProvider extends LogisticsProvider {
  async calculatePrice(payload) {
    return client.post("/calculate-order", payload);
  }

  // async createOrder(payload) {
  //   return client.post("/create-order", payload);
  // }

  async createOrder(payload) {
    return client.post("/create-order", payload);
  }

  async getOrder(orderId) {
    if (!orderId) {
      throw new Error("Order ID is required");
    }
    return client.get("/orders", {
      params: {
        order_id: Number(orderId),
      },
    });
  }

  async cancelOrder(payload) {
    return client.post("/cancel-order", payload);
  }

  async editOrder(payload) {
    return client.post("/edit-order", payload);
  }

  async listOrders(filters = {}) {
    return client.get("/orders", { params: filters });
  }

  async healthCheck() {
    return client.post("/calculate-order", {
      matter: "health_check",
      points: [
        { address: process.env.HEALTH_PICKUP_ADDRESS },
        { address: process.env.HEALTH_DROP_ADDRESS },
      ],
    });
  }

  async getCourierInfo(orderId) {
    if (!orderId) {
      throw new Error("Order ID is required");
    }
    return client.get("/courier", {
      params: {
        order_id: Number(orderId),
      },
    });
  }

  async getClientProfile() {
    return client.get("/client");
  }

  async getBankCards() {
    return client.get("/bank-cards");
  }

  async getLabels(params) {
    return client.get("/labels", { params });
  }

  async getVehicleTypes(params = {}) {
    return client.get("/vehicles", { params });
  }
}

module.exports = BorzoProvider;
