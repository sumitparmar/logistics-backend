const Joi = require("joi");

/**
 * CALCULATE ORDER
 */
const calculateOrderSchema = Joi.object({
  matter: Joi.string().required(),
  vehicleTypeId: Joi.number().optional(),
  vehicleType: Joi.number().optional(),

  deliveryType: Joi.string()
    .valid("NOW", "EOD", "END_OF_DAY", "SCHEDULED")
    .default("NOW"),

  scheduledAt: Joi.string().when("deliveryType", {
    is: "SCHEDULED",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  pickup: Joi.object({
    address: Joi.string().required(),
    lat: Joi.number().optional(),
    lng: Joi.number().optional(),
  }).required(),

  drop: Joi.object({
    address: Joi.string().required(),
    lat: Joi.number().optional(),
    lng: Joi.number().optional(),
  }).required(),

  stops: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().valid("PICKUP", "DROP").required(),
        address: Joi.string().required(),
        lat: Joi.number().optional(),
        lng: Joi.number().optional(),
        name: Joi.string().optional(),
        phone: Joi.string().optional(),
        notes: Joi.string().allow("", null).optional(),
      }),
    )
    .optional(),

  package: Joi.object({
    weight: Joi.number().min(0).optional(),
    category: Joi.string().optional(),
    description: Joi.string().optional(),
    declaredValue: Joi.number().min(0).optional(),
  }).optional(),

  payment: Joi.object({
    method: Joi.string()
      .valid("CASH", "BANK_CARD", "CARD", "WALLET", "BALANCE")
      .default("CASH"),
    bankCardId: Joi.number().optional(),
    bank_card_id: Joi.number().optional(),
  }).optional(),
});

const createOrderSchema = Joi.object({
  // existing
  matter: Joi.string().required(),
  declaredValue: Joi.number().min(0).optional(),
  vehicleTypeId: Joi.number().when("deliveryType", {
    is: Joi.valid("EOD", "END_OF_DAY"),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),

  // NEW
  deliveryType: Joi.string()
    .valid("NOW", "EOD", "END_OF_DAY", "SCHEDULED")
    .default("NOW"),

  scheduledAt: Joi.string().when("deliveryType", {
    is: "SCHEDULED",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  customer: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().optional(),
  }).required(),

  // Backward compatible
  pickup: Joi.object({
    address: Joi.string().required(),
    lat: Joi.number().required(),
    lng: Joi.number().required(),
  }).required(),

  drop: Joi.object({
    address: Joi.string().required(),
    lat: Joi.number().required(),
    lng: Joi.number().required(),
  }).required(),

  // NEW preferred structure
  stops: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().valid("PICKUP", "DROP").required(),
        address: Joi.string().required(),
        lat: Joi.number().optional(),
        lng: Joi.number().optional(),
        building: Joi.string().optional(),
        floor: Joi.string().optional(),
        unit: Joi.string().optional(),
        instructions: Joi.string().optional(),
        name: Joi.string().optional(),
        phone: Joi.string().required(),
      }),
    )
    .optional(),

  package: Joi.object({
    weight: Joi.number().required(),
    category: Joi.string().optional(),
    description: Joi.string().optional(),
    declaredValue: Joi.number().min(0).optional(),
  }).optional(),

  payment: Joi.object({
    method: Joi.string()
      .valid("CASH", "BANK_CARD", "CARD", "WALLET", "BALANCE")
      .default("CASH"),
    feePayer: Joi.string().valid("PICKUP", "DROP").default("DROP"),
    bankCardId: Joi.number().optional(),
    bank_card_id: Joi.number().optional(),
    intentId: Joi.string().optional(),
  }).optional(),

  // existing
  cod: Joi.object({
    amount: Joi.number().positive().required(),
  }).optional(),
});

module.exports = {
  calculateOrderSchema,
  createOrderSchema,
};
