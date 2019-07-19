// Media API

'use strict'

const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})
const proto = require('triton-core/proto')

module.exports = async (app, opts) => {
  const { db, amqp } = opts

  const mediaProto = await proto.load('api.Media')

  app.get('/', async (req, res) => {
    let media
    try {
      media = await db.list()
    } catch (err) {
      return res.status(500).send({
        success: false,
        message: 'Internal Server Error'
      })
    }

    return res.send({
      success: true,
      data: media
    })
  })

  // get media by id
  app.get('/:id', async (req, res) => {
    try {
      const { id } = req.params
      if (!id) {
        return res.status(400).send({
          success: false,
          message: 'Missing ID.'
        })
      }

      const obj = await db.getByID(req.params['id'])
      return res.send(obj)
    } catch (err) {
      logger.error('failed to get media', err.message || err)
      logger.error(err.stack)

      if (err.code === 'ERRNOTFOUND') {
        return res.status(404).send({
          success: false,
          message: 'ID not found'
        })
      }

      return res.status(400).send({
        success: false,
        message: 'Failed to get media'
      })
    }
  })

  // TODO(jaredallard): Add a rate limit
  app.post('/', async (req, res) => {
    const error = (status = 400, msg = 'Internal Server Error') => {
      return res.status(status).send({
        success: false,
        message: msg
      })
    }

    let { name, creator, creatorId, type, source, sourceURI, metadata, metadataId } = req.body

    // TODO(jaredallard): make these less copypasta
    if (typeof creator === 'string') {
      creator = creator.toUpperCase()

      try {
        creator = proto.stringToEnum(mediaProto, 'CreatorType', creator)
      } catch (err) {
        return error(400, `Creator '${creator}' not found.`)
      }
    }

    if (typeof type === 'string') {
      type = type.toUpperCase()
      try {
        type = proto.stringToEnum(mediaProto, 'MediaType', type)
      } catch (err) {
        return error(400, `Media Type '${type}' isn't supported.`)
      }
    }

    if (typeof source === 'string') {
      source = source.toUpperCase()
      try {
        source = proto.stringToEnum(mediaProto, 'SourceType', source)
      } catch (err) {
        return error(400, `Source '${source}' isn't supported.`)
      }
    }

    if (typeof metadata === 'string') {
      metadata = metadata.toUpperCase()
      try {
        metadata = proto.stringToEnum(mediaProto, 'MetadataType', metadata)
      } catch (err) {
        return error(400, `Metadata '${metadata}' isn't supported.`)
      }
    }

    if (creator === 0) {
      return error(400, 'Trello type is not supported over this endpoint.')
    }

    const validationMessage = {
      id: '<randomlyGenerated>',
      name,
      creator,
      creatorId,
      type,
      source,
      sourceURI,
      metadata,
      metadataId,
      status: 0
    }

    try {
      await proto.encode(mediaProto, validationMessage)
    } catch (err) {
      logger.error('input failed validation', err.message || err)
      logger.error(validationMessage)
      return error(400, 'Input failed validation:' + err)
    }

    let encoded
    try {
      encoded = await db.new(name, creator, creatorId, type, source, sourceURI, metadata, metadataId)
    } catch (err) {
      logger.error('failed to create media', err.message || err)
      logger.error(err.stack)
      return error()
    }

    try {
      await amqp.publish('v1.download', encoded)
    } catch (err) {
      logger.error('failed to publish to download queue', err.message || err)
      logger.error(err.stack)
      return error()
    }

    const data = await proto.decode(db.downloadProto, encoded, {
      enums: String
    })

    return res.send({
      success: true,
      data: data.media
    })
  })
}
