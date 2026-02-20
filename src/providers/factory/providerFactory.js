const { BORZO } = require("../../constants");
const env = require("../../config/env");
const BorzoProvider = require("../borzo/borzo.provider");

function getProvider() {
  switch (env.DEFAULT_PROVIDER) {
    case BORZO:
      return new BorzoProvider();

    default:
      throw new Error("Unsupported logistics provider");
  }
}

module.exports = { getProvider };
