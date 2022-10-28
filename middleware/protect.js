const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const PaymentsModal = require('../models/paymentsModal');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

//To Check whether user is login or not
module.exports = catchAsync(async (req, res, next) => {
  //1 getting Token and check if there
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return next(new AppError('You are not logged in', 401));
  }
  //verifying Token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  //checking User Really Exist
  const freshUser = await User.findById(decoded.id).select('+password').populate('roles');

  if (!freshUser)
    return next(new AppError('The User Belonging to this Token does no longer Exist', 401));

  let finalUser = {
    ...freshUser._doc,
    external: !freshUser.password,
    password: undefined,
    roles: freshUser.roles.map((x) => x.name),
  };

  req.user = finalUser;
  next(); //Allowing Access to
});
