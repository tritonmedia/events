// Media API

'use strict'

const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

module.exports = async (app, opts) => {
  const { db } = opts

  app.get('/:id', async (req, res) => {
    let media
    try {
      media = await db.listEpisodes(req.params.id)
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

  app.get('/:seriesid/files/:episodeid', async (req, res) => {
    let media
    try {
      media = await db.getEpisodeFiles(req.params.episodeid)
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
