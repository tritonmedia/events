// Media API

'use strict'

const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})
const proto = require('triton-core/proto')

module.exports = async (app, opts) => {
  const { db } = opts

  const mediaProto = await proto.load('api.Media')

  /**
   * GET /:id - return the series object
   */
  app.get('/:id', async (req, res) => {
    let media
    try {
      media = await db.getSeries(req.params.id)
    } catch (err) {
      logger.error('Failed to search for media', err.message || err)
      logger.error(err.stack)
      return res.error('Internal Server Error', 500)
    }

    if (media.length === 0) {
      return res.error('Not Found', 404)
    }

    return res.success(media)
  })

  /**
   * GET / - list all series
   */
  app.get('/', async (req, res) => {
    let type
    if (req.query.type) {
      try {
        type = proto.stringToEnum(mediaProto, 'MediaType', req.query.type.toUpperCase())
      } catch (err) {
        logger.error('Failed to search for media', err.message || err)
        logger.error(err.stack)
        return res.error(`Failed to process type filter: ${err.message}`)
      }
    }

    let media
    try {
      media = await db.listSeries(type)
    } catch (err) {
      logger.error('Failed to search for media', err.message || err)
      logger.error(err.stack)
      return res.error('Internal Server Error', 500)
    }
    return res.success(media)
  })

  /**
   * GET /:id/images - return a list of images for a series
   */
  app.get('/:id/images', async (req, res) => {
    let media
    try {
      media = await db.getSeriesImages(req.params.id)
    } catch (err) {
      logger.error('Failed to search for media', err.message || err)
      logger.error(err.stack)
      return res.error('Internal Server Error', 500)
    }

    if (media.length === 0) {
      return res.error('Not Found', 404)
    }

    return res.success(media)
  })
}
