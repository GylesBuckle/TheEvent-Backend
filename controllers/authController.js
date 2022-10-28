const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const Roles = require('../models/roles');
const PaymentsModal = require('../models/paymentsModal');

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/emails');
const { default: axios } = require('axios');
const path = require('path');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createLoginToken = async (user, statusCode, req, res) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
  const cookieOptions = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    // secure: true,//only https
    httpOnly: true, //to prevent xss
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);
  user.password = undefined; //not saving

  res.status(statusCode).json({
    success: true,
    token,
    data: {
      user,
    },
  });
};

//This route is only for User Registeration
exports.signUp = catchAsync(async (req, res, next) => {
  const roleId = await Roles.findOne({ name: 'User' });

  if (!roleId) return next(new AppError('Sorry! Application is not ready to register Users', 500));

  let newUser = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: req.body.password,
    roles: [roleId._id],
  });
  if (!newUser) {
    return next(new AppError('There was an error in registering user, Try Again Later', 500));
  }
  res.status(200).json({
    success: true,
    data: {
      newUser,
    },
  });
});

exports.signUpAdmin = async () => {
  let u = await User.countDocuments({ email: process.env.email });
  if (u === 0) {
    const roleId = await Roles.findOne({ name: 'Super Admin' });
    if (!roleId)
      return {
        error: true,
        status: 500,
        message: 'Sorry! Application is not ready to register Userss',
      };

    let newUser = {
      firstName: process.env.firstName,
      lastName: process.env.lastName,
      email: process.env.email,
      password: process.env.password,
      roles: [roleId._id],
    };
    newUser = await User.create(newUser);
    if (!newUser) {
      return {
        error: true,
        status: 500,
        message: 'server unable to read this request',
      };
    }
  }

  return {
    error: false,
  };
};
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError('Please Provide Email and password', 400));
  }
  const user = await User.findOne({ email })
    .select('+password')
    .select('+emailVerified')
    .populate('roles')
    .populate({
      path: 'profiles',
      populate: {
        path: 'companyId',
        match: { _id: { $exists: true } },
      },
    })
    .populate('portfolio')
    .populate('meetings');
  //Comparing password
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect Email or password', 401));
  } else if (!user || user.emailVerified === false) {
    return next(new AppError('Email not verified yet', 401));
  } else if (!user || user.active === false) {
    return next(new AppError('User is blocked or deleted', 401));
  }

  //finding user alerts

  createLoginToken(
    { ...user._doc, external: false, roles: user.roles.map((x) => x.name) },
    200,
    req,
    res
  );
});

exports.externalLogin = catchAsync(async (req, res, next) => {
  const { token, method } = req.body;
  let ticket = null;
  let name = undefined;
  let email = undefined;

  if (method === 'google') {
    let tokenFromCode = await client.getToken(token);

    ticket = await client.verifyIdToken({
      idToken: tokenFromCode.tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    let u = ticket.getPayload();
    name = u.name;
    email = u.email;
  } else {
    return next(new AppError('Invalid data recieved from client', 422));
  }

  if (!name || !email) return next(new AppError('Invalid data recieved from client', 422));
  const user = await User.findOne({ email }).populate('roles');

  if (user) {
    createLoginToken(
      { ...user._doc, external: true, roles: user.roles.map((x) => x.name) },
      200,
      req,
      res
    );
  } else {
    const roleId = await Roles.findOne({ name: 'User' });
    if (!roleId)
      return next(new AppError('Sorry! Application is not ready to register Userss', 500));

    let newUser = {
      firstName: name,
      email: email,
      emailVerified: true,
      roles: [roleId._id],
    };

    newUser = new User(newUser);

    newUser = await newUser.save({ validateBeforeSave: false });

    createLoginToken({ ...newUser._doc, roles: [roleId.name] }, 200, req, res);
  }
});
exports.validateUser = catchAsync(async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
});
exports.forgotPassword = catchAsync(async (req, res, next) => {
  let { email } = req.body;
  //Get User Based on Email
  const user = await User.findOne({
    email: email,
  });

  if (!user) {
    return next(new AppError('There is No User with These Email', 404));
  }

  //Generate Random Token
  const resetToken = user.createResetPasswordToken();
  await user.save({ validateBeforeSave: false }); //Saving only 2 Fields

  //Sending Email
  const resettoken = `${process.env.APP_URL}/resetPassword/${resetToken}`;
  const homepage = `${process.env.APP_URL}`;
  try {
    await new Email(user, resettoken, homepage).sendPasswordReset();
    res.status(200).json({
      success: true,
      message: 'Token Sent to Email',
    });
  } catch (err) {
    console.log(err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('There was an error sending an email, Try Again Later', 500));
  }
});
exports.resetPassword = catchAsync(async (req, res, next) => {
  //Comparing Token
  const hashToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) return next(new AppError('Token is Invalid or expired', 400));

  //Updating Field if there token verifies
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  this.changedPasswordAt = Date.now() - 1000;
  await user.save({ validateBeforeSave: false });
  //update passwordChangedAt property
  //Login To the User
  res.status(200).json({
    success: true,
    message: 'Password Change Success! Login to continue',
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  let id = req.user._id;

  //1 Get User From Collection
  const user = await User.findById(id).select('+password');
  //2 Check If Posted Current Password is Correct
  if (!user || !(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your Current Password is Wrong', 401));
  }

  //3 If So, Update Password
  user.password = req.body.password;
  await user.save(); //User.findByIdAndUpdate will not work here
  //4 Log User in,send JWT
  res.status(200).json({
    success: true,
    message: 'Password Changed Successfully',
  });
  //createLoginToken(user, 200, req, res);
});
