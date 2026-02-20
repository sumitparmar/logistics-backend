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

/**
 * CREATE ORDER
 */
const createOrderSchema = Joi.object({
  matter: Joi.string().required(),

  customer: Joi.object({
    name: Joi.string().optional(),
    phone: Joi.string().required(),
  }).required(),

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
});

module.exports = {
  calculateOrderSchema,
  createOrderSchema,
};
