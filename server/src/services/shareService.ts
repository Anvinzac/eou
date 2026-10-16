import { env } from '../lib/env.js';
import { badRequest, HttpError } from '../lib/errors.js';
import { QuizModel } from '../models/QuizModel.js';
import { generateShareCode } from './nameGenerator.js';
import { TelemetryService } from './telemetryService.js';

const THEMES = ['peach', 'lavender', 'mint', 'sunshine', 'midnight', 'rose'];
const CODE_PATTERN = /^[A-Za-z0-9]{4,12}$/;
const UNIQUE_VIOLATION = '23505';

// Link-preview crawlers get an HTML page with per-quiz tags; everyone else is redirected
// straight to the quiz. Some crawlers follow meta-refresh, so the page itself never redirects.
const PREVIEW_BOTS =
  /facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot|whatsapp|zalo|linkedinbot|pinterest|skypeuripreview|viber|line\/|kakaotalk|redditbot|embedly|vkshare|applebot|googlebot|bingbot|iframely/i;

type ShareableQuiz = { id: string; title: string; appearance?: { theme?: string } | null };

export type VisitResult =
  | { status: 302; location: string }
  | { status: 200 | 404; html: string };

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

/** Where short links live. Never falls back to localhost in production, so exports can't carry a dead link. */
function shareBaseUrl() {
  if (env.shareBaseUrl) return env.shareBaseUrl;
  if (env.isProduction) throw new HttpError(501, 'Share links are not configured');
  return `http://localhost:${env.port}`;
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

export function isPreviewBot(userAgent: string) {
  return PREVIEW_BOTS.test(userAgent);
}

export function linkPreviewHtml(quiz: ShareableQuiz, shareUrl: string, quizUrl: string, base: string) {
  const theme = THEMES.includes(quiz.appearance?.theme ?? '') ? quiz.appearance!.theme! : 'lavender';
  const title = escapeHtml(quiz.title);
  const description = 'Bạn hiểu mình đến đâu? Vào chơi quiz nhé! · How well do you know me? Take the quiz.';
  const image = `${base}/og/${theme}.jpg`;
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="canonical" href="${escapeHtml(quizUrl)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(shareUrl)}">
<meta property="og:site_name" content="eou">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${escapeHtml(image)}">
</head>
<body><p><a href="${escapeHtml(quizUrl)}">${title}</a></p></body>
</html>`;
}

function notFoundHtml(appUrl: string) {
  return `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>eou</title></head>
<body><p>Không tìm thấy quiz này. · This quiz link doesn't exist.</p><p><a href="${escapeHtml(appUrl)}">eou</a></p></body>
</html>`;
}

export const ShareService = {
  /** The quiz's short link, creating its code on first use. Only open quizzes can be shared this way. */
  async getOrCreateLink(userId: string, quizId: string) {
    const quiz = await QuizModel.requireOwned(quizId, userId);
    if (!quiz.is_open) throw badRequest('Share links are only available for open quizzes');
    const base = shareBaseUrl();
    const linkFor = (code: string) => ({ code, url: `${base}/s/${code}` });
    if (quiz.share_code) return linkFor(quiz.share_code);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateShareCode();
      try {
        const updated = await QuizModel.setShareCode(quizId, code);
        if (!updated) {
          // A concurrent request gave the quiz a code first; use that one.
          const current = await QuizModel.findById(quizId);
          if (current?.share_code) return linkFor(current.share_code);
          continue;
        }
        TelemetryService.emitSafe({
          event_type: 'link.created',
          actor_user_id: userId,
          entity_type: 'share_link',
          entity_id: quizId,
          metadata: { quiz_id: quizId, code },
        });
        return linkFor(code);
      } catch (error) {
        if (isUniqueViolation(error)) continue; // code already used by another quiz
        throw error;
      }
    }
    throw new HttpError(503, 'Could not create a share link, please try again');
  },

  async visit(code: string, userAgent: string): Promise<VisitResult> {
    const quiz = CODE_PATTERN.test(code) ? await QuizModel.findByShareCode(code) : null;
    if (!quiz) return { status: 404, html: notFoundHtml(env.appPublicUrl) };

    const quizUrl = `${env.appPublicUrl}/quiz/${encodeURIComponent(quiz.id)}`;
    if (isPreviewBot(userAgent)) {
      const base = env.shareBaseUrl || `http://localhost:${env.port}`;
      return { status: 200, html: linkPreviewHtml(quiz, `${base}/s/${quiz.share_code}`, quizUrl, base) };
    }
    // Crawlers are left out so link_interactions keeps counting people.
    TelemetryService.emitSafe({
      event_type: 'link.interacted',
      entity_type: 'share_link',
      entity_id: quiz.id,
      metadata: { quiz_id: quiz.id, code: quiz.share_code, interaction_kind: 'short_link_visit' },
    });
    return { status: 302, location: quizUrl };
  },
};
