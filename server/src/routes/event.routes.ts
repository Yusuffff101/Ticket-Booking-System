import { Router } from 'express';
import { EventController } from '../controllers/event.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createEventSchema, updateEventSchema } from '../validations/event.validation.js';
import { Role } from '../constants/index.js';

const router = Router();

// Public — list & browse events
router.get('/', EventController.list);
router.get('/:id', EventController.getById);

// Organiser + Admin — create events
router.post(
  '/',
  authenticate,
  authorizeRoles(Role.ADMIN, Role.ORGANISER),
  validate(createEventSchema),
  EventController.create
);

// Organiser + Admin — update events
router.patch(
  '/:id',
  authenticate,
  authorizeRoles(Role.ADMIN, Role.ORGANISER),
  validate(updateEventSchema),
  EventController.update
);

// Organiser + Admin — delete events
router.delete(
  '/:id',
  authenticate,
  authorizeRoles(Role.ADMIN, Role.ORGANISER),
  EventController.remove
);

export default router;
