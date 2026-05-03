import { Router } from 'express';
import {
  createEventComment,
  deleteEventComment,
  listEventComments,
} from '../controllers/eventCommentController.js';
import {
  createEvent,
  deleteEvent,
  getEventById,
  listEvents,
  reactToEvent,
  reserveEventSeat,
} from '../controllers/eventController.js';
import {
  deleteEventReview,
  listEventReviews,
  upsertEventReview,
} from '../controllers/eventReviewController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', listEvents);
router.get('/:eventId/reviews', listEventReviews);
router.get('/:eventId/comments', listEventComments);
router.get('/:eventId', getEventById);

router.use(isAuthenticated);
router.post('/', createEvent);
router.post('/:eventId/react', reactToEvent);
router.post('/:eventId/reserve', reserveEventSeat);
router.post('/:eventId/reviews', upsertEventReview);
router.delete('/:eventId/reviews/:reviewId', deleteEventReview);
router.post('/:eventId/comments', createEventComment);
router.delete('/:eventId/comments/:commentId', deleteEventComment);
router.delete('/:eventId', deleteEvent);

export default router;
