const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const protect = require('../middleware/protect');
const restrictTo = require('../middleware/restrictedTo');

const router = express.Router();

router.post('/signup', authController.signUp);
router.post('/login', authController.login);
router.post('/externalLogin', authController.externalLogin);
router.post('/forgetpassword', authController.forgotPassword);
router.post('/resetPassword/:token', authController.resetPassword);

router.use(protect);
router.post('/validateToken', authController.validateUser);

router.patch('/updatePassword', authController.updatePassword);
router.get('/', restrictTo(['Admin', 'Super Admin']), userController.getUsers);

router
  .route('/:id')
  .get(userController.getUser)
  .delete(restrictTo(['Admin', 'Super Admin']), userController.delete);

module.exports = router;
