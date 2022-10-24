const mongoose = require('mongoose');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const User = require('../models/userModel');

//To filter Some fields from req.body so we can update only these fields
const filterObj = (obj, ...allowed) => {
  const newObj = {};
  Object.keys(obj).filter((el) => {
    if (allowed.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = catchAsync(async (req, res, next) => {
  req.params.id = req.user.id;
  next();
});

exports.updateUsername = catchAsync(async (req, res, next) => {
  //1) Create error if user Post Password
  if (req.body.password || req.body.confirmPassword) {
    return next(new AppError('This route is not for Updating Password', 400));
  }
  //update User Document
  const filterBody = filterObj(req.body, 'userName'); //filtering unwanted Field
  filterBody.userName = filterBody.userName.toLowerCase();

  let id = req.user._id;
  if (req.user.roles.some((x) => x === 'Company') && req.body.employeeId) {
    //validating employee of company
    let u = await User.findById(req.body.employeeId);
    if (!req.user._id.equals(u.createdBy)) {
      return next(new AppError('Access Denied', 403));
    }
    id = req.body.employeeId;
  }
  const updatedUser = await User.findByIdAndUpdate(id, filterBody, {
    new: true,
    runValidators: true,
  });
  if (!updatedUser) {
    return next(new AppError('requested User not found', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});
exports.updateActiveProfile = catchAsync(async (req, res, next) => {
  //1) Create error if user Post Password
  if (req.body.password || req.body.confirmPassword) {
    return next(new AppError('This route is not for Updating Password', 400));
  }
  //update User Document
  const filterBody = filterObj(req.body, 'activeProfile'); //filtering unwanted Field

  const updatedUser = await User.findByIdAndUpdate(req.user._id, filterBody, {
    new: true,
    runValidators: true,
  });
  if (!updatedUser) {
    return next(new AppError('requested User not found', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});
exports.getUser = catchAsync(async (req, res, next) => {
  let doc = await User.findById(req.params.id);
  if (!doc) return next(new AppError('requested Id not found', 404));

  res.status(200).json({
    status: 'success',
    data: { doc },
  });
});
exports.getUsers = catchAsync(async (req, res, next) => {
  let doc = await User.find({}).populate('roles', 'name');

  res.status(200).json({
    status: 'success',
    data: { doc },
  });
});

exports.getCompanyUsers = catchAsync(async (req, res, next) => {
  const page = req.query.page || 1;
  const itemsPerPage = req.query.itemsPerPage || 8;
  const search = req.query.search || '';

  let total = await User.countDocuments({
    $and: [
      // { emailVerified: true },
      { createdBy: req.user._id },
      { userName: { $regex: search, $options: 'i' } },
    ],
  });

  let doc = await User.find({
    $and: [
      // { emailVerified: true },
      { createdBy: req.user._id },
      { userName: { $regex: search, $options: 'i' } },
    ],
  })
    .sort({ createdAt: 'descending' })
    .populate('profiles', '_id title firstName middleName lastName image')
    .skip((page - 1) * parseInt(itemsPerPage))
    .limit(parseInt(itemsPerPage));

  res.status(200).json({
    status: 'success',
    data: { doc, total },
  });
});

exports.getEmployee = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .populate('roles')
    .populate({
      path: 'profiles',
      populate: {
        path: 'companyId',
        match: { _id: { $exists: true } },
      },
    });
  if (!user) {
    return next(new AppError('Profile not found', 404));
  }
  if (user.roles.some((x) => x.name !== 'Employee') || !req.user._id.equals(user.createdBy)) {
    return next(new AppError('Access denied', 403));
  }

  res.status(200).json({
    status: 'success',
    data: {
      doc: {
        ...user._doc,
        roles: user.roles.map((x) => x.name),
      },
    },
  });
});
exports.deleteEmployee = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).populate('roles');
  if (!user) {
    return next(new AppError('Requested Id not found', 404));
  }
  if (user.roles.some((x) => x.name !== 'Employee') || !req.user._id.equals(user.createdBy)) {
    return next(new AppError('Access denied', 403));
  }

  const doc = await User.findByIdAndDelete(req.params.id);
  if (!doc) {
    return next(new AppError('Requested Id not found', 404));
  }
  await Profile.deleteMany({ _id: user.profiles });
  await ProfileViews.deleteMany({ employeeId: req.params.id });
  res.status(204).json({
    status: 'success',
    data: 'deleted Successfully',
  });
});
//Do not Update Password with this
exports.updateUser = catchAsync(async (req, res, next) => {
  let user = {};
  user.name = req.body.name;
  user.email = req.body.email;
  if (req.file) user.photo = req.file.filename;
  const doc = await User.findByIdAndUpdate(req.params.id, user, {
    new: true,
    runValidators: true,
  });
  if (!doc) {
    return next(new AppError('requested Id not found', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      doc,
    },
  });
});

exports.delete = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).populate('roles');
  if (user && user.roles.some((x) => x.name === 'Super Admin')) {
    return next(new AppError('Access denied', 403));
  }
  if (
    user &&
    user.roles.some((x) => x.name === 'Admin') &&
    !req.user.roles.some((x) => x.name === 'Super Admin')
  ) {
    return next(new AppError('Access denied', 403));
  }
  const doc = await User.findByIdAndDelete(req.params.id);
  if (!doc) {
    return next(new AppError('Requested Id not found', 404));
  }
  res.status(204).json({
    status: 'success',
    data: 'deleted Successfully',
  });
});
exports.activateTrail = catchAsync(async (req, res, next) => {
  let user = await User.findById(req.user._id);

  if (user) {
    if (user.trailTaken) return next(new AppError('Trail already expire', 403));
    var date = new Date();
    if (process.env.trailDay) {
      date.setDate(date.getDate() + parseInt(process.env.trailDay));
    } else {
      date.setDate(date.getDate() + 7);
    }

    let newdoc = await User.findByIdAndUpdate(
      req.user._id,
      {
        trailTaken: true,
        trailTime: date,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        doc: newdoc,
      },
    });
  } else {
    return next(new AppError('requested Id not found', 404));
  }

  return next(new AppError('requested user not found', 404));
});

exports.additionalTrail = catchAsync(async (req, res, next) => {
  let user = await User.findById(req.params.id);

  if (user) {
    var date = new Date();
    date.setDate(date.getDate() + req.body.additionalDays);

    var newdoc = new User(user);
    newdoc.trailTime = date;
    await newdoc.save();
    await Notifications.create({
      message: `Congratulations! You got ${req.body.additionalDays} days Additional trail. Cheers!`,
      userId: user._id,
    });
  } else {
    return next(new AppError('requested Id not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      doc,
    },
  });
});

exports.updateLifeTime = catchAsync(async (req, res, next) => {
  let { check } = req.body;
  let doc = await User.findByIdAndUpdate(req.params.id, {
    lifeTime: check,
  });
  if (!doc) return next(new AppError('requested Id not found', 404));

  if (check === true) {
    await Notifications.create({
      message:
        'Congratulations You got a lifetime Tag, You can access all lifetime products for free',
      userId: req.params.id,
    });
  }
  res.status(200).json({
    status: 'success',
    data: { doc },
  });
});

exports.addNotifications = catchAsync(async (req, res, next) => {
  let newNotification = {
    subject: req.body.subject,
    message: req.body.message,
    attachment: req.attachment ? req.attachment : undefined,
    by: req.user._id,
  };
  await Notifications.create(newNotification);

  res.status(200).json({
    status: 'success',
  });
});
exports.updateNotifications = catchAsync(async (req, res, next) => {
  await Notifications.update({ userId: req.user._id }, { $set: { read: true } });
  res.status(200).json({
    status: 'success',
  });
});

exports.createProfile = catchAsync(async (req, res, next) => {
  const { profileName } = req.body;

  if (req.user.profiles.length === 5) {
    return next(new AppError('Only 5 Profile allowed per Account', 403));
  }
  if (
    req.user.profiles.some((p) => {
      p.type.url.toLowerCase().replace(' ', '-') ===
        profileName.toString().toLowerCase().replace(' ', '-');
    })
  ) {
    return next(new AppError('Profile Url already exist', 403));
  }

  let newProfile = {
    type: {
      label: profileName,
      url: profileName.toLowerCase().replace(' ', '-'),
    },
    firstName: req.user.userName,
    primaryEmail: req.user.email,
  };
  newProfile = await Profile.create(newProfile);

  let user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $push: { profiles: newProfile._id },
    },
    {
      new: false,
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      doc: newProfile,
    },
  });
});

