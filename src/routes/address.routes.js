const express = require("express");
const router = express.Router();

const addressService = require("../services/address.service");

// GET
router.get("/", async (req, res) => {
  try {
    const data = await addressService.getAddresses(req.user._id);
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to load saved addresses." });
  }
});

// POST
router.post("/", async (req, res) => {
  try {
    const data = await addressService.createAddress(req.user._id, req.body);

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: "Please check the address details and try again." });
  }
});
// DELETE
router.delete("/:id", async (req, res) => {
  try {
    await addressService.deleteAddress(req.user._id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Unable to remove this address." });
  }
});

module.exports = router;
