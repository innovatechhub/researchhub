import {
  listNotificationsRepository,
  markNotificationAsReadRepository
} from '../../infrastructure/repositories/notificationRepository';

export async function listNotificationsUseCase({ accessToken, userId }) {
  return listNotificationsRepository({ accessToken, userId });
}

export async function markNotificationAsReadUseCase({ accessToken, notificationId }) {
  return markNotificationAsReadRepository({ accessToken, notificationId });
}
