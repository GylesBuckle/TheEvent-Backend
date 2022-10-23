const mongoose = require('mongoose');

const PaymentSchema = mongoose.Schema({
  paymentMethod: {
    type: String,
    enum: ['paypal', 'stripe'],
    required: [true, 'A Payemnt must have a Payment method name'],
  },
  tenure: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subcriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subcriptions',
    required: true,
  },
  customerId: {
    type: String,
    required: true,
  },
  transactionId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    required: true,
  },
  // expireTime: {
  //   type: Date,
  //   required: true,
  // },
});

let Payments;
if (!mongoose.models['Payments']) {
  Payments = mongoose.model('Payments', PaymentSchema);
} else {
  Payments = mongoose.models['Payments'];
}
module.exports = Payments;
