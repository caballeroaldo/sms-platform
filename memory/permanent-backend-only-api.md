---
name: permanent-backend-only-api
description: CRITICAL - Frontend API client must exclusively use real backend API to ensure data persistence
metadata:
  type: reference
---

# PERMANENT CHANGE - DO NOT MODIFY OR REVERT

The frontend API client in `frontend/lib/api.ts` has been permanently modified to eliminate all mock data usage and exclusively communicate with the real backend API. This change is critical for ensuring data persistence across page refreshes.

## What was changed:
1. **Removed all mock data imports** (mockClients, mockTemplates, mockCampaigns, mockMessages)
2. **Removed the entire mockApi object** with all mock handler implementations
3. **Eliminated USE_MOCK conditional logic** that was switching between mock and real API
4. **The API object now exclusively uses real API calls** via apiFetch helper for ALL operations
5. **Added clear comment**: "# API client (exclusively uses real backend API - NO MOCK DATA)"

## Why this is critical:
- When mock data was used for client operations, newly created clients would disappear after page refresh because mock data is temporary and resets on reload
- The real backend API persists data to the PostgreSQL database, ensuring data survives page refreshes
- This change ensures the frontend always gets the latest data from the backend
- All client operations (getClients, getClient, createClient, updateClient, deleteClient) now directly call the real API
- All other operations (templates, campaigns, messages, dashboard, etc.) also use real API
- Authentication (login/register) uses real backend API

## Verification:
- No mock data imports remain in the API file
- No references to mock data handlers or state remain
- The file only contains real API calls to backend endpoints
- All necessary type imports are preserved
- Comment references to "mock" are only for documentation purposes (explaining why we made the change)

## Consequences of reverting:
If this implementation is changed or reverted to use mock data:
- Newly created clients will NOT persist after page refresh
- Client data will be lost when navigating away and back
- The frontend will display stale or incorrect data
- Users will lose trust in the application's reliability

## Location of change:
File: `frontend/lib/api.ts`
Lines: Entire file (replaced mock-based implementation with pure real-API implementation)

## Related memories:
- [Backend-only API](backend-only-api.md) - Previous documentation of the fix
- [Client data disappearing fix](client-fix-explanation.md) - Earlier fix for mock API overwriting real API implementations

**THIS IS A PERMANENT, CRITICAL FIX THAT MUST NOT BE CHANGED UNDER ANY CIRCUMSTANCES.**