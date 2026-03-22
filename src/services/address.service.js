const SavedAddress = require("../models/SavedAddress");

const getAddresses = async (userId) => {
  return await SavedAddress.find({ userId }).sort({ createdAt: -1 });
};

const createAddress = async (userId, data) => {
  const { name, phone, address, lat, lng } = data;

  if (!name || !phone || !address || !lat || !lng) {
    throw new Error("All required fields must be provided");
  }

  return await SavedAddress.create({
    ...data,
    userId,
  });
};

const deleteAddress = async (userId, id) => {
  return await SavedAddress.deleteOne({ _id: id, userId });
};

module.exports = {
  getAddresses,
  createAddress,
  deleteAddress,
};
