const router = require('express').Router();
const ctrl = require('../controllers/dataController');

router.get('/', ctrl.list);
router.get('/latest', ctrl.latest);
router.post('/', ctrl.create);

module.exports = router;
