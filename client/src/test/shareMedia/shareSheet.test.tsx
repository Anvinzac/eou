import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import ShareMediaButton from '@/components/share/ShareMediaButton';
import { quizzesApi, adminTelemetryApi, shareApi } from '@/api';
import { encodeGif } from '@/lib/shareMedia/encode/gif';
import { pickVideoScale } from '@/lib/shareMedia/encode/support';
import { downloadFiles } from '@/lib/shareMedia/share';
import { createRecordingContext } from './recordingContext';

vi.mock('@/api', () => ({
  quizzesApi: { getTake: vi.fn() },
  shareApi: { createLink: vi.fn() },
  adminTelemetryApi: { reportClientError: vi.fn(async () => ({})) },
}));
vi.mock('@/lib/shareMedia/encode/gif', () => ({ encodeGif: vi.fn() }));
vi.mock('@/lib/shareMedia/encode/mp4', () => ({ encodeMp4: vi.fn(async () => new Blob(['mp4'], { type: 'video/mp4' })) }));
vi.mock('@/lib/shareMedia/encode/support', () => ({ pickVideoScale: vi.fn() }));
vi.mock('@/lib/shareMedia/share', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shareMedia/share')>()),
  canShareFiles: () => false,
  downloadFiles: vi.fn(),
}));

const payload = {
  quiz: { id: 'quiz-1', title: 'About us', appearance: { theme: 'peach', style: 'playful' }, is_open: true },
  questions: Array.from({ length: 5 }, (_, i) => ({
    id: `q${i}`, quiz_id: 'quiz-1', category: 'Food', question_text: `Favorite snack ${i}?`, order_number: i + 1,
    emoji: '', choices: ['Chips', 'Fruit', 'Candy', 'Nuts'],
  })),
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('en');
  vi.mocked(quizzesApi.getTake).mockResolvedValue(payload as Awaited<ReturnType<typeof quizzesApi.getTake>>);
  vi.mocked(shareApi.createLink).mockResolvedValue({ code: 'ABCDEFG', url: 'https://go.eou.test/s/ABCDEFG' });
  vi.mocked(pickVideoScale).mockResolvedValue(1);
  vi.mocked(encodeGif).mockResolvedValue(new Blob(['gif'], { type: 'image/gif' }));
  HTMLCanvasElement.prototype.getContext = (() => createRecordingContext().ctx) as unknown as typeof originalGetContext;
});

afterEach(() => {
  cleanup();
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

async function openSheet() {
  render(<ShareMediaButton quizId="quiz-1" title="About us" isOpen />);
  fireEvent.click(screen.getByRole('button', { name: /share as image, gif or video/i }));
  await screen.findByLabelText('Headline');
}

describe('share as media', () => {
  it('is not offered for invite-only quizzes', () => {
    render(<ShareMediaButton quizId="quiz-1" title="About us" isOpen={false} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('prefills the headline and exports a half-size GIF built from the public quiz', async () => {
    await openSheet();
    expect(screen.getByLabelText('Headline')).toHaveValue('About us');
    expect(quizzesApi.getTake).toHaveBeenCalledWith('quiz-1');

    fireEvent.click(screen.getByRole('radio', { name: 'GIF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByRole('status');

    const [options, frameMs] = vi.mocked(encodeGif).mock.calls[0];
    expect(frameMs).toBeUndefined();
    expect(options.format).toMatchObject({ id: 'story', width: 540, height: 960 });
    expect(options.timeline.kind).toBe('gif');
    expect(JSON.stringify(options.quiz)).not.toMatch(/correct|distractor/);

    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    const [files] = vi.mocked(downloadFiles).mock.calls[0];
    expect(files.map((file) => file.name)).toEqual(['about-us-story.gif']);
  });

  it('puts the short link on exports, falling back to the quiz URL when it cannot be created', async () => {
    await openSheet();
    fireEvent.click(screen.getByRole('radio', { name: 'GIF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByRole('status');
    expect(vi.mocked(encodeGif).mock.calls[0][0].quiz.shareUrl).toBe('https://go.eou.test/s/ABCDEFG');
    cleanup();

    vi.mocked(shareApi.createLink).mockRejectedValue(new Error('Share links are not configured'));
    await openSheet();
    fireEvent.click(screen.getByRole('radio', { name: 'GIF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(encodeGif).toHaveBeenCalledTimes(2));
    expect(vi.mocked(encodeGif).mock.calls[1][0].quiz.shareUrl).toBe(`${window.location.origin}/quiz/quiz-1`);
  });

  it('re-encodes a GIF that is too big for chat apps at a smaller size', async () => {
    vi.mocked(encodeGif)
      .mockResolvedValueOnce(new Blob([new Uint8Array(9 * 1024 * 1024)], { type: 'image/gif' }))
      .mockResolvedValueOnce(new Blob(['small'], { type: 'image/gif' }));
    await openSheet();
    fireEvent.click(screen.getByRole('radio', { name: 'GIF' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Square' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByRole('status');
    const [, second] = vi.mocked(encodeGif).mock.calls;
    expect(second[0].format).toMatchObject({ id: 'square', width: 480, height: 480 });
    expect(second[1]).toBe(100);
  });

  it('explains when this browser cannot make videos and reports it once', async () => {
    vi.mocked(pickVideoScale).mockResolvedValue(null);
    await openSheet();
    fireEvent.click(screen.getByRole('radio', { name: 'Video' }));
    expect(await screen.findByText(/can't make videos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Square' }));
    await waitFor(() => expect(pickVideoScale).toHaveBeenCalledTimes(2));
    expect(adminTelemetryApi.reportClientError).toHaveBeenCalledOnce();
    expect(vi.mocked(adminTelemetryApi.reportClientError).mock.calls[0][0]).toMatchObject({
      severity: 'info', metadata: { kind: 'share_video_unsupported' },
    });
  });

  it('shows a carousel as a cover plus one image per question', async () => {
    await openSheet();
    fireEvent.click(screen.getByRole('radio', { name: 'Carousel' }));
    expect(screen.getByText('Image 1 of 6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByText('Image 2 of 6')).toBeInTheDocument();
  });
});
