import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { AuthController } from '../controllers/AuthController.js';
import { QuizController } from '../controllers/QuizController.js';
import { InvitationController } from '../controllers/InvitationController.js';
import { AttemptController } from '../controllers/AttemptController.js';
import { CoupleController } from '../controllers/CoupleController.js';
import { QuestionPackController } from '../controllers/QuestionPackController.js';
import { AdminController } from '../controllers/AdminController.js';
import { DistractorController } from '../controllers/DistractorController.js';
import { CatalogController } from '../controllers/CatalogController.js';

export const apiRouter = Router();

// Auth
apiRouter.post('/auth/signup', asyncHandler(AuthController.signup));
apiRouter.post('/auth/signin', asyncHandler(AuthController.signin));
apiRouter.get('/auth/me', requireAuth, asyncHandler(AuthController.me));
apiRouter.post('/auth/drafts/claim', requireAuth, asyncHandler(AuthController.claimDraft));

// Catalog
apiRouter.get('/catalog/preference-questions', asyncHandler(CatalogController.preference));
apiRouter.get('/catalog/academic-questions', asyncHandler(CatalogController.academic));
apiRouter.get('/catalog/versus-preview', asyncHandler(CatalogController.versusPreview));

// Distractors
apiRouter.post('/distractors/generate', asyncHandler(DistractorController.generate));

// Quizzes
apiRouter.post('/quizzes', requireAuth, asyncHandler(QuizController.create));
apiRouter.post('/quizzes/drafts', asyncHandler(QuizController.createDraft));
apiRouter.get('/quizzes/mine', requireAuth, asyncHandler(QuizController.listMine));
apiRouter.post('/quizzes/versus', requireAuth, asyncHandler(QuizController.createVersus));
apiRouter.get('/quizzes/:id', asyncHandler(QuizController.getTake));
apiRouter.patch('/quizzes/:id', requireAuth, asyncHandler(QuizController.patch));

// Invitations
apiRouter.post('/quizzes/:id/invitations', requireAuth, asyncHandler(InvitationController.create));
apiRouter.get('/quizzes/:id/invitations', requireAuth, asyncHandler(InvitationController.list));
apiRouter.post('/invitations/verify', asyncHandler(InvitationController.verify));

// Attempts
apiRouter.post('/quizzes/:id/attempts', asyncHandler(AttemptController.submit));
apiRouter.get('/quizzes/:id/attempts', requireAuth, asyncHandler(AttemptController.listForQuiz));
apiRouter.get('/quizzes/:id/leaderboard', asyncHandler(AttemptController.leaderboard));
apiRouter.get('/attempts/:id', asyncHandler(AttemptController.get));

// Couple
apiRouter.post('/quizzes/:id/couple-sessions', asyncHandler(CoupleController.create));
apiRouter.get('/quizzes/:id/couple-sessions', requireAuth, asyncHandler(CoupleController.listForQuiz));
apiRouter.post('/couple-sessions/join', asyncHandler(CoupleController.join));
apiRouter.get('/couple-sessions/:code', asyncHandler(CoupleController.getByCode));

// Packs
apiRouter.get('/question-packs', optionalAuth, asyncHandler(QuestionPackController.list));
apiRouter.get('/question-packs/mine', requireAuth, asyncHandler(QuestionPackController.listMine));
apiRouter.post('/question-packs', requireAuth, asyncHandler(QuestionPackController.create));
apiRouter.put('/question-packs/:id', requireAuth, asyncHandler(QuestionPackController.update));
apiRouter.delete('/question-packs/:id', requireAuth, asyncHandler(QuestionPackController.remove));

// Admin
apiRouter.get('/admin/feature-flags', requireAuth, requireAdmin, asyncHandler(AdminController.featureFlags));
apiRouter.patch(
  '/admin/feature-flags/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(AdminController.toggleFlag),
);
apiRouter.get('/admin/profiles', requireAuth, requireAdmin, asyncHandler(AdminController.profiles));
