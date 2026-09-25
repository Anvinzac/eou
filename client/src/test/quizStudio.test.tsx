import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import CreateQuiz from '@/views/CreateQuiz';
import QuestionStage from '@/components/quiz/QuestionStage';
import { VibeStep, EmojiPicker, StudioPreview } from '@/components/quiz/QuizStudio';
import { DEFAULT_QUIZ_APPEARANCE, getQuizTheme, resolveQuizAppearance, type QuizAppearance } from '@/lib/quizAppearance';
import { catalogApi, quizzesApi } from '@/api';
import i18n, { getPreferredLanguage, LANGUAGE_STORAGE_KEY } from '@/i18n/config';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import en from '@/i18n/locales/en.json';
import viLocale from '@/i18n/locales/vi.json';
import enCatalog from '@/data/qna.json';
import viCatalog from '@/data/qna.vi.json';
import PacksStep from '@/components/quiz/PacksStep';

const authState = vi.hoisted(() => ({ signedIn: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: authState.signedIn ? { id: 'user-1' } : null }) }));
vi.mock('@/api', () => ({
  authApi: { claimDraft: vi.fn() },
  catalogApi: { preferenceQuestions: vi.fn(async () => ({ questions: Array.from({ length: 5 }, (_, index) => ({
    id: index + 1, category: 'Leisure', text: `What is my favorite activity ${index + 1}?`, options: ['Reading', 'Walking', 'Cooking', 'Gaming'],
  })) })) },
  quizzesApi: { createDraft: vi.fn(async () => ({ quiz: { id: 'draft-1' }, draftToken: 'draft-token' })), create: vi.fn(async () => ({ quiz: { id: 'published-1' }, questions: [] })) },
  packsApi: { list: vi.fn(async () => ({ packs: [] })) },
  distractorsApi: { generate: vi.fn() },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  authState.signedIn = false;
  localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  await i18n.changeLanguage('en');
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe('quiz appearance controls', () => {
  it('falls back safely for absent or unknown stored appearance', () => {
    expect(resolveQuizAppearance(null)).toEqual(DEFAULT_QUIZ_APPEARANCE);
    expect(resolveQuizAppearance({ theme: 'unknown', style: 'unknown' } as unknown as QuizAppearance)).toEqual(DEFAULT_QUIZ_APPEARANCE);
    expect(getQuizTheme({ theme: 'mint' }).id).toBe('mint');
  });

  it('selects theme and typography independently', () => {
    function Controls() {
      const [appearance, setAppearance] = useState(DEFAULT_QUIZ_APPEARANCE);
      return <VibeStep appearance={appearance} onChange={setAppearance} title="A little quiz" onTitleChange={() => {}} onNext={() => {}} />;
    }
    render(<Controls />);
    fireEvent.click(screen.getByRole('button', { name: /Peach, please/ }));
    fireEvent.click(screen.getByRole('button', { name: /Storybook/ }));
    expect(screen.getByRole('button', { name: /Peach, please/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Storybook/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Lavender daydream/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds and removes a question-specific emoji', async () => {
    function Picker() {
      const [emoji, setEmoji] = useState('');
      return <EmojiPicker value={emoji} onChange={setEmoji} />;
    }
    render(<Picker />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a question sticker' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Teddy bear' }));
    expect(screen.getByRole('button', { name: 'Teddy bear' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Remove sticker' }));
    expect(screen.getByRole('button', { name: 'Teddy bear' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders the same styled question and answer callback used in playback', () => {
    const onAnswer = vi.fn();
    render(<QuestionStage appearance={{ theme: 'midnight', style: 'editorial' }} text="Our perfect Sunday?" emoji="☕" choices={['Coffee', 'Adventure']} onAnswer={onAnswer} questionNumber={1} total={5} />);
    expect(screen.getByRole('heading', { name: 'Our perfect Sunday?' })).toHaveStyle({ fontFamily: 'Georgia, serif' });
    expect(screen.getByLabelText('Question sticker')).toHaveTextContent('☕');
    fireEvent.click(screen.getByRole('button', { name: /Coffee/ }));
    expect(onAnswer).toHaveBeenCalledWith('Coffee');
  });
});

it.each([
  { signedIn: false, locale: 'en', width: 1280 },
  { signedIn: true, locale: 'en', width: 1280 },
  { signedIn: false, locale: 'vi', width: 320 },
  { signedIn: true, locale: 'vi', width: 390 },
])('preserves personalization through the full wizard ($locale, $width, signed in: $signedIn)', async ({ signedIn, locale, width }) => {
  authState.signedIn = signedIn;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  await i18n.changeLanguage(locale);
  const t = (key: string) => i18n.t(key);
  const catalog = (locale === 'vi' ? viCatalog : enCatalog).questions.slice(0, 5);
  vi.mocked(catalogApi.preferenceQuestions).mockImplementation(async language => ({
    questions: (language === 'vi' ? viCatalog : enCatalog).questions.slice(0, 5),
  }));
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><CreateQuiz /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t('studio.themes.peach.name')) }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t('studio.styles.editorial.name')) }));
  fireEvent.change(screen.getByLabelText(new RegExp(t('studio.give_name'))), { target: { value: 'Our happy little quiz' } });
  fireEvent.click(screen.getByRole('button', { name: t('studio.pick_questions') }));
  await screen.findByText(catalog[0].text);
  const editor = screen.getByLabelText(t('studio.phases.select'), { selector: 'div[tabindex]' });
  for (const question of catalog) {
    fireEvent.click(within(editor).getByText(question.text));
  }
  fireEvent.click(screen.getByRole('button', { name: t('studio.make_yours') }));
  fireEvent.click(await screen.findByRole('button', { name: i18n.t('studio.sticker_for', { number: 1 }) }));
  fireEvent.click(await screen.findByRole('button', { name: t('studio.emojis.4') }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getAllByRole('button', { name: t('studio.move_down') })[0]);
  fireEvent.click(screen.getByRole('button', { name: t('studio.set_answers') }));

  for (let index = 0; index < 5; index++) {
    const answerEditor = screen.getByLabelText(t('studio.phases.answers'), { selector: 'div[tabindex]' });
    const questionId = [2, 1, 3, 4, 5][index];
    const question = catalog.find(item => item.id === questionId)!;
    await within(answerEditor).findByText(question.text);
    const answerButton = await within(answerEditor).findByRole('button', { name: new RegExp(`A ${question.options[0]}`) });
    fireEvent.click(answerButton);
    if (index < 4) {
      const next = screen.getByRole('button', { name: t('common.next') });
      await waitFor(() => expect(next).toBeEnabled());
      fireEvent.click(next);
    }
  }
  fireEvent.click(await screen.findByRole('button', { name: t('common.review') }));
  await screen.findByText(t('studio.review_title'));
  fireEvent.click(screen.getByRole('button', { name: locale === 'en' ? 'Chuyển sang tiếng Việt' : 'Switch to English' }));
  expect(screen.getByLabelText(t('studio.quiz_name'))).toHaveValue('Our happy little quiz');
  fireEvent.click(screen.getByRole('button', { name: locale === 'en' ? 'Switch to English' : 'Chuyển sang tiếng Việt' }));
  expect(screen.getByLabelText(t('studio.quiz_name'))).toHaveValue('Our happy little quiz');
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t('studio.public_title')) }));
  const publishLabel = t(signedIn ? 'studio.publish' : 'studio.save_draft');
  if (signedIn) {
    vi.mocked(quizzesApi.create).mockRejectedValueOnce(new Error('Temporary save failure'));
    fireEvent.click(screen.getByRole('button', { name: publishLabel }));
    await waitFor(() => expect(quizzesApi.create).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: publishLabel })).toBeEnabled());
  }
  fireEvent.click(screen.getByRole('button', { name: publishLabel }));
  const publish = signedIn ? quizzesApi.create : quizzesApi.createDraft;
  await waitFor(() => expect(publish).toHaveBeenCalledTimes(signedIn ? 2 : 1));
  const [title, questions, options] = vi.mocked(publish).mock.calls[0];
  expect(title).toBe('Our happy little quiz');
  expect(options).toEqual({ appearance: { theme: 'peach', style: 'editorial' }, isOpen: true });
  expect(questions[1]).toMatchObject({ questionId: 1, text: catalog[0].text, emoji: '🧸', orderNumber: 2, correctAnswer: catalog[0].options[0] });
  expect(questions[0].emoji).toBe('');
  if (signedIn) {
    expect(await screen.findByLabelText(t('studio.share_link'))).toHaveValue('http://localhost:3000/quiz/published-1');
  } else {
    expect(localStorage.getItem('quiz_draft_token')).toBe('draft-token');
  }
}, 20000);

