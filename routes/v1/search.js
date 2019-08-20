// Media API

'use strict'

const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

module.exports = async (app, opts) => {
  const { db } = opts

  /**
   * POST /name - search by name of media
   * @todo deprecate this in favor of a more powerful
   * search engine if we ever get there
   * @example
   *  request.post(url, {
   *    body: {
   *      name: 'Hello, world!'
   *    }
   * })
   */
  app.post('/name', async (req, res) => {
    logger.info('searching by media with name', req.body.name)

    let media
    try {
      media = await db.searchSeries(req.body.name)
    } catch (err) {
      logger.error('Failed to search for media', err.message || err)
      logger.error(err.stack)
      return res.error('Internal Server Error', 500)
    }

    return res.success(media)
  })
}
