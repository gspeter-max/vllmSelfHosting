import { z } from 'zod'

// ============================================================
// Zod schemas for input validation
// ============================================================

/**
 * Model name validation — prevents command injection.
 * Allows: alphanumeric, hyphens, underscores, dots, slashes, colons
 * Blocks: semicolons, pipes, backticks, $(), etc.
 */
const modelNameSchema = z
    .string()
    .min(1, 'Model name is required')
    .max(200, 'Model name is too long')
    .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9._\-/:]*$/,
        'Model name contains invalid characters. Only alphanumeric, dots, hyphens, underscores, slashes, and colons are allowed.'
    )

/** Deploy request validation */
export const deployRequestSchema = z
    .object({
        mode: z.enum(['cpu', 'gpu'], {
            message: 'Mode must be "cpu" or "gpu"',
        }),
        model: modelNameSchema,
        quantization: z.enum(['Q2_K', 'Q3_K_M', 'Q4_0', 'Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0']).optional(),
        runMode: z.enum(['background', 'foreground']).optional().default('background'),
        gpuSlot: z.union([z.literal(0), z.literal(1)]).optional(),
    })
    .refine(
        (data) => {
            if (data.mode === 'gpu' && data.gpuSlot === undefined) {
                return false
            }
            return true
        },
        { message: 'GPU slot is required for GPU deployments', path: ['gpuSlot'] }
    )

/** Chat request validation */
export const chatRequestSchema = z.object({
    model: modelNameSchema,
    mode: z.enum(['cpu', 'gpu']).optional().default('cpu'),
    apiUrl: z.string().optional(),
    message: z.string().min(1, 'Message cannot be empty'),
    conversationHistory: z
        .array(
            z.object({
                role: z.enum(['user', 'assistant', 'system']),
                content: z.string(),
            })
        )
        .optional()
        .default([]),
})

/** Model name parameter validation */
export const modelNameParamSchema = z.object({
    name: modelNameSchema,
})

/** Type exports derived from schemas */
export type DeployRequestInput = z.input<typeof deployRequestSchema>
export type ChatRequestInput = z.input<typeof chatRequestSchema>
