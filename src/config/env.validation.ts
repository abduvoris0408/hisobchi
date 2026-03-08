// src/config/env.validation.ts
import * as Joi from 'joi'

export const envValidationSchema = Joi.object({
	// App
	NODE_ENV: Joi.string()
		.valid('development', 'production', 'test')
		.default('development'),
	PORT: Joi.number().default(3000),
	ALLOWED_ORIGINS: Joi.string().default('http://localhost:3001'),

	// Database
	DATABASE_URL: Joi.string().required().messages({
		'any.required': '❌ DATABASE_URL talab qilinadi!',
	}),
	SUPABASE_URL: Joi.string().uri().required().messages({
		'any.required': '❌ SUPABASE_URL talab qilinadi!',
	}),
	SUPABASE_ANON_KEY: Joi.string().required(),
	SUPABASE_SERVICE_KEY: Joi.string().required(),

	// JWT
	JWT_ACCESS_SECRET: Joi.string().min(32).required(),
	JWT_REFRESH_SECRET: Joi.string().min(32).required(),
	JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
	JWT_REFRESH_EXPIRES: Joi.string().default('30d'),

	// Redis
	REDIS_URL: Joi.string().required().messages({
		'any.required': '❌ REDIS_URL talab qilinadi!',
	}),

	// Ixtiyoriy
	ESKIZ_EMAIL: Joi.string().email().optional().allow(''),
	ESKIZ_PASSWORD: Joi.string().optional().allow(''),
	ESKIZ_FROM: Joi.string().default('4546'),

	FIREBASE_PROJECT_ID: Joi.string().optional().allow(''),
	FIREBASE_PRIVATE_KEY: Joi.string().optional().allow(''),
	FIREBASE_CLIENT_EMAIL: Joi.string().optional().allow(''),

	TELEGRAM_BOT_TOKEN: Joi.string().optional().allow(''),
	TELEGRAM_WEBHOOK_URL: Joi.string().uri().optional().allow(''),
})
