import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/rbac.middleware.js';
import { Role } from '../constants/index.js';

const router = Router();

// Organiser Dashboard overview
router.get(
  '/dashboard',
  authenticate,
  authorizeRoles(Role.ORGANISER, Role.ADMIN),
  AnalyticsController.getDashboard
);

// Event detailed financial & operational summary
router.get(
  '/events/:id/summary',
  authenticate,
  authorizeRoles(Role.ORGANISER, Role.ADMIN),
  AnalyticsController.getEventSummary
);

export default router;