exports.addSubcriber = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  let s = await Subcribers.create({ email });

  res.status(200).json({
    status: 'success',
  });
});

exports.addPageView = catchAsync(async (req, res, next) => {
  const { userName } = req.body;
  const user = await User.findOne({ userName: userName }).populate('roles');

  if (!user) return next(new AppError('requested user not found', 404));

  let doc = { userId: user._id };
  if (user.roles.some((x) => x.name === 'Employee')) {
    doc.employeeId = user._id;
    doc.userId = user.createdBy;
  }
  await ProfileViews.create(doc);

  res.status(200).json({
    status: 'success',
  });
});

exports.addSocialClick = catchAsync(async (req, res, next) => {
  const { userName, socialName, socialId } = req.body;
  const user = await User.findOne({ userName: userName }).populate('roles');

  if (!user) return next(new AppError('requested user not found', 404));

  let doc = { userId: user._id, socialName, socialId };
  if (user.roles.some((x) => x.name === 'Employee')) {
    doc.userId = user.createdBy;
  }
  await SocialClick.create(doc);

  res.status(200).json({
    status: 'success',
  });
});

exports.addUserActivity = catchAsync(async (req, res, next) => {
  let doc = { userId: req.user._id };
  if (req.user.roles.some((x) => x === 'Employee')) {
    doc.userId = req.user.createdBy;
    doc.employeeId = req.user._id;
  }

  await UserActivity.create(doc);

  res.status(200).json({
    status: 'success',
  });
});
exports.getAnalytics = catchAsync(async (req, res, next) => {
  //SocialClick.find({userId: req.user._id})
  // let lastWeekClick = await SocialClick.aggregate([
  //   { $match: { userId: req.user._id } },
  //   {
  //     $match: {
  //       date: {
  //         $gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
  //       },
  //     },
  //   },
  //   { $group: { _id: '$socialId', count: { $count: {} } } },
  // ]);
  let click = await SocialClick.aggregate([
    {
      $facet: {
        weekly: [
          { $match: { userId: req.user._id } },
          {
            $match: {
              date: {
                $gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          },
          { $group: { _id: '$socialId', count: { $count: {} } } },
          {
            $group: {
              _id: null,
              result: {
                $push: {
                  name: '$_id',
                  count: '$count',
                },
              },
            },
          },
        ],
        monthly: [
          { $match: { userId: req.user._id } },
          {
            $match: {
              date: {
                $gte: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
          { $group: { _id: '$socialId', count: { $count: {} } } },
          {
            $group: {
              _id: null,
              result: {
                $push: {
                  name: '$_id',
                  count: '$count',
                },
              },
            },
          },
        ],
        yearly: [
          { $match: { userId: req.user._id } },
          {
            $match: {
              date: {
                $gte: new Date(new Date().getTime() - 360 * 24 * 60 * 60 * 1000),
              },
            },
          },
          { $group: { _id: '$socialId', count: { $count: {} } } },
          {
            $group: {
              _id: null,
              result: {
                $push: {
                  name: '$_id',
                  count: '$count',
                },
              },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        weekly: {
          $arrayElemAt: ['$weekly', 0],
        },
        monthly: {
          $arrayElemAt: ['$monthly', 0],
        },
        yearly: {
          $arrayElemAt: ['$yearly', 0],
        },
      },
    },
    {
      $addFields: {
        weekly: '$weekly.result',
        monthly: '$monthly.result',
        yearly: '$yearly.result',
      },
    },
  ]);

  let doc = [];
  if (click && click.length > 0) {
    if (click[0].weekly) {
      doc = click[0].weekly.map((s) => {
        return {
          name: s.name,
          week: s.count,
          month: click[0].monthly ? click[0].monthly.find((x) => x.name === s.name).count : 0,
          year: click[0].yearly ? click[0].yearly.find((x) => x.name === s.name).count : 0,
        };
      });
    } else if (click[0].monthly) {
      doc = click[0].monthly.map((s) => {
        return {
          name: s.name,
          week: click[0].weekly ? click[0].weekly.find((x) => x.name === s.name).count : 0,
          month: s.count,
          year: click[0].yearly ? click[0].yearly.find((x) => x.name === s.name).count : 0,
        };
      });
    } else if (click[0].yearly) {
      doc = click[0].yearly.map((s) => {
        return {
          name: s.name,
          week: click[0].weekly ? click[0].weekly.find((x) => x.name === s.name).count : 0,
          month: click[0].monthly ? click[0].monthly.find((x) => x.name === s.name).count : 0,
          year: s.count,
        };
      });
    }
  }
  res.status(200).json({
    status: 'success',
    data: {
      doc,
      //click: click && click.length > 0 ? click[0] : [],
    },
  });
});

exports.getReports = catchAsync(async (req, res, next) => {
  let companyProfile =
    req.user.profiles.find((p) => p._id === req.user?.activeProfile) || req.user?.profiles[0];

  let countries = await Profile.aggregate([
    {
      $match: {
        $and: [{ companyId: companyProfile._id }, { country: { $ne: null } }],
      },
    },
    {
      $group: {
        _id: '$country',
        count: { $count: {} },
      },
    },
    {
      $addFields: { country: '$_id' },
    },
    {
      $project: { _id: 0 },
    },
  ]);
  let click = await SocialClick.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: '$socialId', count: { $count: {} } } },
  ]);
  click = click.filter((soc) => companyProfile.social.find((x) => x.id === soc._id));
  let pageviewsEmployee = await ProfileViews.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: '$employeeId', count: { $count: {} } } },
  ]);

  let totalEmployees = await User.countDocuments({ createdBy: req.user._id });
  let totalSocialMedias = companyProfile.social.length;
  let totalCountries = countries.length;

  let top5Countries = countries.sort((a, b) => b.count - a.count).slice(0, 5);
  let top5SocialMedia = click.sort((a, b) => b.count - a.count).slice(0, 5);
  let top5Employee = pageviewsEmployee.sort((a, b) => b.count - a.count).slice(0, 5);

  if (top5Employee.length > 0) {
    let top5EmployeesData = await User.find({
      _id: { $in: top5Employee.filter((x) => x._id !== null).map((x) => x._id) },
    }).select('userName');

    top5Employee = top5Employee
      .filter((x) => x._id !== null)
      .map((x) => {
        return {
          count: x.count,
          _id: x._id,
          userName: top5EmployeesData.find((u) => u._id.equals(x._id)).userName,
        };
      });
  }

  res.status(200).json({
    status: 'success',
    data: {
      totalEmployees,
      totalSocialMedias,
      totalCountries,
      top5Countries,
      top5SocialMedia,
      top5Employee,
    },
  });
});

