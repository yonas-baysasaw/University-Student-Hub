import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';
import Signup from '../pages/Signup';

// Mock navigate
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
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

// Mock safe redirect
vi.mock('../utils/safeRedirect', () => ({
  safeInternalPath: () => '/',
}));

describe('Signup Page', () => {

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders signup form', () => {

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/create account/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/username/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/email address/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/^password$/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/confirm password/i)
    ).toBeInTheDocument();
  });

  test('shows validation error for empty fields', async () => {

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /sign up/i,
      })
    );

    expect(
      await screen.findByText(/all fields are required/i)
    ).toBeInTheDocument();
  });

  test('shows password mismatch error', async () => {

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/username/i),
      {
        target: { value: 'john' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/email address/i),
      {
        target: { value: 'john@gmail.com' },
      }
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
        name: /sign up/i,
      })
    );

    expect(
      await screen.findByText(/passwords do not match/i)
    ).toBeInTheDocument();
  });

  test('shows short password error', async () => {

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/username/i),
      {
        target: { value: 'john' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/email address/i),
      {
        target: { value: 'john@gmail.com' },
      }
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
        name: /sign up/i,
      })
    );

    expect(
      await screen.findByText(
        /password must be at least 8 characters/i
      )
    ).toBeInTheDocument();
  });

  test('submits signup successfully', async () => {

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Success',
      }),
    });

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/username/i),
      {
        target: { value: 'john' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/email address/i),
      {
        target: { value: 'john@gmail.com' },
      }
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
        name: /sign up/i,
      })
    );

    expect(
      await screen.findByText(
        /account created\. redirecting to sign in/i
      )
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/register',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  test('shows backend error message', async () => {

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: 'Email already exists',
      }),
    });

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/username/i),
      {
        target: { value: 'john' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/email address/i),
      {
        target: { value: 'john@gmail.com' },
      }
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
        name: /sign up/i,
      })
    );

    expect(
      await screen.findByText(/email already exists/i)
    ).toBeInTheDocument();
  });

  test('toggles password visibility', () => {

    render(
      <MemoryRouter>
        <Signup />
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

  test('renders google auth button', () => {

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    const googleButton = screen.getByLabelText(
      /continue with google/i
    );

    expect(googleButton).toBeInTheDocument();

    expect(
      googleButton.getAttribute('href')
    ).toBe('/api/auth/google');
  });

});