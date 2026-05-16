import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';
import Reset from '../pages/Reset';

// Mock navigate
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({
      token: 'test-reset-token',
    }),
  };
});

// Mock AuthShell
vi.mock('../components/AuthShell', () => ({
  default: ({ children, title, subtitle }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

// Mock password strength
vi.mock('../utils/passwordStrength', () => ({
  getPasswordStrength: () => ({
    score: 4,
    label: 'Strong',
    color: 'bg-green-500',
    text: 'text-green-500',
  }),
}));

describe('Reset Password Page', () => {

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders reset password form', () => {

    render(
      <MemoryRouter>
        <Reset />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/set new password/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/^password$/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/confirm password/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: /update password/i,
      })
    ).toBeInTheDocument();
  });

  test('shows validation error when fields are empty', async () => {

    render(
      <MemoryRouter>
        <Reset />
      </MemoryRouter>
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /update password/i,
      })
    );

    expect(
      await screen.findByText(
        /please complete both password fields/i
      )
    ).toBeInTheDocument();
  });

  test('shows password mismatch error', async () => {

    render(
      <MemoryRouter>
        <Reset />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/^password$/i),
      {
        target: { value: 'password123' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/confirm password/i),
      {
        target: { value: 'wrongpassword' },
      }
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /update password/i,
      })
    );

    expect(
      await screen.findByText(/passwords do not match/i)
    ).toBeInTheDocument();
  });

  test('shows short password validation', async () => {

    render(
      <MemoryRouter>
        <Reset />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/^password$/i),
      {
        target: { value: '123' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/confirm password/i),
      {
        target: { value: '123' },
      }
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /update password/i,
      })
    );

    expect(
      await screen.findByText(
        /password must be at least 8 characters/i
      )
    ).toBeInTheDocument();
  });

  test('submits password reset successfully', async () => {

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Success',
      }),
    });

    render(
      <MemoryRouter>
        <Reset />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/^password$/i),
      {
        target: { value: 'password123' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/confirm password/i),
      {
        target: { value: 'password123' },
      }
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /update password/i,
      })
    );

    expect(
      await screen.findByText(
        /password changed\. redirecting to sign in/i
      )
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/reset-password/test-reset-token',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  test('shows backend error message', async () => {

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: 'Reset token expired',
      }),
    });

    render(
      <MemoryRouter>
        <Reset />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/^password$/i),
      {
        target: { value: 'password123' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/confirm password/i),
      {
        target: { value: 'password123' },
      }
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /update password/i,
      })
    );

    expect(
      await screen.findByText(/reset token expired/i)
    ).toBeInTheDocument();
  });

  test('toggles password visibility', () => {

    render(
      <MemoryRouter>
        <Reset />
      </MemoryRouter>
    );

    const passwordInput = screen.getByPlaceholderText(/^password$/i);

    const showButtons = screen.getAllByRole('button', {
      name: /show password/i,
    });

    expect(passwordInput.type).toBe('password');

    fireEvent.click(showButtons[0]);

    expect(passwordInput.type).toBe('text');
  });

  test('renders password strength indicator', () => {

    render(
      <MemoryRouter>
        <Reset />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/password strength: strong/i)
    ).toBeInTheDocument();
  });

});