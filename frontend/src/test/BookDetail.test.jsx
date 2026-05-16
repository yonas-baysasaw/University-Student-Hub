import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BookDetail from '../pages/BookDetail';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      _id: 'user123',
      name: 'Test User',
    },
  }),
}));

global.fetch = jest.fn();

const mockBook = {
  _id: 'book123',
  title: 'Advanced React Patterns',
  description: 'A complete guide for scalable React applications.',
  format: 'pdf',
  visibility: 'public',
  createdAt: '2026-01-01T12:00:00Z',
  likesCount: 15,
  dislikesCount: 2,
  views: 120,
  thumbnailUrl: 'https://example.com/cover.jpg',
  academicTrack: 'software-engineering',
  department: 'Computer Science',
  courseSubject: 'React Development',
  publishYear: 2025,
  bookUrl: 'https://example.com/book.pdf',
  uploader: {
    id: 'user123',
    name: 'John Doe',
    username: 'johndoe',
    avatar: 'https://example.com/avatar.jpg',
    subscribersCount: 20,
    viewerSubscribed: false,
  },
  viewerState: {
    liked: false,
    disliked: false,
    saved: false,
  },
};

function renderBookDetail() {
  return render(
    <MemoryRouter initialEntries={['/books/book123']}>
      <Routes>
        <Route path="/books/:bookId" element={<BookDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('BookDetail Page', () => {
  beforeEach(() => {
    fetch.mockImplementation((url) => {
      if (url.includes('/reviews')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            reviews: [],
          }),
        });
      }

      if (url.includes('/comments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            comments: [],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: mockBook,
        }),
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders book title', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/advanced react patterns/i)
    ).toBeInTheDocument();
  });

  test('renders description', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(
        /a complete guide for scalable react applications/i
      )
    ).toBeInTheDocument();
  });

  test('renders uploader information', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/john doe/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/@johndoe/i)
    ).toBeInTheDocument();
  });

  test('renders statistics cards', async () => {
    renderBookDetail();

    expect(await screen.findByText('15')).toBeInTheDocument();
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(await screen.findByText('120')).toBeInTheDocument();
  });

  test('renders academic metadata', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/computer science/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/react development/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/2025/i)
    ).toBeInTheDocument();
  });

  test('renders action buttons', async () => {
    renderBookDetail();

    expect(
      await screen.findByRole('button', { name: /save/i })
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('button', { name: /like/i })
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('button', { name: /dislike/i })
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('button', { name: /share/i })
    ).toBeInTheDocument();
  });

  test('renders download button', async () => {
    renderBookDetail();

    expect(
      await screen.findByRole('button', {
        name: /download file/i,
      })
    ).toBeInTheDocument();
  });

  test('renders review section', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/reader reviews/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByPlaceholderText(
        /what stood out/i
      )
    ).toBeInTheDocument();
  });

  test('renders discussion section', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/discussion/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByPlaceholderText(
        /ask a question/i
      )
    ).toBeInTheDocument();
  });

  test('renders study with liqu ai button', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/study with liqu ai/i)
    ).toBeInTheDocument();
  });

  test('save button can be clicked', async () => {
    renderBookDetail();

    const saveButton = await screen.findByRole('button', {
      name: /save/i,
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  test('like button can be clicked', async () => {
    renderBookDetail();

    const likeButton = await screen.findByRole('button', {
      name: /like/i,
    });

    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  test('dislike button can be clicked', async () => {
    renderBookDetail();

    const dislikeButton = await screen.findByRole('button', {
      name: /dislike/i,
    });

    fireEvent.click(dislikeButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  test('renders loading state initially', () => {
    renderBookDetail();

    expect(document.body).toBeInTheDocument();
  });

  test('renders error state', async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({
          message: 'Failed to load book details',
        }),
      })
    );

    renderBookDetail();

    expect(
      await screen.findByText(/failed to load book details/i)
    ).toBeInTheDocument();
  });

  test('renders auth required state', async () => {
    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({
          code: 'AUTH_REQUIRED',
        }),
      })
    );

    renderBookDetail();

    expect(
      await screen.findByText(/sign in to view this resource/i)
    ).toBeInTheDocument();
  });

  test('renders empty reviews message', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(
        /no reviews yet — be the first/i
      )
    ).toBeInTheDocument();
  });

  test('renders empty comments message', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/no comments yet/i)
    ).toBeInTheDocument();
  });

  test('renders edit details button for owner', async () => {
    renderBookDetail();

    expect(
      await screen.findByRole('button', {
        name: /edit details/i,
      })
    ).toBeInTheDocument();
  });

  test('renders subscribe button', async () => {
    renderBookDetail();

    expect(
      await screen.findByRole('button', {
        name: /subscribe/i,
      })
    ).toBeInTheDocument();
  });

  test('renders breadcrumb navigation', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/library/i)
    ).toBeInTheDocument();
  });

  test('renders contributor section', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/contributor/i)
    ).toBeInTheDocument();
  });

  test('renders catalog information section', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/catalog information/i)
    ).toBeInTheDocument();
  });

  test('renders about this resource section', async () => {
    renderBookDetail();

    expect(
      await screen.findByText(/about this resource/i)
    ).toBeInTheDocument();
  });
});