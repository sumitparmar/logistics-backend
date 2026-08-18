const Joi = require("joi");

const phoneRule = Joi.string()
  .trim()
  .pattern(/^[0-9]{10}$/)
  .messages({
    "string.pattern.base": "Enter valid phone number",
  });

const registerSchema = Joi.object({
  name: Joi.string().min(2).required(),

  email: Joi.string().email().required(),

  phone: phoneRule.required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email(),
  password: Joi.string(),

  phone: phoneRule,
  otp: Joi.string().length(6),
}).or("email", "phone");

const sendOtpSchema = Joi.object({
  phone: phoneRule.required(),
  email: Joi.string().email().optional().allow("", null),
});

const verifyOtpSchema = Joi.object({
  phone: phoneRule.required(),
  otp: Joi.string().length(6).required(),
});

module.exports = {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
};
