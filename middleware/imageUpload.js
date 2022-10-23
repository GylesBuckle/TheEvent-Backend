var multer = require('multer');
const AppError = require('../utils/appError');

var fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    if (fs.existsSync('/public/files')) {
      callback(null, 'public/files');
    } else {
      fs.mkdir('/public/files', { recursive: true }, () => {
        callback(null, 'public/files');
      });
    }
  },
  filename: (req, file, callback) => {
    //const ext = file.mimetype.split('/')[1]
    callback(null, `${Date.now()}-${file.originalname}`);
    //callback(null,`user-${req.user.id}-${Data.now()}-${file.filename}.${ext}`)
  },
});

const multerFilter = (req, file, cb) => {
  let allowedType = '';
  switch (file.fieldname) {
    case 'images':
      allowedType = /\.(jpg|JPG|jpeg|JPEG|png|PNG|webp)$/;
      break;

    case 'video':
      allowedType = /\.(wmv|avi|mov|3gp|mp4|flv)$/;
      break;
    case 'attachement':
      allowedType = /\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|pdf|doc|docx)$/;
      break;
    case 'file':
      allowedType = /\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|pdf|doc|docx|zip|rar)$/;
      break;
    default:
      allowedType = /\.(jpg|JPG|jpeg|JPEG|png|PNG)$/;
      break;
  }
  if (file.originalname.match(allowedType)) {
    cb(null, true);
  } else {
    console.log(file.originalname, allowedType);
    cb(new AppError('Invalid Format testing', 400), false);
  }
};
module.exports = multer({
  storage: storage,
  fileFilter: multerFilter,
  onError: function (err, next) {
    next(next(new AppError('Error in Updloading Image.', 500)));
  },
});

//use this middleware with .single or .array to upload photo to public images
