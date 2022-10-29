const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');
const Roles = require('../models/roles');
const User = require('../models/userModel');

exports.delete = catchAsync(async (req, res, next) => {
  const check = await User.find({
    roles: mongoose.Types.ObjectId(req.params.id),
  });
  if (check) return next(new AppError('Role are already in use', 403));
  const doc = await Roles.findByIdAndDelete(req.params.id);
  if (!doc) {
    return next(new AppError('Requested Id not found', 404));
  }
  res.status(204).json({
    status: 'success',
    data: 'deleted Successfully',
  });
});

exports.update = catchAsync(async (req, res, next) => {
  const { name } = req.body;
  const doc = await Roles.findByIdAndUpdate(
    req.params.id,
    { name },
    {
      new: true,
      runValidators: true,
    }
  );
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

exports.createOne = catchAsync(async (req, res, next) => {
  const { name } = req.body;

  const doc = await Roles.create({ name });
  if (!doc) return next(new AppError('server unable to read this request', 500));

  res.status(201).json({
    success: true,
    data: {
      doc,
    },
  });
});
exports.createDefaultRoles = async (roles) => {
  const r = await Roles.countDocuments({});
  if (r === 0) {
    const doc = await Roles.insertMany(
      roles.map((r) => {
        return {
          name: r,
        };
      })
    );
    if (!doc)
      return {
        error: true,
        status: 500,
        message: 'server unable to read this request',
      };
  }

  return {
    error: false,
  };
};
exports.getOne = catchAsync(async (req, res, next) => {
  //Tour.find({_id:req.params.id})
  let doc = await Roles.findById(req.params.id);
  if (!doc) {
    return next(new AppError('requested Id not found', 404));
  }
  res.status(200).json({
    success: true,
    data: { doc },
  });
});
exports.getAll = catchAsync(async (req, res, next) => {
  const doc = await Roles.find();

  res.status(200).json({
    status: 'success',
    result: doc.length,
    data: { doc },
  });
});
