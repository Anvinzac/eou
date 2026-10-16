import { beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ shareBaseUrl: 'https://go.eou.test', isProduction: false }));

vi.mock('../lib/env.js', () => ({
  env: {
    port: 3001,
    get shareBaseUrl() { return config.shareBaseUrl; },
    get isProduction() { return config.isProduction; },
    appPublicUrl: 'https://eou.test',
  },
}));
vi.mock('../models/QuizModel.js', () => ({ QuizModel: {
  requireOwned: vi.fn(), setShareCode: vi.fn(), findById: vi.fn(), findByShareCode: vi.fn(),
} }));
vi.mock('./telemetryService.js', () => ({ TelemetryService: { emitSafe: vi.fn() } }));

import { QuizModel } from '../models/QuizModel.js';
import { TelemetryService } from './telemetryService.js';
import { isPreviewBot, ShareService } from './shareService.js';

const QUIZ_ID = 'quiz-1';
const quiz = (overrides: Record<string, unknown> = {}) => ({
  id: QUIZ_ID, title: 'About us', is_open: true, share_code: null, appearance: { theme: 'mint', style: 'playful' }, ...overrides,
});
const FACEBOOK = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

beforeEach(() => {
  vi.resetAllMocks();
  config.shareBaseUrl = 'https://go.eou.test';
  config.isProduction = false;
  vi.mocked(QuizModel.requireOwned).mockResolvedValue(quiz());
  vi.mocked(QuizModel.setShareCode).mockImplementation(async (id, code) => quiz({ id, share_code: code }));
});

describe('creating share links', () => {
  it('gives an open quiz a 7-character code once and records it', async () => {
    const link = await ShareService.getOrCreateLink('user-1', QUIZ_ID);
    expect(link.code).toMatch(/^[A-HJ-NP-Z2-9]{7}$/);
    expect(link.url).toBe(`https://go.eou.test/s/${link.code}`);
    expect(QuizModel.requireOwned).toHaveBeenCalledWith(QUIZ_ID, 'user-1');
    expect(TelemetryService.emitSafe).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'link.created', entity_type: 'share_link', entity_id: QUIZ_ID, actor_user_id: 'user-1',
    }));
  });

  it('reuses the existing code', async () => {
    vi.mocked(QuizModel.requireOwned).mockResolvedValue(quiz({ share_code: 'ABCDEFG' }));
    expect(await ShareService.getOrCreateLink('user-1', QUIZ_ID)).toEqual({ code: 'ABCDEFG', url: 'https://go.eou.test/s/ABCDEFG' });
    expect(QuizModel.setShareCode).not.toHaveBeenCalled();
  });

  it('refuses invite-only quizzes', async () => {
    vi.mocked(QuizModel.requireOwned).mockResolvedValue(quiz({ is_open: false }));
    await expect(ShareService.getOrCreateLink('user-1', QUIZ_ID)).rejects.toThrow('only available for open quizzes');
    expect(QuizModel.setShareCode).not.toHaveBeenCalled();
  });

  it("only lets the quiz's owner create a link", async () => {
    vi.mocked(QuizModel.requireOwned).mockRejectedValue(Object.assign(new Error('Quiz not found'), { status: 404 }));
    await expect(ShareService.getOrCreateLink('someone-else', QUIZ_ID)).rejects.toThrow('Quiz not found');
  });

  it('retries with a new code when one is taken by another quiz, and only then', async () => {
    vi.mocked(QuizModel.setShareCode)
      .mockRejectedValueOnce({ code: '23505', message: 'duplicate key value' })
      .mockImplementationOnce(async (id, code) => quiz({ id, share_code: code }));
    const link = await ShareService.getOrCreateLink('user-1', QUIZ_ID);
    expect(QuizModel.setShareCode).toHaveBeenCalledTimes(2);
    const [[, first], [, second]] = vi.mocked(QuizModel.setShareCode).mock.calls;
    expect(second).not.toBe(first);
    expect(link.code).toBe(second);

    vi.mocked(QuizModel.setShareCode).mockReset().mockRejectedValue(new Error('connection lost'));
    await expect(ShareService.getOrCreateLink('user-1', QUIZ_ID)).rejects.toThrow('connection lost');
    expect(QuizModel.setShareCode).toHaveBeenCalledOnce();
  });

  it('returns the code a concurrent request set first', async () => {
    vi.mocked(QuizModel.setShareCode).mockResolvedValue(null);
    vi.mocked(QuizModel.findById).mockResolvedValue(quiz({ share_code: 'WINNER7' }));
    expect((await ShareService.getOrCreateLink('user-1', QUIZ_ID)).code).toBe('WINNER7');
    expect(TelemetryService.emitSafe).not.toHaveBeenCalled();
  });

  it('never hands out localhost links in production', async () => {
    config.shareBaseUrl = '';
    config.isProduction = true;
    await expect(ShareService.getOrCreateLink('user-1', QUIZ_ID)).rejects.toThrow('not configured');
    config.isProduction = false;
    expect((await ShareService.getOrCreateLink('user-1', QUIZ_ID)).url).toMatch(/^http:\/\/localhost:3001\/s\//);
  });
});

