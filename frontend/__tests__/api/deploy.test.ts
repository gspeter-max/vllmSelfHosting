import { describe, it, expect } from 'vitest'
import { deployRequestSchema } from '@/lib/validators'

/**
 * Tests that validate deploy API route arg-building logic.
 * We test indirectly via the validator since the route uses parsed.data
 * to build the shell command args.
 */
describe('Deploy API args (via validator)', () => {
    it('parsed data includes quantization when provided', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B',
            quantization: 'Q4_K_M',
            runMode: 'background',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.quantization).toBe('Q4_K_M')
            // Route would do: args.push('--quant', result.data.quantization)
        }
    })

    it('parsed data has undefined quantization when not provided', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.quantization).toBeUndefined()
            // Route would skip: if (quantization) { args.push(...) }
        }
    })

    it('rejects invalid quantization value with 400-worthy error', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B',
            quantization: 'Q16_FAKE',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const quantError = result.error.issues.find(
                (i) => i.path.includes('quantization'),
            )
            expect(quantError).toBeDefined()
        }
    })
})
