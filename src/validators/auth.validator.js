const Joi = require("joi");

const registerSchema = Joi.object({
  name: Joi.string().min(2).required(),

  email: Joi.string().email().required(),

  phone: Joi.string().min(8).required(),

  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email(),
  password: Joi.string(),

  phone: Joi.string().min(8),
  otp: Joi.string().length(6),
}).or("email", "phone");

const sendOtpSchema = Joi.object({
  phone: Joi.string().min(8).required(),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string().min(8).required(),
  otp: Joi.string().length(6).required(),
});

module.exports = {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
};
