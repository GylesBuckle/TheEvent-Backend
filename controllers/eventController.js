const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const axios = require('axios');

exports.searchLocation = catchAsync(async (req, res, next) => {
  const query = req.query.q;
  const lang = req.query.lang;

  if (!query || !lang) {
    return next(new AppError('required parameters missing', 403));
  }
  const response = await axios.get(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${process.env.MAP_BOX_TOKEN}&autocomplete=true&language=${lang}&limit=5`
  );
  res.status(200).json({
    success: true,
    data: response.data.features.map((places) => ({
      place_name: places.place_name,
      center: places.center,
      geometry: places.geometry.coordinates,
    })),
  });
});
