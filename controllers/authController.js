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
const encodedToken = Buffer.from(
  `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET_KEY}`
).toString('base64');

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
  user.emailVerified = undefined;

  let freshUser = {
    ...user,
  };

  //checking if user is paid
  let lastpayment = await PaymentsModal.findOne({ userId: freshUser._id }).sort({ createdAt: -1 });
  if (lastpayment && lastpayment.paymentMethod === 'stripe') {
    const subscription = await stripe.subscriptions.retrieve(lastpayment.transactionId);
    if (subscription && subscription.status === 'active') {
      freshUser.paid = true;
      freshUser.expireTime = new Date(subscription.current_period_end * 1e3);
    } else {
      freshUser.paid = false;
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
      freshUser.paid = true;
      freshUser.expireTime = new Date(sub.data.billing_info.next_billing_time);
    } else {
      freshUser.paid = false;
    }
  } else {
    freshUser.paid = false;
  }

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: freshUser,
    },
  });
};

//This route is only for User Registeration
exports.signUp = catchAsync(async (req, res, next) => {
  const roleIds = await Roles.find({ $or: [{ name: 'User' }, { name: 'Company' }] });

  if (
    !req.body.accountType ||
    !(req.body.accountType === 'Individual' || req.body.accountType === 'Business')
  ) {
    return next(new AppError('Invalid Account Type', 500));
  }
  if (roleIds.length === 0)
    return next(new AppError('Sorry! Application is not ready to register Users', 500));

  let newUser = {
    name: req.body.userName,
    userName: req.body.userName.toLowerCase(),
    email: req.body.email,
    password: req.body.password,
    roles:
      req.body.accountType === 'Individual'
        ? [roleIds.find((x) => x.name === 'User')._id]
        : [roleIds.find((x) => x.name === 'Company')._id],
  };

  newUser = await User.create(newUser);
  //Generate Random Token
  const verifcationToken = newUser.createEmailVerificationToken();
  await newUser.save({ validateBeforeSave: false }); //Saving only 2 Fie

  const url = process.env.APP_URL + '/verifyUser/' + verifcationToken;
  try {
    await new Email(newUser, url).sendEmailVerification();
    res.status(200).json({
      status: 'success',
      message: 'Token Sent to Email',
    });
  } catch (err) {
    console.log(err);
    await User.findByIdAndDelete(newUser._id);
    return next(new AppError('There was an error sending an email, Try Again Later', 500));
  }
});
//This route is only for Employee Registeration
exports.addEmployee = catchAsync(async (req, res, next) => {
  const roleId = await Roles.findOne({ name: 'Employee' });
  let pass = req.body.password;
  if (!roleId)
    return next(new AppError('Sorry! Application is not ready to register Employee', 500));

  let newUser = {
    employeeData: {
      title: req.body.title,
      firstName: req.body.firstName,
      middleName: req.body.middleName,
      lastName: req.body.lastName,
      primaryEmail: req.body.primaryEmail,
      primaryPhone: req.body.primaryPhone,
      password: req.body.password,
    },
    userName: req.body.userName.toLowerCase(),
    email: req.body.email,
    password: req.body.password,
    createdBy: req.user._id,
    roles: [roleId._id],
  };

  newUser = await User.create(newUser);
  //Generate Random Token
  const verifcationToken = newUser.createEmailVerificationToken();
  await newUser.save({ validateBeforeSave: false }); //Saving only 2 Fie

  const url = process.env.APP_URL + '/verifyUser/' + verifcationToken;
  try {
    await new Email(newUser, url).sendEmailVerification(pass);
    res.status(200).json({
      status: 'success',
      message: 'Token Sent to Email',
      data: {
        doc: newUser,
      },
    });
  } catch (err) {
    console.log(err);
    await User.findByIdAndDelete(newUser._id);
    return next(new AppError('There was an error sending an email, Try Again Later', 500));
  }
});

