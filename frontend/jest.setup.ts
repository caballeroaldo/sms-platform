import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch for API calls in tests
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Mock auth token for tests
const mockToken = 'mock-jwt-token';
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn().mockImplementation((key) => {
      if (key === 'token') return mockToken;
      return null;
    }),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
});

// Mock fetch implementations
beforeEach(() => {
  mockFetch.mockClear();
  mockFetch.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
    // Convert RequestInfo to string for checking
    const requestUrl = typeof url === 'string' ? url : (url as any).href || '';
    const body = init && init.body ? JSON.parse(init.body as string) : null;

    // Handle login endpoint
    if (requestUrl.endsWith('/auth/login')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { token: mockToken, user: { email: 'admin@example.com' } },
          }),
      });
    }

    // Handle send-message endpoint
    if (requestUrl.endsWith('/messages/send-now')) {
      // Count clientIds to determine sent count
      const clientIds = body?.clientIds || [];
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { sent: clientIds.length, failed: 0 },
          }),
      });
    }

    // Handle getDashboardStats endpoint
    if (requestUrl.endsWith('/dashboard/stats')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              totalClients: 3,
              totalTemplates: 2,
              totalCampaigns: 2,
              totalMessages: 10,
            },
          }),
      });
    }

    // Handle getClients endpoint
    if (requestUrl.endsWith('/clients')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              clients: [
                { id: 'cl-1', firstName: 'John', lastName: 'Doe', phone: '+15005550006' },
                { id: 'cl-2', firstName: 'Jane', lastName: 'Smith', phone: '+15005550007' },
                { id: 'cl-3', firstName: 'Bob', lastName: 'Johnson', phone: '+15005550008' },
              ],
            },
          }),
      });
    }

    // Handle getTemplates endpoint
    if (requestUrl.endsWith('/templates')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              { id: 'tpl-1', name: 'Welcome Message', content: 'Hello {{name}}!', category: 'NOTIFICATION' },
              { id: 'tpl-2', name: 'Promotional Offer', content: 'Special discount for {{name}}!', category: 'PROMOTIONAL' },
            ],
          }),
      });
    }

    // Handle getCampaigns endpoint
    if (requestUrl.endsWith('/campaigns')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              campaigns: [
                { id: 'camp-1', name: 'Summer Welcome Series', templateId: 'tpl-1' },
                { id: 'camp-2', name: 'Holiday Promo', templateId: 'tpl-2' },
              ],
            },
          }),
      });
    }

    // Handle getMessages endpoint
    if (requestUrl.endsWith('/messages')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              messages: [
                { id: 'msg-1', content: 'Hello', direction: 'outbound', clientId: 'cl-1' },
                { id: 'msg-2', content: 'Hi there!', direction: 'inbound', clientId: 'cl-1' },
              ],
            },
          }),
      });
    }

    // Default response for other endpoints
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {},
        }),
    });
  });
});