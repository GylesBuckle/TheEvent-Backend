const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const protect = require('../middleware/protect');
const upload = require('../middleware/imageUpload');
const restrictTo = require('../middleware/restrictedTo');

const router = express.Router();

router.post('/subcribe', userController.addSubcriber);

router.post('/signup', authController.signUp);

router.post('/verifyEmail/:token', authController.verifyEmail);
router.post('/login', authController.login);
router.post('/externalLogin', authController.externalLogin);

router.post('/forgetpassword', authController.forgotPassword);
router.post('/resetPassword/:token', authController.resetPassword);

router.post('/addPageView', userController.addPageView);
router.post('/addSocialClick', userController.addSocialClick);

router.use(protect);
router.post('/addUserActivity', userController.addUserActivity);

router.post('/addEmployee', restrictTo(['Company']), authController.addEmployee);
router.post(
  '/resendEmployeeVerificationEmail/:id',
  restrictTo(['Company']),
  authController.resendEmployeeVerificationEmail
);

router.get('/getEmployees', restrictTo(['Company']), userController.getCompanyUsers);
router.get('/getEmployee/:id', restrictTo(['Company']), userController.getEmployee);
router.route('/deleteEmployee/:id').delete(restrictTo(['Company']), userController.deleteEmployee);

router.patch('/updatePassword', authController.updatePassword);

router.get('/', restrictTo(['Admin', 'Super Admin']), userController.getUsers);

router.post('/validateToken', authController.validateUser);

router.patch('/updateActiveProfile', userController.updateActiveProfile);
router.patch('/updateUsername', userController.updateUsername);
router.post('/activateTrail', restrictTo(['User']), userController.activateTrail);

router.post(
  '/addNotification',
  restrictTo(['Company']),
  upload('attachment', 'attachments/', true),
  userController.addNotifications
);
router.post('/updateNotifications', userController.updateNotifications);

router.post(
  '/additionalTrail/:id',
  restrictTo(['Admin', 'Super Admin']),
  userController.additionalTrail
);

router
  .route('/updateLifetime/:id')
  .patch(restrictTo(['Admin', 'Super Admin']), userController.updateLifeTime);

// router.get('/me', userController.getMe, userController.getUser);
router.get(
  '/getAnalytics',
  restrictTo(['Admin', 'Super Admin', 'Company']),
  userController.getAnalytics
);
router.get(
  '/getReports',
  restrictTo(['Admin', 'Super Admin', 'Company']),
  userController.getReports
);
router.get(
  '/getUserStats',
  restrictTo(['Admin', 'Super Admin', 'Company']),
  userController.getUserStats
);

router
  .route('/:id')
  .get(userController.getUser)
  .delete(restrictTo(['Admin', 'Super Admin']), userController.delete);

router.post('/addProfile', userController.createProfile);

module.exports = router;
