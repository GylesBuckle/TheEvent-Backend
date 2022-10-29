var multer = require('multer');
const AppError = require('../utils/appError');

var fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    let des = path.join(__dirname, '../public/files');
    switch (file.fieldname) {
      case 'image':
        des = des + '/events';
        break;
      case 'newSponsorsImages':
        des = des + '/sponsors';
        break;
      case 'newSpeakersImages':
        des = des + '/speakers';
        break;
      default:
        break;
    }
    if (fs.existsSync(des)) {
      callback(null, des);
    } else {
      fs.mkdir(des, { recursive: true }, () => {
        callback(null, des);
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
  if (
    file.fieldname === 'image' ||
    file.fieldname === 'newSponsorsImages' ||
    file.fieldname === 'newSpeakersImages'
  ) {
    allowedType = /\.(jpg|JPG|jpeg|JPEG|png|PNG|webp)$/;
  } else {
    allowedType = /\.(jpg|JPG|jpeg|JPEG|png|PNG)$/;
  }
  if (file.originalname.match(allowedType)) {
    cb(null, true);
  } else {
    //console.log(file.originalname, allowedType);
    cb(new AppError('Invalid Format testing', 400), false);
  }
};
module.exports = multer({
  storage: storage,
  fileFilter: multerFilter,
  onError: function (err, next) {
    console.log(err);
    next(next(new AppError('Error in Updloading Image.', 500)));
  },
});

//use this middleware with .single or .array to upload photo to public images