exports.getUserStats = catchAsync(async (req, res, next) => {
  var date = req.params.date ? new Date(req.params.date) : new Date();
  date.setHours(0, 0, 0, 0);
  // creates ObjectId() from date:
  var _id = Math.floor(date.getTime() / 1000).toString(16) + '0000000000000000';

  let users = await User.find({
    $and: [{ createdBy: req.user._id }, { _id: { $gte: mongoose.Types.ObjectId(_id) } }],
  }).populate('profiles', '_id title firstName middleName lastName image');

  //active users means users who login their account at least 5times in last 30 days
  let allEmployeesCount = await UserActivity.aggregate([
    { $match: { userId: req.user._id } },
    {
      $match: {
        date: {
          $gte: new Date(new Date().getTime() - 60 * 24 * 60 * 60 * 1000),
        },
      },
    },
    { $group: { _id: '$employeeId', count: { $count: {} } } },
  ]);
  allEmployeesCount = allEmployeesCount.filter((emp) => emp.count > 5);

  let pageviews = await ProfileViews.countDocuments({ userId: req.user._id });
  let featureRequest = await Notifications.countDocuments({ by: req.user._id });
  let totalEmployees = await User.countDocuments({ createdBy: req.user._id });
  let empPapers = await User.aggregate([
    { $match: { createdBy: req.user._id } },
    {
      $group: {
        _id: '',
        paperSaved: { $sum: '$paperSaved' },
      },
    },
  ]);
  let paperSaved = req.user.paperSaved + empPapers.reduce((total, p) => total + p.paperSaved, 0);
  let userActivityThisMonth = await UserActivity.countDocuments({
    $and: [
      { userId: req.user._id },
      {
        date: {
          $gte: new Date(new Date().getTime() - 60 * 24 * 60 * 60 * 1000),
        },
      },
    ],
  });
  let mostActiveUsers = allEmployeesCount.length;
  res.status(200).json({
    status: 'success',
    data: {
      users,
      pageviews,
      featureRequest,
      totalEmployees,
      paperSaved,
      userActivityThisMonth,
      mostActiveUsers,
    },
  });
});