//This route is only for Employee Registeration
exports.resendEmployeeVerificationEmail = catchAsync(async (req, res, next) => {
  let doc = await User.findById(req.params.id).populate('roles');
  if (!doc) return next(new AppError('User not found', 404));

  if (doc.roles.some((x) => x.name !== 'Employee') || !req.user._id.equals(doc.createdBy)) {
    return next(new AppError('Access Denied', 422));
  }

  //Generate Random Token
  const verifcationToken = doc.createEmailVerificationToken();
  if (!doc.employeeData.password) {
    doc.password = req.body.password;
  }
  await doc.save({ validateBeforeSave: false }); //Saving only 2 Fie

  const url = process.env.APP_URL + '/verifyUser/' + verifcationToken;
  try {
    await new Email(doc, url).sendEmailVerification(
      doc.employeeData.password ? doc.employeeData.password : req.body.password
    );
    res.status(200).json({
      status: 'success',
      message: 'Token Sent to Email',
    });
  } catch (err) {
    console.log(err);
    return next(new AppError('There was an error sending an email, Try Again Later', 500));
  }
});
const registerDefaultProfile = async (user) => {
  let newProfile = {
    firstName: user.userName,
    primaryEmail: user.email,
  };

  if (user.roles.some((r) => r.name === 'Employee')) {
    const companyOwner = await User.findById(user.createdBy).populate('profiles');
    let companyProfile = companyOwner.profiles.find((p) => p.type.url === '/');

    newProfile.companyId = companyProfile._id;
    newProfile.title = user.employeeData.title;
    newProfile.firstName = user.employeeData.firstName;
    newProfile.middleName = user.employeeData.middleName;
    newProfile.lastName = user.employeeData.lastName;
    newProfile.primaryEmail = user.employeeData.primaryEmail;
    newProfile.primaryPhone = user.employeeData.primaryPhone;
    newProfile.company = companyProfile.company;
  }
  newProfile = await Profile.create(newProfile);
  return newProfile;
};
exports.verifyEmail = catchAsync(async (req, res, next) => {
  //Comparing Token
  const hashToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    emailVerificationToken: hashToken,
    emailVerificationExpires: { $gt: Date.now() },
  }).populate('roles');
  if (!user) return next(new AppError('Token is Invalid or expired', 400));
  //Updating Field if there token verifies
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  let generalProfile = await registerDefaultProfile(user);
  user.profiles = [generalProfile._id];
  user.employeeData = undefined;
  user.activeProfile = generalProfile._id;
  await user.save({ validateBeforeSave: false });

  const homepage = process.env.APP_URL;
  try {
    await new Email(user, homepage, homepage).sendWelcome();

    //await new Email(newUser, url).sendWelcome();
    res.status(200).json({
      status: 'success',
      message: 'Email Veification Sucessful! Login To continue',
    });
  } catch (err) {
    console.log(err);
    return next(new AppError('There was an error sending an email, Try Again Later', 500));
  }
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
      name: process.env.name,
      userName: process.env.userName,
      email: process.env.email,
      password: process.env.password,
      emailVerified: true,
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

exports.validateUser = catchAsync(async (req, res, next) => {
  //finding user alerts

  let freshUser = {
    ...req.user,
  };

  //checking if user is paid
  let lastpayment = await PaymentsModal.findOne({ userId: freshUser._id }).sort({ createdAt: -1 });
  if (lastpayment && lastpayment.paymentMethod === 'stripe') {
    const subscription = await stripe.subscriptions.retrieve(lastpayment.transactionId);

    if (subscription && subscription.status === 'active') {
      freshUser.paid = true;
      freshUser.expireTime = new Date(subscription.current_period_end * 1e3);
    } else {
      freshUser.paid = false;
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
      freshUser.paid = true;
      freshUser.expireTime = new Date(sub.data.billing_info.next_billing_time);
    } else {
      freshUser.paid = false;
    }
  } else {
    freshUser.paid = false;
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: freshUser,
    },
  });
});
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

const getClientSecret = () => {
  // sign with RSA SHA256
  const privateKey = fs.readFileSync(path.join(__dirname, './AuthKey_N6GH957HBP.p8'));
  const headers = {
    kid: process.env.KEY_ID,
    typ: undefined, // is there another way to remove type?
  };
  const claims = {
    iss: process.env.TEAM_ID,
    aud: 'https://appleid.apple.com',
    sub: process.env.CLIENT_ID,
  };
  token = jwt.sign(claims, privateKey, {
    algorithm: 'ES256',
    header: headers,
    expiresIn: '24h',
  });
  return token;
};

