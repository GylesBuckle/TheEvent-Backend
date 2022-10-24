const express = require('express');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const cors = require('cors');
const AppError = require('./utils/appError');
const globalError = require('./controllers/errorController');

const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/eventRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
app.enable('trust proxy');
//Global Middleware Stack

//implementing CORS
//Access-control-Allow-Origin(Allowing Everyone to use our API)
app.use(cors());
app.options('*', cors());
// app.options('https://expense-tracker-sami.surge.sh',cors())
//Setting Security Http Headers
//app.use(helmet());

//static File
app.use(express.static(`${__dirname}/public`));

//Allowing Only 100 Request in 1 Hour For '/api'
const limit = rateLimit({
  max: 500,
  windowMs: 60 * 60 * 1000,
  message: 'Too Many Request From this IP.',
});
app.use('/api', limit);

//body parse middleware
app.use(
  express.json({
    //limit: '10kb',
    // verify: function (req, res, buf) {
    //   var url = req.originalUrl;
    //   if (url.startsWith('/api/v1/payment/stripeWebHook')) {
    //     req.rawBody = buf.toString();
    //   }
    // },
  })
);
//seting View Engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
//Data Sanitization against No Sql query injection(Filtering $ etc)
app.use(mongoSanitize());
//Data Sanitization against XSS
app.use(xss());
//Prevent Parameter Pollution
//app.use(hpp({whitelist:['id']}))

//Compressing text
app.use(compression());

//static File
//app.use(express.static(`${__dirname}/public`));

//logging
process.env.NODE_ENV === 'development' ? app.use(morgan('dev')) : null;

//Routes Middleware
app.get('/api/v1/test', (req, res) => {
  res.status(200).json({
    status: 'Test Backend Success vcf',
  });
});
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/events', eventRoutes);

app.use('/api/v1/payment', paymentRoutes);
app.use(globalError);

app.use(function (request, response, next) {
  if (process.env.NODE_ENV != 'development' && !request.secure) {
    return response.redirect('https://' + request.headers.host + request.url);
  }

  next();
});
// if (process.env.NODE_ENV == 'production') {
//   app.use(express.static('client/build'));
//   const path = require('path');
//   app.get('*', (req, res) => {
//     res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
//   });
// }
// app.all('*', (req, res, next) => {
//   next(
//     new AppError(
//       `requested Url ${req.originalUrl} could not be found on this server`,
//       404
//     )
//   );
// });

module.exports = app;