describe('visiting short links', () => {
  it('redirects people straight to the quiz and counts the visit', async () => {
    vi.mocked(QuizModel.findByShareCode).mockResolvedValue(quiz({ share_code: 'ABCDEFG' }));
    expect(await ShareService.visit('abcdefg', IPHONE)).toEqual({ status: 302, location: 'https://eou.test/quiz/quiz-1' });
    expect(QuizModel.findByShareCode).toHaveBeenCalledWith('abcdefg');
    expect(TelemetryService.emitSafe).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'link.interacted', metadata: expect.objectContaining({ interaction_kind: 'short_link_visit', quiz_id: QUIZ_ID }),
    }));
  });

  it('serves link-preview tags to crawlers without redirecting or counting them', async () => {
    vi.mocked(QuizModel.findByShareCode).mockResolvedValue(quiz({ share_code: 'ABCDEFG' }));
    const result = await ShareService.visit('ABCDEFG', FACEBOOK);
    expect(result.status).toBe(200);
    const html = 'html' in result ? result.html : '';
    expect(html).toContain('<meta property="og:title" content="About us">');
    expect(html).toContain('<meta property="og:image" content="https://go.eou.test/og/mint.jpg">');
    expect(html).toContain('<meta property="og:url" content="https://go.eou.test/s/ABCDEFG">');
    expect(html).not.toMatch(/http-equiv="refresh"|<script/i);
    expect(TelemetryService.emitSafe).not.toHaveBeenCalled();
  });

  it('escapes quiz titles in the preview page', async () => {
    vi.mocked(QuizModel.findByShareCode).mockResolvedValue(quiz({ share_code: 'ABCDEFG', title: '"><script>alert(1)</script>' }));
    const result = await ShareService.visit('ABCDEFG', FACEBOOK);
    const html = 'html' in result ? result.html : '';
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('falls back to the default theme image for unknown themes', async () => {
    vi.mocked(QuizModel.findByShareCode).mockResolvedValue(quiz({ share_code: 'ABCDEFG', appearance: { theme: '../../etc' } }));
    const result = await ShareService.visit('ABCDEFG', FACEBOOK);
    expect('html' in result && result.html).toContain('/og/lavender.jpg');
  });

  it('answers 404 for unknown or malformed codes without querying odd input', async () => {
    vi.mocked(QuizModel.findByShareCode).mockResolvedValue(null);
    expect((await ShareService.visit('NOPE123', IPHONE)).status).toBe(404);
    expect((await ShareService.visit('../admin', IPHONE)).status).toBe(404);
    expect(QuizModel.findByShareCode).toHaveBeenCalledOnce();
  });

  it('recognises the common link-preview crawlers', () => {
    for (const agent of [FACEBOOK, 'Twitterbot/1.0', 'TelegramBot (like TwitterBot)', 'WhatsApp/2.23.20.0', 'Zalo-Link-Preview', 'Slackbot-LinkExpanding 1.0', 'Discordbot/2.0']) {
      expect(isPreviewBot(agent), agent).toBe(true);
    }
    expect(isPreviewBot(IPHONE)).toBe(false);
  });
});
