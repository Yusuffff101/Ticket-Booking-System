import { Router } from 'express';
import { VenueController } from '../controllers/venue.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createVenueSchema, updateVenueSchema } from '../validations/venue.validation.js';
import { Role } from '../constants/index.js';

const router = Router();

// Public — list venues (customers & organisers need to browse them)
router.get('/', VenueController.getAll);
router.get('/:id', VenueController.getById);

// Admin only — create & update venues
router.post(
  '/',
  authenticate,
  authorizeRoles(Role.ADMIN),
  validate(createVenueSchema),
  VenueController.create
);

router.patch(
  '/:id',
  authenticate,
  authorizeRoles(Role.ADMIN),
  validate(updateVenueSchema),
  VenueController.update
);

export default router;
