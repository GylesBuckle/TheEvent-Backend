const express = require('express');

const eventController = require('../controllers/eventController');
const protect = require('../middleware/protect');
const restrictTo = require('../middleware/restrictedTo');
const upload = require('../middleware/imageUpload');

const router = express.Router();

router.get('/:id', eventController.getEvent);
router.use(protect);

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
module.exports = router;
