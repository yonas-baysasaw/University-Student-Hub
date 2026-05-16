import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import About from '../pages/About';

describe('About Page', () => {

  test('renders main heading', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/a professional digital campus experience/i)
    ).toBeInTheDocument();
  });

  test('renders description text', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    );

    expect(
      screen.getByText(
        /organize your student life/i
      )
    ).toBeInTheDocument();
  });

  test('renders feature cards', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/one academic workspace/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/secure and reliable/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/designed for momentum/i)
    ).toBeInTheDocument();
  });

  test('renders statistics section', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/24\/7/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/1 hub/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/100%/i)
    ).toBeInTheDocument();
  });

  test('renders navigation buttons', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    );

    const signupButton = screen.getByRole('link', {
      name: /create account/i,
    });

    const signinButton = screen.getByRole('link', {
      name: /sign in/i,
    });

    expect(signupButton).toBeInTheDocument();
    expect(signinButton).toBeInTheDocument();

    expect(signupButton.getAttribute('href')).toBe('/signup');
    expect(signinButton.getAttribute('href')).toBe('/login');
  });

  test('renders all feature descriptions', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/track classes, updacd tes, and resources/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/built around authenticated sessions/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/fast interactions, clear layouts/i)
    ).toBeInTheDocument();
  });

});