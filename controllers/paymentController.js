const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const PaymentModal = require('../models/paymentsModal');
const { default: axios } = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Email = require('../utils/emails');

const encodedToken = Buffer.from(
  `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET_KEY}`
).toString('base64');

exports.purchase = catchAsync(async (req, res, next) => {
  const { paymentMethod, tenure, subcriptionId, token } = req.body;

  let subcription = await Subcriptions.findById(subcriptionId);
  if (!subcription) return next(new AppError('requested Subcription not found', 404));

  let customer = null;
  let transactionId = null;
  let createdAt = null;
  let expireTime = null;

  //checking user already paid
  let alreadyPaid = false;
  let lastpayment = await PaymentModal.findOne({
    $query: { userId: req.user._id },
    $orderby: { $natural: -1 },
  });
  console.log(lastpayment, 'lastpayment');
  if (lastpayment && lastpayment.paymentMethod === 'stripe') {
    const lastSubscription = await stripe.subscriptions.retrieve(lastpayment.transactionId);
    if (lastSubscription && lastSubscription.status === 'active') {
      if (new Date() < new Date(lastSubscription.current_period_end * 1e3)) alreadyPaid = true;
    }
  } else if (lastpayment && lastpayment.paymentMethod === 'paypal') {
    const lastSubscription = await axios.get(
      `${process.env.PAYPAL_URL}/v1/billing/subscriptions/${lastpayment.transactionId}`,
      {
        headers: {
          Authorization: `Basic ${encodedToken}`,
          'content-type': 'application/json',
        },
      }
    );
    if (lastSubscription && lastSubscription.data.status === 'ACTIVE') {
      if (new Date() < new Date(lastSubscription.data.billing_info.next_billing_time)) {
        alreadyPaid = true;
      }
    }
  }

  if (paymentMethod === 'stripe') {
    //with this we will check if user is already our customer;
    let lastStripePayment = await PaymentModal.findOne({
      $and: [{ userId: req.user._id }, { paymentMethod: 'stripe' }],
    });
    if (lastStripePayment && paymentMethod === lastStripePayment.paymentMethod) {
      customer = lastStripePayment.customerId;
    } else {
      let newCustomer = await stripe.customers.create({
        email: req.user.email,
        source: token.id,
      });
      customer = newCustomer.id;
    }
    let priceId =
      tenure === 'year' ? subcription.stripeYearlyPlanId : subcription.stripeMonthlyPlanId;
    const stripeSubcription = await stripe.subscriptions.create({
      customer: customer,
      items: [{ price: priceId }],
      payment_behavior: 'error_if_incomplete',
      billing_cycle_anchor: parseInt(Date.now() / 1000),
      metadata: {
        userId: `${req.user._id}`,
        subcriptionId: `${subcriptionId}`,
        tenure: tenure,
      },
    });

    if (!stripeSubcription) return next(new AppError('Error in activating subcriptions', 402));
    transactionId = stripeSubcription.id;
    createdAt = new Date(stripeSubcription.current_period_start * 1e3);
    expireTime = new Date(stripeSubcription.current_period_end * 1e3);
  } else if (paymentMethod === 'paypal') {
    // if (lastpayment && paymentMethod === lastpayment.paymentMethod) {
    //   customer = lastpayment.customerId;
    // }
    // let body = {
    //   plan_id:
    //     tenure === 'year'
    //       ? subcription.paypalYearlyPlanId
    //       : subcription.paypalMonthlyPlanId,
    //   start_time: new Date(),
    //   subscriber: {
    //     name: {
    //       given_name: req.user.userName,
    //     },
    //     email_address: req.user.email,
    //   },
    // };
    // if (customer !== null) {
    //   body.subscriber.payer_id = customer;
    // }
    // const paypalSubcription = await axios.post(
    //   `${process.env.PAYPAL_URL}/v1/billing/subscriptions`,
    //   body,
    //   {
    //     headers: {
    //       Authorization: `Basic ${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET_KEY}`,
    //       'content-type': 'application/json',
    //     },
    //   }
    // );
    // if (!paypalSubcription)
    //   return next(new AppError('Error in activating subcriptions', 402));
    // transactionId = paypalSubcription.id;
    //createdAt = new Date(stripeSubcription.current_period_start * 1e3);
    // expireTime = new Date(stripeSubcription.current_period_end * 1e3);

    const sub = await axios.get(`${process.env.PAYPAL_URL}/v1/billing/subscriptions/${token}`, {
      headers: {
        Authorization: `Basic ${encodedToken}`,
        'content-type': 'application/json',
      },
    });
    if (!sub) {
      return next(new AppError('requested Subcription not found on paypal', 404));
    }

    if (sub.data.status !== 'ACTIVE') {
      return next(new AppError('Subcription not activated! Activate Subcription to continue', 404));
    }
    console.log(sub.data);
    customer = sub.data.subscriber.payer_id;
    transactionId = sub.data.id;
    createdAt = new Date(sub.data.start_time);
    expireTime = new Date(sub.data.billing_info.next_billing_time);
  }

  let doc = await PaymentModal.create({
    paymentMethod: paymentMethod,
    tenure: tenure,
    userId: req.user._id,
    subcriptionId: subcriptionId,
    customerId: customer,
    transactionId: transactionId,
    createdAt: createdAt,
    //expireTime: expireTime,
    // createdAt: paymentIntent.current_period_start
    //   ? new Date(paymentIntent.current_period_start * 1e3)
    //   : new Date(),
    // expireTime: paymentIntent.current_period_end
    //   ? new Date(paymentIntent.current_period_end * 1e3)
    //   : paymentIntent.metadata.tenure === 'year'
    //   ? today.setDate(today.getDate() + 360)
    //   : today.setDate(today.getDate() + 30),
  });

  //if the user already have plan cancel it
  if (alreadyPaid) {
    let cancelStatus = await cancelSubcriptionAPI(
      'Purchased new plan',
      lastpayment.paymentMethod,
      lastpayment.transactionId
    );
    if (!cancelStatus) {
      console.log(
        'Error',
        'Purchased new plan',
        lastpayment.paymentMethod,
        lastpayment.transactionId
      );
      const homepage = process.env.APP_URL;
      await new Email(
        req.user,
        homepage,
        homepage,
        subcription.name + '-' + lastpayment.transactionId
      ).sendCancelSubcription();
    }
  }
  res.status(200).json({
    status: 'success',
    data: {
      paid: true,
      expireTime,
    },
  });
});

