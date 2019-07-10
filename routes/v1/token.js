/**
 * Token Routes
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 */

const Auth = require('../../lib/authentication')

module.exports = async (app, opts) => {
  const auth = Auth(opts.db)

  // GET a new token
  app.get('/', async (req, res) => {
    const token = await auth.generateAPIToken()
    return res.send({
      success: true,
      data: token
    })
  })
}
