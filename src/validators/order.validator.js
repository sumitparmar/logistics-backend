const Joi = require("joi");

/**
 * CALCULATE ORDER
 */
const calculateOrderSchema = Joi.object({
  matter: Joi.string().required(),

  pickup: Joi.object({
    address: Joi.string().required(),
  }).required(),

  drop: Joi.object({
    address: Joi.string().required(),
  }).required(),
});

const createOrderSchema = Joi.object({
  // existing
  matter: Joi.string().required(),
  declaredValue: Joi.number().min(0).optional(),
  vehicleTypeId: Joi.number().required(),

  // NEW
  deliveryType: Joi.string()
    .valid("NOW", "END_OF_DAY", "SCHEDULED")
    .default("NOW"),

  scheduledAt: Joi.string().when("deliveryType", {
    is: "SCHEDULED",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  customer: Joi.object({
    name: Joi.string().optional(),
    phone: Joi.string().required(),
  }).required(),

  // Backward compatible
  pickup: Joi.object({
    address: Joi.string().required(),
    lat: Joi.number().optional(),
    lng: Joi.number().optional(),
  }).optional(),

  drop: Joi.object({
    address: Joi.string().required(),
    lat: Joi.number().optional(),
    lng: Joi.number().optional(),
  }).optional(),

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
    method: Joi.string().valid("CASH", "CARD", "WALLET").default("CASH"),
    feePayer: Joi.string().valid("PICKUP", "DROP").default("DROP"),
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