exports.stripeWebHook = catchAsync(async (req, res, next) => {
  let event;
  const sig = req.headers['stripe-signature'];

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK);
  } catch (err) {
    console.log('error in webhook signature', err);
    return next(new AppError(`Webhook Error: ${err.message}`, 400));
  }

  switch (event.type) {
    case 'invoice.created':
      const paymentIntent = event.data.object;
      // const subscriptions = await stripe.subscriptions.list({
      //   customer: paymentIntent.customer,
      //   status: 'all',
      //   expand: ['data.default_payment_method'],
      // });
      console.log(paymentIntent.lines.data);
      var today = new Date();

      // let doc = await PaymentModal.create({
      //   paymentMethod: 'stripe',
      //   tenure: paymentIntent.metadata.tenure,
      //   userId: paymentIntent.metadata.userId,
      //   subcriptionId: paymentIntent.metadata.subcriptionId,
      //   customerId: paymentIntent.customer,
      //   transactionId: paymentIntent.id,
      //   createdAt: paymentIntent.current_period_start
      //     ? new Date(paymentIntent.current_period_start * 1e3)
      //     : new Date(),
      //   expireTime: paymentIntent.current_period_end
      //     ? new Date(paymentIntent.current_period_end * 1e3)
      //     : paymentIntent.metadata.tenure === 'year'
      //     ? today.setDate(today.getDate() + 360)
      //     : today.setDate(today.getDate() + 30),
      // });

      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  res.json({ received: true });
});

