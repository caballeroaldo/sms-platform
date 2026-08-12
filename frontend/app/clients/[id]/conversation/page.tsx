import { redirect } from 'next/navigation';

/**
 * Legacy single-client conversation route — now a redirect to the inbox.
 *
 * Originally rendered <ConversationThread> with a "back to Clients" affordance.
 * Messaging now lives in the split-pane inbox at /messages, so the Clients-list
 * "Message" button (and any external deep link to /clients/<id>/conversation)
 * lands on /messages?client=<id>, opening that client's thread in the inbox's
 * right pane. The inbox owns its own auth guard (useRequireAuth inside
 * <InboxInner>), so unauthenticated hits bounce there rather than here.
 *
 * Kept as a redirect (not deleted) so existing deep links / bookmarks keep
 * resolving. Server component → `redirect()` from next/navigation (307), called
 * outside any try/catch (it throws; Next catches it). params is a Promise in
 * Next 16 dynamic routes, hence `await params`.
 */

interface ConversationPageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { id } = await params;
  redirect(`/messages?client=${encodeURIComponent(id)}`);
}