exports.externalLogin = catchAsync(async (req, res, next) => {
  const { token, method } = req.body;
  let ticket = null;
  let name = undefined;
  let email = undefined;
  let google_refresh_token = undefined;
  let google_email = undefined;
  if (method === 'google') {
    let tokenFromCode = await client.getToken(token);
    if (tokenFromCode.tokens.scope.includes('https://www.googleapis.com/auth/calendar')) {
      google_refresh_token = tokenFromCode.tokens.refresh_token;
    }

    ticket = await client.verifyIdToken({
      idToken: tokenFromCode.tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    let u = ticket.getPayload();
    name = u.name;
    email = u.email;
    google_email = u.email;
  } else if (method === 'facebook') {
    const data = await axios.get(
      `https://graph.facebook.com/me?access_token=${encodeURIComponent(token)}&fields=id,name,email`
    );
    name = data.data.name;
    email = data.data.email;
  } else if (method === 'apple') {
    const clientSecret = getClientSecret();
    const requestBody = {
      grant_type: 'authorization_code',
      code: token,
      redirect_uri: process.env.REDIRECT_URI,
      client_id: process.env.CLIENT_ID,
      client_secret: clientSecret,
      scope: 'name,email',
    };

    let response = await axios.post(
      'https://appleid.apple.com/auth/token',
      JSON.stringify(requestBody),
      {
        header: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    name = response.data.name;
    email = response.data.email;
  } else {
    return next(new AppError('Invalid data recieved from client', 422));
  }

  if (!name || !email) return next(new AppError('Invalid data recieved from client', 422));
  const user = await User.findOne({ email })
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
      name: name,
      userName: email,
      email: email,
      emailVerified: true,
      roles: [roleId._id],

      google_refresh_token: google_refresh_token,
      google_email: google_email,
    };

    let generalProfile = await registerDefaultProfile({
      ...newUser,
      roles: [roleId],
    });
    newUser.activeProfile = generalProfile._id;
    newUser.profiles = [generalProfile._id];
    newUser = new User(newUser);

    newUser = await newUser.save({ validateBeforeSave: false });

    createLoginToken({ ...newUser._doc, roles: [roleId.name] }, 200, req, res);
  }
});
exports.forgotPassword = catchAsync(async (req, res, next) => {
  let { email } = req.body;
  //Get User Based on Email
  const user = await User.findOne({
    $or: [{ email: email }, { userName: email }],
  });

  if (!user) {
    return next(new AppError('There is No User with These Email', 404));
  }
  if (!user.active) {
    return next(new AppError('Sorry! User is not allowed to Login', 500));
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
      status: 'success',
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
  if (user && user.password != user.confirmPassword)
    return next(new AppError('Password and Confirm Password does not match', 400));
  //Updating Field if there token verifies
  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  this.changedPasswordAt = Date.now() - 1000;
  await user.save({ validateBeforeSave: false });
  //update passwordChangedAt property
  //Login To the User
  res.status(200).json({
    status: 'success',
    message: 'Password Change Success! Login to continue',
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  let id = req.user._id;
  if (req.user.roles.some((x) => x === 'Company') && req.body.employeeId) {
    //validating employee of company
    let u = await User.findById(req.body.employeeId);
    if (!req.user._id.equals(u.createdBy)) {
      return next(new AppError('Access Denied', 403));
    }
    id = req.body.employeeId;
  }
  //1 Get User From Collection
  const user = await User.findById(id).select('+password');
  //2 Check If Posted Current Password is Correct
  if (!user || !(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your Current Password is Wrong', 401));
  }

  //3 If So, Update Password
  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  await user.save(); //User.findByIdAndUpdate will not work here
  //4 Log User in,send JWT
  res.status(200).json({
    status: 'success',
    message: 'Password Changed Successfully',
  });
  //createLoginToken(user, 200, req, res);
});
module.exports.registerDefaultProfile = registerDefaultProfile;
