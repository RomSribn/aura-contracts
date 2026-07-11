import { z } from 'zod';

/**
 * FCM device registration (AURAF-0007-002: push when the app is
 * backgrounded). The token travels as the path param of
 * `PUT/DELETE /v1/devices/:token`; registration is an idempotent upsert
 * bound to the authenticated user.
 */
export const DeviceToken = z.string().min(1).max(512);
export type DeviceToken = z.infer<typeof DeviceToken>;

export const RegisterDeviceRequest = z.object({
  platform: z.enum(['ios', 'android']).optional(),
});
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceRequest>;
