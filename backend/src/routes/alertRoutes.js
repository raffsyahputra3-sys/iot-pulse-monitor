const router = require('express').Router();
const ctrl = require('../controllers/alertController');

router.get('/', ctrl.list);
router.put('/:id/read', ctrl.markRead);

module.exports = router;
