const router = require('express').Router();
const ctrl = require('../controllers/deviceController');
const auth = require('../middlewares/auth');

router.get('/', ctrl.list);
router.post('/', auth, ctrl.create);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
