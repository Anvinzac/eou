import type { Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { generateDistractorsWithLLM } from '../services/qwenDistractor.js';

export const DistractorController = {
  async generate(req: AuthedRequest, res: Response) {
    const body = z
      .object({
        answer: z.string().min(1),
        questionText: z.string().optional().default(''),
        category: z.string().optional().default(''),
        count: z.number().int().min(1).max(6).optional().default(3),
      })
      .parse(req.body);

    const result = await generateDistractorsWithLLM(
      body.answer,
      body.count,
      body.questionText,
      body.category,
    );
    res.json(result);
  },
};
