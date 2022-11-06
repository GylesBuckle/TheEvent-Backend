const mongoose = require('mongoose');

const PaymentSchema = mongoose.Schema({
  customerData: {
    firstName: {
      type: String,
      required: true,
    },
    lastName: String,
    email: {
      type: String,
      required: true,
    },
    address: String,
    country: String,
    city: String,
    state: String,
    phone: String,
  },
  date: {
    type: Date,
    default: Date.now(),
  },
  paymentMethod: {
    type: String,
    enum: ['stripe'],
    required: [true, 'A Payemnt must have a Payment method name'],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  totalAmount: {
    type: Number,
    min: [1, 'Amount must be above 0'],
  },
  quantity: {
    type: Number,
    min: [1, 'Quantity must be above 0'],
  },
  transactionId: {
    type: String,
    required: true,
  },
  coupan: {
    type: String,
    required: true,
  },
});

let Payments;
if (!mongoose.models['Payments']) {
  Payments = mongoose.model('Payments', PaymentSchema);
} else {
  Payments = mongoose.models['Payments'];
}
module.exports = Payments;