it('defaults to Vietnamese and remembers an explicit English preference', async () => {
  localStorage.clear();
  expect(getPreferredLanguage()).toBe('vi');
  await i18n.changeLanguage(getPreferredLanguage());
  render(<LanguageSwitcher />);
  expect(document.documentElement.lang).toBe('vi');
  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
  expect(getPreferredLanguage()).toBe('en');
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  expect(document.documentElement.lang).toBe('en');
  fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang tiếng Việt' }));
  expect(getPreferredLanguage()).toBe('vi');
});

it('works when browser storage is unavailable', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  expect(getPreferredLanguage()).toBe('vi');
  await expect(i18n.changeLanguage('vi')).resolves.toBeDefined();
  expect(document.documentElement.lang).toBe('vi');
  get.mockRestore();
  set.mockRestore();
});

it('has matching locale keys, arrays, and interpolation variables', () => {
  const compare = (english: unknown, vietnamese: unknown) => {
    if (typeof english === 'string') {
      expect(typeof vietnamese).toBe('string');
      expect((String(vietnamese).match(/{{\w+}}/g) || []).sort()).toEqual((english.match(/{{\w+}}/g) || []).sort());
      return;
    }
    expect(Object.keys(vietnamese as object)).toEqual(Object.keys(english as object));
    for (const key of Object.keys(english as object)) compare(english[key], vietnamese[key]);
  };
  compare(en, viLocale);
});

