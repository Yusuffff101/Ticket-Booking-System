import { Router } from 'express';
import { WaitlistController } from '../controllers/waitlist.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { joinWaitlistSchema } from '../validations/waitlist.validation.js';
import { Role } from '../constants/index.js';

// Router mounted at /api/waitlist
const router = Router();

// Public: view offer by token
router.get('/offer/:token', WaitlistController.getOffer);

// Customer: accept offer by token
router.post(
  '/offer/:token/accept',
  authenticate,
  authorizeRoles(Role.CUSTOMER, Role.ADMIN),
  WaitlistController.acceptOffer
);

// Customer: view own waitlist entries
router.get(
  '/my',
  authenticate,
  authorizeRoles(Role.CUSTOMER, Role.ADMIN),
  WaitlistController.getMyWaitlists
);

export default router;
