const providerRouter = require("../providers/router/providerRouter");
const { pushToDLQ } = require("../utils/dlqWriter");

class PulseService {
  async calculateOrder(payload) {
    try {
      return await providerRouter.calculatePrice(payload);
    } catch (err) {
      await pushToDLQ({
        type: "CALCULATE_ORDER",
        payload,
        error: err.message,
      });
      throw err;
    }
  }

  async createOrder(payload) {
    try {
      return await providerRouter.createOrder(payload);
    } catch (err) {
      await pushToDLQ({
        type: "CREATE_ORDER",
        payload,
        error: err.message,
      });
      throw err;
    }
  }

  async cancelOrder(payload) {
    try {
      return await providerRouter.cancelOrder(payload);
    } catch (err) {
      await pushToDLQ({
        type: "CANCEL_ORDER",
        payload,
        error: err.message,
      });
      throw err;
    }
  }

  async getOrder(orderId) {
    try {
      return await providerRouter.getOrder(orderId);
    } catch (err) {
      await pushToDLQ({
        type: "GET_ORDER",
        payload: { orderId },
        error: err.message,
      });
      throw err;
    }
  }

  async editOrder(payload) {
    try {
      return await providerRouter.editOrder(payload);
    } catch (err) {
      await pushToDLQ({
        type: "EDIT_ORDER",
        payload,
        error: err.message,
      });
      throw err;
    }
  }

  async listProviderOrders(filters) {
    try {
      return await providerRouter.listOrders(filters);
    } catch (err) {
      await pushToDLQ({
        type: "LIST_ORDERS",
        payload: filters,
        error: err.message,
      });
      throw err;
    }
  }

  async getProviderOrder(orderId) {
    try {
      return await providerRouter.getOrder(orderId);
    } catch (err) {
      await pushToDLQ({
        type: "GET_PROVIDER_ORDER",
        payload: { orderId },
        error: err.message,
      });
      throw err;
    }
  }

  async getCourierInfo(orderId) {
    try {
      return await providerRouter.getCourierInfo(orderId);
    } catch (err) {
      await pushToDLQ({
        type: "GET_COURIER_INFO",
        payload: { orderId },
        error: err.message,
      });
      throw err;
    }
  }

  async getClientProfile() {
    try {
      return await providerRouter.getClientProfile();
    } catch (err) {
      await pushToDLQ({
        type: "GET_CLIENT_PROFILE",
        payload: {},
        error: err.message,
      });
      throw err;
    }
  }

  async getBankCards() {
    try {
      return await providerRouter.getBankCards();
    } catch (err) {
      await pushToDLQ({
        type: "GET_BANK_CARDS",
        payload: {},
        error: err.message,
      });
      throw err;
    }
  }
}

module.exports = new PulseService();
