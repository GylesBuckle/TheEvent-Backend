const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
let Events = require('../models/events');
let Payments = require('../models/paymentsModal');
const axios = require('axios');
const deleteFiles = require('../utils/deleteFiles');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');

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

exports.createEvent = catchAsync(async (req, res, next) => {
  let {
    name,
    tags,
    description,
    startDate,
    endDate,
    totalTickets,
    location,
    locationCoordinates,
    venue,
    price,
    address,
    phone,
    email,
    facebook,
    twitter,
    insta,
    linkdin,
    snapchat,
    whatsApp,
    sponsors,
    speakers,
    schedule,
    deletedSponsorsImages,
    newSponsorsImagesIndex,
    deleteSpeakersImages,
    newSpeakersImagesIndex,
    timezone,
  } = req.body;
  startDate = startDate;
  endDate = endDate;
  tags = JSON.parse(tags);
  locationCoordinates = JSON.parse(locationCoordinates);
  schedule = JSON.parse(schedule);
  deletedSponsorsImages = JSON.parse(deletedSponsorsImages);
  newSponsorsImagesIndex = JSON.parse(newSponsorsImagesIndex);
  sponsors = JSON.parse(sponsors);
  deleteSpeakersImages = JSON.parse(deleteSpeakersImages);
  newSpeakersImagesIndex = JSON.parse(newSpeakersImagesIndex);
  speakers = JSON.parse(speakers);

  if (req.files && req.files.newSponsorsImages) {
    //replaces file with filename
    newSponsorsImagesIndex.map((i, ind) => {
      sponsors[i] = {
        new: true,
        img: req.files.newSponsorsImages[ind].filename,
      };
    });
  }
  if (req.files && req.files.newSpeakersImages) {
    //replaces file with filename
    newSpeakersImagesIndex.map((i, ind) => {
      speakers[i] = {
        ...speakers[i],
        new: true,
        image: req.files.newSpeakersImages[ind].filename,
      };
    });
  }

  let doc = await Events.create({
    name,
    tags,
    description,
    image:
      req.files && req.files.image && req.files.image.length > 0 ? req.files.image[0].filename : '',
    startDate,
    endDate,
    totalTickets,
    remainingTickets: totalTickets,
    location,
    locationCoordinates,
    venue,
    price,
    address,
    phone,
    email,
    facebook,
    twitter,
    insta,
    linkdin,
    snapchat,
    whatsApp,
    sponsors: sponsors.map((x) => x.img),
    speakers: speakers.map((x) => {
      return {
        image: x.image,
        name: x.name,
        description: x.description,
        occupation: x.occupation,
        facebook: x.facebook,
        twitter: x.twitter,
        insta: x.insta,
        linkdin: x.linkdin,
        snapchat: x.snapchat,
        whatsApp: x.whatsApp,
      };
    }),
    schedule: schedule.map((x) => {
      return {
        startDate: x.startDate,
        topic: x.topic,
        topicDetails: x.topicDetails,
        speaker: x.speaker,
      };
    }),
  });

  res.status(200).json({
    success: true,
    data: {
      doc,
    },
  });
});
exports.updateEvent = catchAsync(async (req, res, next) => {
  let {
    name,
    tags,
    description,
    startDate,
    endDate,
    totalTickets,
    location,
    locationCoordinates,
    venue,
    price,
    address,
    phone,
    email,
    facebook,
    twitter,
    insta,
    linkdin,
    snapchat,
    whatsApp,
    sponsors,
    speakers,
    schedule,
    deletedSponsorsImages,
    newSponsorsImagesIndex,
    deleteSpeakersImages,
    newSpeakersImagesIndex,
    timezone,
  } = req.body;

  const event = await Events.findById(req.params.id);
  if (!event) {
    return next(new AppError('requested Event not found', 404));
  }
  startDate = startDate;
  endDate = endDate;
  try {
    tags = JSON.parse(tags);
    locationCoordinates = JSON.parse(locationCoordinates);
    schedule = JSON.parse(schedule);
    deletedSponsorsImages = JSON.parse(deletedSponsorsImages);
    newSponsorsImagesIndex = JSON.parse(newSponsorsImagesIndex);
    sponsors = JSON.parse(sponsors);
    deleteSpeakersImages = JSON.parse(deleteSpeakersImages);
    newSpeakersImagesIndex = JSON.parse(newSpeakersImagesIndex);
    speakers = JSON.parse(speakers);
  } catch (err) {
    console.log(err);
  }
  if (req.files && req.files.newSponsorsImages) {
    //replaces file with filename
    newSponsorsImagesIndex.map((i, ind) => {
      sponsors[i] = {
        new: true,
        img: req.files.newSponsorsImages[ind].filename,
      };
    });
  }
  if (req.files && req.files.newSpeakersImages) {
    //replaces file with filename
    newSpeakersImagesIndex.map((i, ind) => {
      speakers[i] = {
        ...speakers[i],
        new: true,
        image: req.files.newSpeakersImages[ind].filename,
      };
    });
  }

  const doc = await Events.findByIdAndUpdate(
    req.params.id,
    {
      name: name !== undefined ? name : event.name !== undefined ? event.name : '',
      tags: tags !== undefined ? tags : event.tags !== undefined ? event.tags : [],
      description:
        description !== undefined
          ? description
          : event.description !== undefined
          ? event.description
          : '',
      image:
        req.files && req.files.image && req.files.image.length > 0
          ? req.files.image[0].filename
          : event.image,
      startDate:
        startDate !== undefined ? startDate : event.startDate !== undefined ? event.startDate : '',
      endDate: endDate !== undefined ? endDate : event.endDate !== undefined ? event.endDate : '',
      totalTickets:
        totalTickets !== undefined
          ? totalTickets
          : event.totalTickets !== undefined
          ? event.totalTickets
          : '',
      remainingTickets:
        totalTickets !== undefined
          ? parseInt(totalTickets) -
            (parseInt(event.totalTickets) - parseInt(event.remainingTickets))
          : event.remainingTickets,
      location:
        location !== undefined ? location : event.location !== undefined ? event.location : '',
      locationCoordinates:
        locationCoordinates !== undefined
          ? locationCoordinates
          : event.locationCoordinates !== undefined
          ? event.locationCoordinates
          : [1, 1],
      venue: venue !== undefined ? venue : event.venue !== undefined ? event.venue : '',
      price: price !== undefined ? price : event.price !== undefined ? event.price : '',
      address: address !== undefined ? address : event.address !== undefined ? event.address : '',
      phone: phone !== undefined ? phone : event.phone !== undefined ? event.phone : '',
      email: email !== undefined ? email : event.email !== undefined ? event.email : '',
      facebook:
        facebook !== undefined ? facebook : event.facebook !== undefined ? event.facebook : '',
      twitter: twitter !== undefined ? twitter : event.twitter !== undefined ? event.twitter : '',
      insta: insta !== undefined ? insta : event.insta !== undefined ? event.insta : '',
      linkdin: linkdin !== undefined ? linkdin : event.linkdin !== undefined ? event.linkdin : '',
      snapchat:
        snapchat !== undefined ? snapchat : event.snapchat !== undefined ? event.snapchat : '',
      whatsApp:
        whatsApp !== undefined ? whatsApp : event.whatsApp !== undefined ? event.whatsApp : '',
      sponsors: sponsors.map((x) => x.img),
      speakers: speakers.map((x) => {
        return {
          image: x.image,
          name: x.name,
          description: x.description,
          occupation: x.occupation,
          facebook: x.facebook,
          twitter: x.twitter,
          insta: x.insta,
          linkdin: x.linkdin,
          snapchat: x.snapchat,
          whatsApp: x.whatsApp,
        };
      }),
      schedule: schedule.map((x) => {
        return {
          startDate: x.startDate,
          topic: x.topic,
          topicDetails: x.topicDetails,
          speaker: x.speaker,
        };
      }),
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (
    req.files &&
    req.files.image &&
    req.files.image.length > 0 &&
    req.files.image[0].filename !== event.image
  ) {
    deleteFiles([`/public/files/events/${event.image}`], function (err) {
      if (err) {
        console.log('Event image not deleted', event._id + ' : ' + event.image);
      }
    });
  }
  if (deleteSpeakersImages && deleteSpeakersImages.length > 0) {
    deleteFiles(
      deleteSpeakersImages.map((key) => '/public/files/speakers/' + key),
      function (err) {
        if (err) {
          console.log(
            'Event Speakers images not deleted',
            event._id + ' : ' + deleteSpeakersImages.join(':')
          );
        }
      }
    );
  }
  if (deletedSponsorsImages && deletedSponsorsImages.length > 0) {
    deleteFiles(
      deletedSponsorsImages.map((key) => '/public/files/sponsors/' + key),
      function (err) {
        if (err) {
          console.log(
            'Event Speakers images not deleted',
            event._id + ' : ' + deletedSponsorsImages.join(':')
          );
        }
      }
    );
  }

  res.status(200).json({
    success: true,
    data: {
      doc,
    },
  });
});

exports.getEvent = catchAsync(async (req, res, next) => {
  //Tour.find({_id:req.params.id})
  let doc = await Events.findById(req.params.id);
  if (!doc) {
    return next(new AppError('requested Event not found', 404));
  }
  res.status(200).json({
    success: true,
    data: { doc },
  });
});

exports.getEvents = catchAsync(async (req, res, next) => {
  let doc = await Events.find({ startDate: { $gt: new Date() } });

  res.status(200).json({
    success: true,
    result: doc.length,
    data: { doc },
  });
});

exports.bookEvent = catchAsync(async (req, res, next) => {
  const { eventId, stripeToken, customerData, quantity } = req.body;
  let event = await Events.findById(eventId);
  if (!event) return next(new AppError('requested Event not found', 404));

  if (event.remainingTickets === 0) return next(new AppError('Event out of stock', 404));
  if (quantity > event.remainingTickets) return next(new AppError('Event out of stock', 404));

  const fakeKey = uuidv4();
  return stripe.customers
    .create({
      email: customerData.email,
      source: process.env.NODE_ENV === 'development' ? 'tok_visa' : stripeToken.id,
    })
    .then((customer) => {
      return stripe.charges.create(
        {
          ///source: stripeToken.card.id,
          customer: customer.id, // set the customer id
          amount: event.price * 100 * quantity, // 25
          currency: 'usd',
          description: `Product ${event.name} Purchased `,
          receipt_email: customerData.email,
        },
        { idempotencyKey: fakeKey }
      );
    })
    .then(async (result) => {
      const doc = await Payments.create({
        customerData,
        paymentMethod: 'stripe',
        userId: req.user._id,
        event: event.id,
        totalAmount: event.price * quantity,
        quantity,
        transactionId: result.id,
      });

      res.status(201).json({
        success: true,
        data: {
          doc,
        },
      });
    })
    .catch((err) => {
      console.log(err);
      let message = '';
      switch (err.type) {
        case 'StripeCardError':
          // A declined card error
          message = "Your card's expiration year is invalid.";
          break;
        case 'StripeInvalidRequestError':
          message = "Invalid parameters were supplied to Stripe's API";
          break;
        case 'StripeAPIError':
          message = "An error occurred internally with Stripe's API";
          break;
        case 'StripeConnectionError':
          message = 'Some kind of error occurred during the HTTPS communication';
          break;
        case 'StripeAuthenticationError':
          message = 'You probably used an incorrect API key';
          break;
        case 'StripeRateLimitError':
          message = 'Too many requests hit the API too quickly';
          break;
        default:
          message = 'Something went wrong';
          break;
      }
      return next(new AppError(message, 500));
    });
});

exports.userBookings = catchAsync(async (req, res, next) => {
  const doc = await Payments.find({
    userId: req.user._id,
  })
    .populate('userId')
    .populate('event');

  res.status(200).json({
    success: true,
    result: doc.length,
    data: { doc },
  });
});
