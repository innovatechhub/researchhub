import { createSupabaseRestClient } from '../http/supabaseRestClient';

function toRepositoryError(error, fallbackMessage) {
  const responseMessage = error?.response?.data?.message;
  return new Error(responseMessage || error.message || fallbackMessage);
}

export async function listNotificationsRepository({ accessToken, userId }) {
  try {
    const restClient = createSupabaseRestClient(accessToken);
    const response = await restClient.get('/notifications', {
      params: {
        select: 'id,message,is_read,created_at,research_id',
        user_id: `eq.${userId}`,
        order: 'created_at.desc'
      }
    });

    return response.data ?? [];
  } catch (error) {
    throw toRepositoryError(error, 'Unable to load notifications.');
  }
}

export async function markNotificationAsReadRepository({ accessToken, notificationId }) {
  try {
    const restClient = createSupabaseRestClient(accessToken);
    const response = await restClient.patch(`/notifications?id=eq.${notificationId}`, {
      is_read: true
    });

    return response.data?.[0] ?? null;
  } catch (error) {
    throw toRepositoryError(error, 'Unable to update notification.');
  }
}
