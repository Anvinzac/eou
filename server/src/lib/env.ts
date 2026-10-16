import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../.env') });
dotenv.config({ path: path.resolve(here, '../../.env') });
dotenv.config();

function trimSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 3001),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:8080',
  supabaseUrl: required('SUPABASE_URL', process.env.VITE_SUPABASE_URL),
  supabaseAnonKey: required(
    'SUPABASE_ANON_KEY',
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  ),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  qwenApiKey: process.env.QWEN_API_KEY || process.env.VITE_QWEN_API_KEY || '',
  qwenApiBase:
    process.env.QWEN_API_BASE ||
    process.env.VITE_QWEN_API_BASE ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
  qwenModel: process.env.QWEN_MODEL || process.env.VITE_QWEN_MODEL || 'qwen-plus',
  isProduction: process.env.NODE_ENV === 'production',
  /** Public origin that serves /s/:code and /og/*, e.g. https://api.example.com. */
  shareBaseUrl: trimSlash(process.env.SHARE_BASE_URL || ''),
  /** Public origin of the web app that short links redirect to. */
  appPublicUrl: trimSlash(process.env.APP_PUBLIC_URL || process.env.CLIENT_ORIGIN || 'http://localhost:8080'),
};
