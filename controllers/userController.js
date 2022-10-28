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
exports.getUser = catchAsync(async (req, res, next) => {
  let doc = await User.findById(req.params.id);
  if (!doc) return next(new AppError('requested Id not found', 404));

  res.status(200).json({
    success: true,
    data: { doc },
  });
});
exports.getUsers = catchAsync(async (req, res, next) => {
  let doc = await User.find({}).populate('roles', 'name');

  res.status(200).json({
    success: true,
    data: { doc },
  });
});
//Do not Update Password with this
exports.updateUser = catchAsync(async (req, res, next) => {
  let user = {};
  user.name = req.body.name;
  user.email = req.body.email;
  const doc = await User.findByIdAndUpdate(req.params.id, user, {
    new: true,
    runValidators: true,
  });
  if (!doc) {
    return next(new AppError('requested Id not found', 404));
  }
  res.status(200).json({
    success: true,
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
    success: true,
    data: 'deleted Successfully',
  });
});
