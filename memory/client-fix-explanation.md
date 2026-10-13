---
name: client-fix-explanation
description: Fix for client data disappearing after creation due to mock API overwriting real API implementations
metadata:
  type: reference
---

In frontend/lib/api.ts, when USE_MOCK=true, the API object was constructed with:
1. Explicitly defined client operations using real API (getClients, getClient, createClient, etc.)
2. Other operations using real API
3. `...mockApi` spread at the END

Since object spread properties come after explicit definitions, the mockApi versions of client operations were overwriting the real API versions, causing client operations to use mock data even when the intent was to use real API.

The fix was to reorder the API object construction:
1. `...mockApi` spread FIRST (provides mock implementations for all operations)
2. Explicitly defined client operations using real API (these overwrite the mock versions from mockApi)
3. Other operations using real API

This ensures client operations use real API while other operations can still use mock data as intended.