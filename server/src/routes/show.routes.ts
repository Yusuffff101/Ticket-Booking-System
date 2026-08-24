import { Router } from 'express';
import { ShowController } from '../controllers/show.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createShowSchema } from '../validations/event.validation.js';
import { Role } from '../constants/index.js';

const router = Router();

// Public — seat map and show detail (customers use this to browse)
router.get('/:id', ShowController.getById);
router.get('/:id/seatmap', ShowController.getSeatMap);

// Organiser: get shows by event
router.get('/event/:eventId', ShowController.getByEvent);

// Organiser + Admin — create shows
router.post(
  '/',
  authenticate,
  authorizeRoles(Role.ADMIN, Role.ORGANISER),
  validate(createShowSchema),
  ShowController.create
);

// Organiser + Admin — delete shows
router.delete(
  '/:id',
  authenticate,
  authorizeRoles(Role.ADMIN, Role.ORGANISER),
  ShowController.remove
);

export default router;
