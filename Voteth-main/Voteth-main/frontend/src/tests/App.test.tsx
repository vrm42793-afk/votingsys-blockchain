import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { App } from '../app/App'

describe('App', () => {
  it('renders without crashing', () => {
    const { getAllByText } = render(<App />)
    const elements = getAllByText(/VotEth 2.0/i)
    expect(elements.length).toBeGreaterThan(0)
  })
})
