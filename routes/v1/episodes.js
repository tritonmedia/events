// Media API

'use strict'

const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})
const Minio = require('triton-core/minio')

module.exports = async (app, opts) => {
  const { db, s3Client } = opts

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

    for (const item of media) {
      item.thumbnail_url = await Minio.presignedURL(s3Client, 'triton-media', `images/${item.media_id}/${item.thumbnail_image_id}.png`)
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

    for (const item of media) {
      item.url = await Minio.presignedURL(s3Client, 'triton-media', item.key)
    }

    return res.success(media)
  })
}
