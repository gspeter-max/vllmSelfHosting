import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptDialog } from '@/components/deploy/prompt-dialog'
import type { PendingPrompt } from '@/components/deploy/prompt-dialog'

describe('PromptDialog', () => {
    const onSend = vi.fn()
    const onDismiss = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not render when prompt is null', () => {
        const { container } = render(
            <PromptDialog prompt={null} onSend={onSend} onDismiss={onDismiss} />,
        )
        expect(container.innerHTML).toBe('')
    })

    it('renders confirm dialog with Yes/No for confirm-yes type', () => {
        const prompt: PendingPrompt = {
            type: 'confirm-yes',
            message: 'Do you want to proceed?',
            rawLine: 'Proceed? [Y/n]',
        }
        render(<PromptDialog prompt={prompt} onSend={onSend} onDismiss={onDismiss} />)

        expect(screen.getByText('Do you want to proceed?')).toBeInTheDocument()
        expect(screen.getByText('Yes')).toBeInTheDocument()
        expect(screen.getByText('No')).toBeInTheDocument()
    })

    it('sends "y" when Yes is clicked for confirm-yes', async () => {
        const prompt: PendingPrompt = {
            type: 'confirm-yes',
            message: 'Proceed?',
            rawLine: 'Proceed? [Y/n]',
        }
        render(<PromptDialog prompt={prompt} onSend={onSend} onDismiss={onDismiss} />)

        await userEvent.click(screen.getByText('Yes'))
        expect(onSend).toHaveBeenCalledWith('y')
    })

    it('sends "n" when No is clicked for confirm-yes', async () => {
        const prompt: PendingPrompt = {
            type: 'confirm-yes',
            message: 'Proceed?',
            rawLine: 'Proceed? [Y/n]',
        }
        render(<PromptDialog prompt={prompt} onSend={onSend} onDismiss={onDismiss} />)

        await userEvent.click(screen.getByText('No'))
        expect(onSend).toHaveBeenCalledWith('n')
    })

    it('renders warning dialog for confirm-no type', () => {
        const prompt: PendingPrompt = {
            type: 'confirm-no',
            message: 'RAM usage high. Continue?',
            rawLine: 'Continue anyway? [y/N]',
        }
        render(<PromptDialog prompt={prompt} onSend={onSend} onDismiss={onDismiss} />)

        expect(screen.getByText('RAM usage high. Continue?')).toBeInTheDocument()
    })

    it('renders danger dialog with text input for danger-confirm', () => {
        const prompt: PendingPrompt = {
            type: 'danger-confirm',
            message: 'Type CONFIRM to proceed.',
            rawLine: 'Type CONFIRM to proceed',
        }
        render(<PromptDialog prompt={prompt} onSend={onSend} onDismiss={onDismiss} />)

        expect(screen.getByText('Type CONFIRM to proceed.')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Type CONFIRM to proceed')).toBeInTheDocument()
        // Confirm button should be disabled until "CONFIRM" is typed
        expect(screen.getByText('Confirm')).toBeDisabled()
    })

    it('enables confirm button when CONFIRM is typed for danger-confirm', async () => {
        const prompt: PendingPrompt = {
            type: 'danger-confirm',
            message: 'Critical action.',
            rawLine: 'Type CONFIRM to proceed',
        }
        render(<PromptDialog prompt={prompt} onSend={onSend} onDismiss={onDismiss} />)

        const input = screen.getByPlaceholderText('Type CONFIRM to proceed')
        await userEvent.type(input, 'CONFIRM')
        expect(screen.getByText('Confirm')).toBeEnabled()
    })

    it('renders text-input type with Submit/Cancel buttons', () => {
        const prompt: PendingPrompt = {
            type: 'text-input',
            message: 'Enter parameter count:',
            rawLine: 'Enter the parameter count in billions',
        }
        render(<PromptDialog prompt={prompt} onSend={onSend} onDismiss={onDismiss} />)

        expect(screen.getByText('Enter parameter count:')).toBeInTheDocument()
        expect(screen.getByText('Submit')).toBeInTheDocument()
        expect(screen.getByText('Cancel')).toBeInTheDocument()
        // Submit should be disabled with empty input
        expect(screen.getByText('Submit')).toBeDisabled()
    })

    it('sends text value for text-input type', async () => {
        const prompt: PendingPrompt = {
            type: 'text-input',
            message: 'Enter value:',
            rawLine: 'Enter the parameter count in billions',
        }
        render(<PromptDialog prompt={prompt} onSend={onSend} onDismiss={onDismiss} />)

        const input = screen.getByPlaceholderText('Enter value...')
        await userEvent.type(input, '7')
        await userEvent.click(screen.getByText('Submit'))
        expect(onSend).toHaveBeenCalledWith('7')
    })

    it('calls onDismiss when Cancel is clicked for text-input', async () => {
        const prompt: PendingPrompt = {
            type: 'text-input',
            message: 'Enter:',
            rawLine: 'Enter the parameter count in billions',
        }
        render(<PromptDialog prompt={prompt} onSend={onSend} onDismiss={onDismiss} />)

        await userEvent.click(screen.getByText('Cancel'))
        expect(onDismiss).toHaveBeenCalled()
    })
})
