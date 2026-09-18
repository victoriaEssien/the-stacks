import { env } from '@/config/env';

/** The localStorage key a collection lives under. */
export const storageKey = (name: string) => `${env.storageNamespace}:${name}:v1`;
