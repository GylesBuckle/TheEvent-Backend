const express = require('express');

const paymentController = require('../controllers/paymentController');
const protect = require('../middleware/protect');

const router = express.Router();

router.post('/stripeWebHook', paymentController.stripeWebHook);
router.use(protect);

router
  .route('/')
  .get(paymentController.userSubcription)
  .post(paymentController.purchase);

router.route('/getPaymentInvoice/').post(paymentController.getPaypalInvoice);
router.route('/paymentHistory').get(paymentController.userSubcriptions);

router.route('/cancelSubcription').post(paymentController.cancelSubcription);

module.exports = router;