it.each([
  { locale: 'en', count: 1, questions: '1 question', categories: '1 category' },
  { locale: 'en', count: 2, questions: '2 questions', categories: '2 categories' },
  { locale: 'vi', count: 1, questions: '1 câu hỏi', categories: '1 chủ đề' },
  { locale: 'vi', count: 2, questions: '2 câu hỏi', categories: '2 chủ đề' },
])('formats counts correctly in $locale for $count', async ({ locale, count, questions, categories }) => {
  await i18n.changeLanguage(locale);
  expect(i18n.t('common.questions', { count })).toBe(questions);
  expect(i18n.t('common.categories', { count })).toBe(categories);
});

it('builds Vietnamese curated packs from translated questions with stable IDs', async () => {
  await i18n.changeLanguage('vi');
  const onSelectPack = vi.fn();
  await act(async () => {
    render(<PacksStep catalog={viCatalog.questions} onSelectPack={onSelectPack} onSkip={() => {}} />);
  });
  const title = i18n.t('packs.pack_deep');
  fireEvent.click(screen.getByRole('button', { name: new RegExp(title) }));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.use_pack', { title }) }));
  expect(onSelectPack).toHaveBeenCalledOnce();
  const selected = onSelectPack.mock.calls[0][0];
  expect(selected).toHaveLength(10);
  for (const question of selected) {
    const original = viCatalog.questions.find(item => item.id === question.questionId)!;
    expect(question).toMatchObject({ text: original.text, category: original.category, options: original.options });
    expect(['Emotion', 'Growth', 'Values']).toContain(question.category);
  }
});

it('opens a Vietnamese mobile preview without mounting the desktop phone or saving answers', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  await i18n.changeLanguage('vi');
  const { container } = render(<StudioPreview selected={[]} appearance={DEFAULT_QUIZ_APPEARANCE} title="Bài của mình" />);
  expect(container.querySelector('.studio-phone')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Xem thử/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: /Nhâm nhi cà phê/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('studio.preview_finish') }));
  await within(dialog).findByText(i18n.t('studio.preview_safe'));
  expect(quizzesApi.createDraft).not.toHaveBeenCalled();
  expect(quizzesApi.create).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('common.close') }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('ignores a stale catalog response after switching languages', async () => {
  let resolveEnglish: (value: Awaited<ReturnType<typeof catalogApi.preferenceQuestions>>) => void;
  vi.mocked(catalogApi.preferenceQuestions).mockImplementationOnce(() => new Promise(resolve => { resolveEnglish = resolve; }));
  vi.mocked(catalogApi.preferenceQuestions).mockResolvedValueOnce({ questions: [{ id: 1, category: 'Leisure', text: 'Mình thích làm gì?', options: ['Đọc sách', 'Đi dạo', 'Nấu ăn', 'Chơi game'] }] });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><CreateQuiz /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang tiếng Việt' }));
  expect(screen.getByLabelText(new RegExp(i18n.t('studio.give_name')))).toHaveValue(i18n.t('studio.default_title'));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.pick_questions') }));
  await screen.findByText('Mình thích làm gì?');
  await act(async () => resolveEnglish!({ questions: [{ id: 1, category: 'Leisure', text: 'Stale English question', options: [] }] }));
  expect(screen.queryByText('Stale English question')).toBeNull();
  expect(screen.getByText('Mình thích làm gì?')).toBeInTheDocument();
});
