// Media API

'use strict'

const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})
const Minio = require('triton-core/minio')

module.exports = async (app, opts) => {
  const { db, s3Client } = opts

  app.get('/:seriesid/:episodeid', async (req, res) => {
    let subtitles
    try {
      subtitles = await db.getSubtitles(req.params.episodeid)
    } catch (err) {
      logger.error('failed to search for subtitles', err.message || err)
      logger.error(err.stack)
      return res.error('Internal Server Error', 500)
    }

    if (subtitles.length === 0) {
      return res.error('Not Found', 404)
    }

    for (const item of subtitles) {
      item.url = await Minio.presignedURL(s3Client, 'triton-media', item.key)
    }

    return res.success(subtitles)
  })
}
