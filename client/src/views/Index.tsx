import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowRight, Check, Heart, Link2, Palette, Sparkles, Swords } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { authApi, quizzesApi } from '@/api';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import QuestionStage from '@/components/quiz/QuestionStage';
import { DEFAULT_QUIZ_APPEARANCE, getQuizTheme, QUIZ_THEMES, QUIZ_STYLES, type QuizAppearance } from '@/lib/quizAppearance';

const CREATION_STEPS = [
  { id: 'look', emoji: '🎨', theme: 'lavender' },
  { id: 'questions', emoji: '💭', theme: 'peach' },
  { id: 'share', emoji: '💌', theme: 'mint' },
] as const;

export default function Index() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [hasQuiz, setHasQuiz] = useState(false);
  const [checking, setChecking] = useState(true);
  const [appearance, setAppearance] = useState<QuizAppearance>(DEFAULT_QUIZ_APPEARANCE);
  const [demoAnswer, setDemoAnswer] = useState<number | null>(null);
  const theme = getQuizTheme(appearance);
  const choices = t('studio.sample_options', { returnObjects: true }) as string[];
  const createPath = `/create?theme=${appearance.theme}&style=${appearance.style}`;

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) {
        setHasQuiz(false);
        setChecking(false);
        return;
      }
      setChecking(true);

      // Link any draft quiz first, including after an OAuth return.
      try {
        const draftToken = localStorage.getItem('quiz_draft_token');
        const draftQuizId = localStorage.getItem('quiz_draft_id');
        if (draftToken && draftQuizId) {
          await authApi.claimDraft(draftQuizId, draftToken);
          localStorage.removeItem('quiz_draft_token');
          localStorage.removeItem('quiz_draft_id');
        }
      } catch { /* A stale draft or unavailable storage must not block the landing page. */ }

      try {
        const { quizzes } = await quizzesApi.listMine();
        if (!cancelled) setHasQuiz(quizzes.length > 0);
      } catch {
        if (!cancelled) setHasQuiz(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    if (!loading) void check();
    return () => { cancelled = true; };
  }, [user, loading]);

  useEffect(() => {
    if (!loading && !checking && user && hasQuiz) navigate('/dashboard', { replace: true });
  }, [user, loading, checking, hasQuiz, navigate]);

  if (loading || checking || (user && hasQuiz)) {
    return (
      <div className="quiz-studio home-studio home-loading" role="status">
        <span className="home-brand-flower" aria-hidden="true">✳</span>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="quiz-studio home-studio">
        <a href="#home-main" className="home-skip-link">{t('home_studio.skip')}</a>
        <header className="home-header">
          <div className="home-container home-header-inner">
            <Link to="/" className="home-brand" aria-label={t('common.home')}>
              <span className="home-brand-flower" aria-hidden="true">✳</span>
              <span>eou<span className="text-primary">.</span></span>
            </Link>
            <nav className="home-desktop-nav" aria-label={t('home_studio.navigation')}>
              <a href="#home-how">{t('home_studio.how_link')}</a>
              <a href="#home-themes">{t('home_studio.themes_link')}</a>
            </nav>
            <div className="home-header-actions">
              <Link className="home-signin" to={user ? '/dashboard' : '/auth'}>{t(user ? 'home_studio.dashboard' : 'account.sign_in')}</Link>
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <main id="home-main" tabIndex={-1}>
          <section className="home-container home-hero" aria-labelledby="home-title">
            <motion.div className="home-hero-copy" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p className="home-eyebrow"><span className="home-status-dot" />{t('home_studio.eyebrow')}</p>
              <h1 id="home-title" className="home-title">
                {t('home_studio.title_first')}<br />
                {t('home_studio.title_second')}{' '}
                <span className="home-title-accent">{t('home_studio.title_highlight')}<svg aria-hidden="true" viewBox="0 0 260 15" preserveAspectRatio="none"><path d="M3 10 Q125 -1 257 7 M18 14 Q139 5 241 11" /></svg></span>
              </h1>
              <p className="home-intro">{t('home_studio.intro')}</p>
              <div className="home-hero-actions">
                <Button asChild className="studio-primary home-create-button">
                  <Link to={createPath}>{t('home_studio.create')}<ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <a className="home-text-link" href="#home-preview">{t('home_studio.try_preview')}<ArrowDown className="h-4 w-4" /></a>
              </div>
              <p className="home-start-note"><Check className="h-3.5 w-3.5" />{t('home_studio.start_note')}</p>
              <div className="home-people-note">
                <div className="home-people-stickers" aria-hidden="true"><span>🧸</span><span>🌷</span><span>🦋</span></div>
                <p>{t('home_studio.people_first')}<br /><strong>{t('home_studio.people_second')}</strong></p>
              </div>
            </motion.div>

            <motion.div className="home-demo" id="home-preview" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }}>
              <div className="home-demo-caption"><Sparkles className="h-3.5 w-3.5" /><span>{t('home_studio.preview_caption')}</span></div>
              <div className="home-postcard-stack">
                <span className="home-tape" aria-hidden="true" />
                <div className="home-postcard">
                  <div className="home-postcard-heading"><span>{t('home_studio.preview_name')}</span><Heart className="h-4 w-4" /></div>
                  <QuestionStage
                    appearance={appearance}
                    text={t('studio.sample_text')}
                    category={t('studio.sample_category')}
                    emoji={theme.emoji}
                    choices={choices}
                    selectedAnswer={demoAnswer === null ? undefined : choices[demoAnswer]}
                    onAnswer={answer => setDemoAnswer(choices.indexOf(answer))}
                    questionNumber={1}
                    total={5}
                    compact
                  />
                  <p className="home-preview-feedback" role="status">{t(demoAnswer === null ? 'home_studio.preview_hint' : 'home_studio.preview_reply')}</p>
                  <fieldset className="home-preview-themes">
                    <legend>{t('home_studio.try_theme')}</legend>
                    <div>
                      {QUIZ_THEMES.map(item => (
                        <button key={item.id} type="button" aria-label={t(`studio.themes.${item.id}.name`)} title={t(`studio.themes.${item.id}.name`)} aria-pressed={appearance.theme === item.id} onClick={() => setAppearance(current => ({ ...current, theme: item.id }))}>
                          <span style={{ background: item.gradient, color: item.ink }}>{appearance.theme === item.id ? <Check className="h-4 w-4" /> : item.emoji}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="home-preview-styles">
                    <legend>{t('home_studio.try_style')}</legend>
                    <div>
                      {QUIZ_STYLES.map(item => (
                        <button key={item.id} type="button" aria-pressed={appearance.style === item.id} onClick={() => setAppearance(current => ({ ...current, style: item.id }))} style={{ fontFamily: item.font }}>
                          {t(`studio.styles.${item.id}.name`)}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>
              <span className="home-margin-note">{t('home_studio.preview_note')}</span>
            </motion.div>
          </section>

          <div className="home-facts-wrap">
            <dl className="home-container home-facts">
              <div><dt><Heart className="h-4 w-4" />{t('home_studio.fact_questions')}</dt><dd>{t('home_studio.fact_questions_hint')}</dd></div>
              <div><dt><Palette className="h-4 w-4" />{t('home_studio.fact_themes')}</dt><dd>{t('home_studio.fact_themes_hint')}</dd></div>
              <div><dt><Link2 className="h-4 w-4" />{t('home_studio.fact_link')}</dt><dd>{t('home_studio.fact_link_hint')}</dd></div>
            </dl>
          </div>

          <section id="home-how" className="home-container home-section" aria-labelledby="home-how-title">
            <div className="home-section-heading">
              <p className="home-eyebrow">{t('home_studio.how_eyebrow')}</p>
              <h2 id="home-how-title">{t('home_studio.how_title')} <em>{t('home_studio.how_highlight')}</em></h2>
              <p>{t('home_studio.how_description')}</p>
            </div>
            <div className="home-steps">
              {CREATION_STEPS.map((step, index) => (
                <article className="home-step" key={step.id}>
                  <div className="home-step-top"><span className="home-step-emoji" aria-hidden="true" style={{ background: getQuizTheme({ theme: step.theme }).gradient }}>{step.emoji}</span><span className="home-step-number">0{index + 1}</span></div>
                  <h3>{t(`home_studio.steps.${step.id}.title`)}</h3>
                  <p>{t(`home_studio.steps.${step.id}.description`)}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="home-themes" className="home-container home-section home-theme-section" aria-labelledby="home-themes-title">
            <div className="home-section-heading">
              <p className="home-eyebrow">{t('home_studio.themes_eyebrow')}</p>
              <h2 id="home-themes-title">{t('home_studio.themes_title')} <em>{t('home_studio.themes_highlight')}</em></h2>
              <p>{t('home_studio.themes_description')}</p>
            </div>
            <div className="home-theme-gallery" role="group" aria-label={t('studio.mood')}>
              {QUIZ_THEMES.map(item => (
                <button className="home-theme-card" key={item.id} type="button" aria-pressed={appearance.theme === item.id} onClick={() => setAppearance(current => ({ ...current, theme: item.id }))}>
                  <span className="home-theme-art" style={{ background: item.gradient, color: item.ink }}>
                    <span aria-hidden="true">{item.emoji}</span>
                    <span className="home-theme-letter" aria-hidden="true">Aa</span>
                    {appearance.theme === item.id && <span className="home-theme-check"><Check className="h-3 w-3" /></span>}
                  </span>
                  <span className="home-theme-name">{t(`studio.themes.${item.id}.name`)}</span>
                  <span className="home-theme-description">{t(`studio.themes.${item.id}.description`)}</span>
                </button>
              ))}
            </div>
            <div className="home-theme-selection">
              <p><span aria-hidden="true">{theme.emoji}</span>{t('home_studio.selected_theme', { theme: t(`studio.themes.${theme.id}.name`) })}</p>
              <Link className="home-text-link" to={createPath}>{t('home_studio.use_theme')}<ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>

          <section className="home-container home-closing" aria-labelledby="home-closing-title">
            <div className="home-letter">
              <span className="home-letter-sticker home-letter-flower" aria-hidden="true">🌷</span>
              <span className="home-letter-sticker home-letter-heart" aria-hidden="true">💌</span>
              <p className="home-eyebrow">{t('home_studio.closing_eyebrow')}</p>
              <h2 id="home-closing-title">{t('home_studio.closing_title')}<br /><em>{t('home_studio.closing_highlight')}</em></h2>
              <p className="home-letter-description">{t('home_studio.closing_description')}</p>
              <Button asChild className="studio-primary home-create-button"><Link to={createPath}>{t('home_studio.create')}<ArrowRight className="h-4 w-4" /></Link></Button>
              <p className="home-letter-note">{t('home_studio.closing_note')}</p>
            </div>
            <div className="home-versus-note">
              <span className="home-versus-icon"><Swords className="h-5 w-5" /></span>
              <div><h3>{t('home_studio.versus_title')}</h3><p>{t('home_studio.versus_description')}</p></div>
              <Link to="/create-versus" className="home-text-link">{t('home_studio.versus_link')}<ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>
        </main>

        <footer className="home-container home-footer">
          <Link to="/" className="home-brand" aria-label={t('common.home')}>eou<span className="text-primary">.</span></Link>
          <p>{t('home_studio.footer')}</p>
          <Link to={user ? '/dashboard' : '/auth'} className="home-text-link">{t(user ? 'home_studio.dashboard' : 'home_studio.account')}</Link>
        </footer>
        <div className="home-mobile-dock">
          <Button asChild className="studio-primary home-create-button"><Link to={createPath}><Sparkles className="h-4 w-4" />{t('home_studio.create')}<ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </div>
    </MotionConfig>
  );
}
