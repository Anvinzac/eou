import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { CatalogService } from '../services/catalogService.js';

export const CatalogController = {
  async preference(req: AuthedRequest, res: Response) {
    const locale = typeof req.query.locale === 'string' ? req.query.locale : undefined;
    res.json(CatalogService.getPreferenceQuestions(locale));
  },

  async academic(req: AuthedRequest, res: Response) {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty : undefined;
    res.json(CatalogService.getAcademicQuestions({ category, difficulty }));
  },

  async versusPreview(req: AuthedRequest, res: Response) {
    const category = String(req.query.category || '');
    res.json({ questions: CatalogService.previewVersus(category) });
  },
};