exports.userSubcriptions = catchAsync(async (req, res, next) => {
  let paymentHistory = [];
  //we will find all payment from transactionId
  let payments = await PaymentModal.find({
    $query: {
      userId: req.user._id,
    },
    $orderby: { $natural: -1 },
  }).populate('subcriptionId');

  let paypalPayments = payments.filter((p) => p.paymentMethod === 'paypal');
  let stripePayments = payments.filter((p) => p.paymentMethod === 'stripe');

  if (stripePayments && stripePayments.length > 0) {
    let customer = stripePayments[0].customerId;
    // const subscriptions = await stripe.subscriptions.list({
    //   customer,
    //   status: 'all',
    // });
    const invoices = await stripe.invoices.list({
      customer,
    });

    if (invoices && invoices.data) {
      invoices.data.map((x) => {
        let subcriptionPayment = stripePayments.find((s) => s.transactionId === x.subscription);

        paymentHistory.push({
          date: new Date(x.created * 1e3),
          paymentId: x.payment_intent,
          subcriptionId: x.subscription,
          subscription: subcriptionPayment.subcriptionId,
          tenure: subcriptionPayment.tenure,
          type: 'recurring',
          paymentMethod: 'stripe',
          invoicePdf: x?.invoice_pdf,
          hosted_invoice_url: x?.hosted_invoice_url,
          number: x?.number,
        });
      });
    }
  }
  if (paypalPayments && paypalPayments.length > 0) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 10);

    await Promise.all(
      paypalPayments.map(async (p) => {
        const sub = await axios.get(
          `${process.env.PAYPAL_URL}/v1/billing/subscriptions/${
            p.transactionId
          }/transactions?start_time=${d.toISOString()}&end_time=${new Date().toISOString()}`,
          {
            headers: {
              Authorization: `Basic ${encodedToken}`,
              'content-type': 'application/json',
            },
          }
        );
        if (sub) {
          sub.data.transactions.map((t) => {
            paymentHistory.push({
              date: new Date(t.time),
              subcriptionId: p.transactionId,
              subscription: p.subcriptionId,
              tenure: p.tenure,
              type: 'recurring',
              paymentMethod: 'paypal',
              paymentId: t.id,
              time: t.time,
              payer_email: t.payer_email,
              name: t.payer_name.given_name + ' ' + t.payer_name.surname,
              amount:
                t.amount_with_breakdown.gross_amount.value +
                t.amount_with_breakdown.gross_amount.currency_code,
              status: t.status,
            });
          });
        }
      })
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      paymentHistory,
    },
  });
});
exports.userSubcription = catchAsync(async (req, res, next) => {
  let lastpayment = await PaymentModal.findOne({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .populate('subcriptionId');

  let paid = false;
  if (lastpayment && lastpayment.paymentMethod === 'stripe') {
    const subscription = await stripe.subscriptions.retrieve(lastpayment.transactionId);
    if (subscription) {
      paid = true;
      lastpayment = {
        ...lastpayment._doc,
        expireTime: new Date(subscription.current_period_end * 1e3),
      };
    } else {
      paid = false;
    }
  } else if (lastpayment && lastpayment.paymentMethod === 'paypal') {
    const sub = await axios.get(
      `${process.env.PAYPAL_URL}/v1/billing/subscriptions/${lastpayment.transactionId}`,
      {
        headers: {
          Authorization: `Basic ${encodedToken}`,
          'content-type': 'application/json',
        },
      }
    );

    if (sub && sub.data.status === 'ACTIVE') {
      paid = true;

      lastpayment = {
        ...lastpayment._doc,
        expireTime: new Date(sub.data.billing_info.next_billing_time),
      };
    } else {
      paid = false;
    }
  } else {
    paid = false;
  }
  res.status(200).json({
    status: 'success',
    data: {
      paid,
      lastpayment,
    },
  });
});

const cancelSubcriptionAPI = async (reason, paymentMethod, subcriptionId) => {
  try {
    if (paymentMethod === 'stripe') {
      const stripeSubcription = await stripe.subscriptions.del(subcriptionId);
      if (!stripeSubcription || stripeSubcription.status !== 'canceled') {
        return false;
      }
    } else if (paymentMethod === 'paypal') {
      const paypalSubcription = await axios.post(
        `${process.env.PAYPAL_URL}/v1/billing/subscriptions/${subcriptionId}/cancel`,
        { reason },
        {
          headers: {
            Authorization: `Basic ${encodedToken}`,
            'content-type': 'application/json',
          },
        }
      );
      if (paypalSubcription.status !== 204) {
        return false;
      }
    } else {
      return false;
    }
    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
};

exports.cancelSubcription = catchAsync(async (req, res, next) => {
  const { reason } = req.body;

  let lastpayment = await PaymentModal.findOne({ userId: req.user._id }).sort({
    createdAt: -1,
  });

  if (lastpayment) {
    let sub = await cancelSubcriptionAPI(
      reason,
      lastpayment.paymentMethod,
      lastpayment.transactionId
    );

    if (!sub) {
      return next(new AppError('Unable to Cancel Subcription', 500));
    }
  }
  res.status(200).json({
    status: 'success',
  });
});

exports.getPaypalInvoice = catchAsync(async (req, res, next) => {
  try {
    const d = new Date(req.body.time);
    //console.log(d);
    d.setMonth(d.getMonth() - 1);
    // const transaction = await axios.get(
    //   `${
    //     process.env.PAYPAL_URL
    //   }/v1/reporting/transactions?start_date=${d.toISOString()}&end_date=${new Date().toISOString()}`,
    //   {
    //     headers: {
    //       Authorization: `Basic ${encodedToken}`,
    //       'content-type': 'application/json',
    //     },
    //   }
    // );
    const transaction = await axios.get(
      `${process.env.PAYPAL_URL}/v2/checkout/orders/${req.body.paymentId}`,
      {
        headers: {
          Authorization: `Basic ${encodedToken}`,
          'content-type': 'application/json',
        },
      }
    );
    console.log(transaction.data, req.body.paymentId, req.body.time);
  } catch (err) {
    console.log(err);
  }

  // console.log(transaction);
  // if (!transaction || !transaction.data) {
  //   return next(new AppError('Unable to find transaction', 404));
  // }

  // const invoice = await axios.post(
  //   `${process.env.PAYPAL_URL}/v2/invoicing/search-invoices`,
  //   {
  //     recipient_email: req.body.payer_email,
  //   },
  //   {
  //     headers: {
  //       Authorization: `Basic ${encodedToken}`,
  //       'content-type': 'application/json',
  //     },
  //   }
  // );
  // console.log(invoice.data);
  // if (!invoice && !invoice.data) {
  //   return next(new AppError('Unable to find transaction', 404));
  // }

  console.log(transaction.data);
  res.status(200).json({
    status: 'success',
    data: {
      transactions: transaction,
      // invoicePdf: invoice?.data.details.metadata.invoicer_view_url,
      // hosted_invoice_url: invoice?.data.details.metadata.recipient_view_url,
      // number: invoice.data.details.invoice_number,
    },
  });
});
