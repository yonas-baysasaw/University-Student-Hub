import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignIn from '../pages/SignIn';

// Mock safe redirect
jest.mock('../utils/safeRedirect', () => ({
  safeInternalPath: jest.fn(() => '/'),
}));

// Mock AuthShell
jest.mock('../components/AuthShell', () => {
  return ({ children, title, subtitle }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  );
});

describe('SignIn Page', () => {

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders login form correctly', () => {
    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>
    );

    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/example@university.edu/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/enter your password/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  test('shows validation error when fields are empty', async () => {
    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>
    );

    const button = screen.getByRole('button', {
      name: /sign in/i,
    });

    fireEvent.click(button);

    expect(
      await screen.findByText(
        /enter your username\/email and password/i
      )
    ).toBeInTheDocument();
  });

  test('submits login successfully', async () => {

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Success',
      }),
    });

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/example@university.edu/i),
      {
        target: { value: 'test@gmail.com' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/enter your password/i),
      {
        target: { value: '123456' },
      }
    );

    fireEvent.click(
      screen.getByRole('button', { name: /sign in/i })
    );

    expect(
      await screen.findByText(/signed in successfully/i)
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  test('shows server error on failed login', async () => {

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: 'Invalid credentials',
      }),
    });

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/example@university.edu/i),
      {
        target: { value: 'wrong@gmail.com' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/enter your password/i),
      {
        target: { value: 'wrongpass' },
      }
    );

    fireEvent.click(
      screen.getByRole('button', { name: /sign in/i })
    );

    expect(
      await screen.findByText(/invalid credentials/i)
    ).toBeInTheDocument();
  });

  test('disables button while loading', async () => {

    global.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({}),
              }),
            100
          )
        )
    );

    render(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText(/example@university.edu/i),
      {
        target: { value: 'test@gmail.com' },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/enter your password/i),
      {
        target: { value: '123456' },
      }
    );

    fireEvent.click(
      screen.getByRole('button', { name: /sign in/i })
    );

    expect(
      screen.getByRole('button', {
        name: /signing in/i,
      })
    ).toBeDisabled();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

});