import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/rbac.middleware.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validations/auth.validation.js';
import { Role } from '../constants/index.js';

const router = Router();

// Public auth routes
router.post('/register', validate(registerSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh', validate(refreshTokenSchema), AuthController.refreshToken);

// Protected routes
router.get('/me', authenticate, AuthController.getMe);

// Role verification test routes (for verifying RBAC)
router.get('/admin-only', authenticate, authorizeRoles(Role.ADMIN), AuthController.testAdminOnly);
router.get(
  '/organiser-area',
  authenticate,
  authorizeRoles(Role.ADMIN, Role.ORGANISER),
  AuthController.testOrganiserOnly
);

export default router;
