const express = require('express');

const eventController = require('../controllers/eventController');
const protect = require('../middleware/protect');
const restrictTo = require('../middleware/restrictedTo');
const upload = require('../middleware/imageUpload');

const router = express.Router();

router.get('/:id', eventController.getEvent);
router.get('/', eventController.getEvents);
router.post('/bookEvent', eventController.bookEvent);

router.use(protect);

router.post('/my-bookings', eventController.userBookings);

router.use(restrictTo(['Admin', 'Super Admin']));
router.get('/location/searchLocation', eventController.searchLocation);
router.post(
  '/',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'newSponsorsImages' },
    { name: 'newSpeakersImages' },
  ]),
  eventController.createEvent
);

router.patch(
  '/:id',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'newSponsorsImages' },
    { name: 'newSpeakersImages' },
  ]),
  eventController.updateEvent
);

router.post('/getDashboardData', eventController.getDashboardData);

router.delete('/:id', eventController.delete);
module.exports = router;
