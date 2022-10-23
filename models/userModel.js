const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
// const Roles = require('./roles');

var UserSchema = mongoose.Schema(
  {
    employeeData: {
      title: {
        type: String,
      },
      firstName: {
        type: String,
      },
      middleName: {
        type: String,
      },
      lastName: {
        type: String,
      },
      primaryEmail: {
        type: String,
      },
      primaryPhone: {
        type: String,
      },
      password: {
        type: String,
      },
    },

    userName: {
      type: String,
      //lowercase: true,
      unique: [true, 'Username already exist'],
      required: [true, 'A User must have a username'],
    },
    email: {
      type: String,
      required: [true, 'A User must have an email'],
      unique: [true, 'Email already exist'],
      lowercase: true,
      validate: [validator.isEmail, 'Please Provide a Valid Email'],
    },
    password: {
      type: String,
      required: [true, 'A User must have a Password'],
      select: false,
      //at least 8 characters, one upper case letter, one lower case letter and one symbol or special character. And it also contains no spaces, tabs or line breaks.
      validate: {
        validator: function (v) {
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*]).{8,}$/.test(v);
        },
        message:
          'Password must contain at least 8 characters, one upper case letter, one special character and one number.',
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    lifeTime: {
      type: Boolean,
      default: false,
    },
    trailTaken: {
      type: Boolean,
      default: false,
    },
    trailTime: {
      type: Date,
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Roles',
        // validate: {
        //   validator: async function (v) {
        //     return await Roles.findById(v, (err, rec) => rec !== null);
        //   },
        //   message: 'Invalid Object ID',
        // },
        required: true,
      },
    ],
    activeProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }, //only for employee
    profiles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
      },
    ],
    portfolio: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Portfolio',
    },
    meetingUrl: String,
    google_refresh_token: String,
    google_email: String,
    zoom_access_token: String,
    zoom_refresh_token: String,
    zoom_expires_in: Date,
    zoom_email: String,
    timezone: String,
    availableDays: {
      type: [
        {
          day: Number,
          timeSlots: [
            {
              fromSelect: String,
              toSelect: String,
            },
          ],
        },
      ],
      default: [
        {
          day: 0,
          timeSlots: [],
        },
        {
          day: 1,
          timeSlots: [{ fromSelect: '09:00', toSelect: '17:00' }],
        },
        {
          day: 2,
          timeSlots: [{ fromSelect: '09:00', toSelect: '17:00' }],
        },
        {
          day: 3,
          timeSlots: [{ fromSelect: '09:00', toSelect: '17:00' }],
        },
        {
          day: 4,
          timeSlots: [{ fromSelect: '09:00', toSelect: '17:00' }],
        },
        {
          day: 5,
          timeSlots: [{ fromSelect: '09:00', toSelect: '17:00' }],
        },
        {
          day: 6,
          timeSlots: [],
        },
      ],
    },
    meetings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'meetings',
      },
    ],
    meetingTheme: {
      type: String,
      default: '1',
    },
    role: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    changedPasswordAt: Date,
    paperSaved: {
      type: Number,
      default: 0,
    },
    emailVerified: {
      type: Boolean,
      default: false,
      select: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
UserSchema.pre('save', async function (next) {
  //hashing password
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.confirmPassword = undefined;
  next();
});

UserSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.changedPasswordAfter = function (JWTtimestamp) {
  if (this.changedPasswordAt) {
    const changedTime = parseInt(this.changedPasswordAt.getTime() / 1000, 10);
    return JWTtimestamp < changedTime; //token_issued < changed time(mean Pass changed time)
  }
  return false; //Not Changed
};

UserSchema.methods.createResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('Sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  return resetToken;
};

UserSchema.methods.createEmailVerificationToken = function () {
  const Token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('Sha256').update(Token).digest('hex');
  this.emailVerificationExpires = Date.now() + 2 * 60 * 60 * 1000;
  return Token;
};

let User;
if (!mongoose.models['User']) {
  User = mongoose.model('User', UserSchema);
} else {
  User = mongoose.models['User'];
}

module.exports = User;
