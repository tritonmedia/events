// Media API

'use strict'

const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})
const _ = require('lodash')
const proto = require('triton-core/proto')

module.exports = async (app, opts) => {
  const { db, amqp } = opts

  const mediaProto = await proto.load('api.Media')
  const apiProto = await proto.load('api.TelemetryError')
  const identifyProto = await proto.load('api.Identify')

  /**
   * Mutates a media object to have string enum types
   * @param {Object} media media object from the data
   * @param {Bool} noop do nothing if true
   */
  const mediaTransformer = (media, noop = false) => {
    if (noop) return media
    return _.merge(media, {
      creator: proto.enumToString(mediaProto, 'CreatorType', media.creator),
      type: proto.enumToString(mediaProto, 'MediaType', media.type),
      source: proto.enumToString(mediaProto, 'SourceType', media.source),
      metadata: proto.enumToString(mediaProto, 'MetadataType', media.metadata),
      status: proto.enumToString(apiProto, 'TelemetryStatusEntry', media.status)
    })
  }

  app.get('/', async (req, res) => {
    let media
    try {
      media = await db.list()
    } catch (err) {
      return res.error('Internal Server Error', 500)
    }

    const formattedMedia = _.map(media, media => mediaTransformer(media, req.query.enum === 'number'))
    return res.success(formattedMedia)
  })

  // get media by id
  app.get('/:id', async (req, res) => {
    try {
      const { id } = req.params
      if (!id) {
        return res.error('Missing ID in path /:id')
      }

      const obj = await db.getByID(req.params['id'])
      return res.success(mediaTransformer(obj, req.query.enum === 'number'))
    } catch (err) {
      logger.error('failed to get media', err.message || err)
      logger.error(err.stack)

      if (err.code === 'ERRNOTFOUND') {
        return res.error('Media not found.', 404)
      }

      return res.error('Failed to get Media', 500)
    }
  })

  // TODO(jaredallard): Add a rate limit
  app.post('/', async (req, res) => {
    let { name, creator, creatorId, type, source, sourceURI, metadata, metadataId } = req.body

    const validate = [
      creator, type, source, metadata
    ]

    // TODO(jaredallard): make these less copypasta
    if (typeof creator === 'string') {
      creator = creator.toUpperCase()

      try {
        creator = proto.stringToEnum(mediaProto, 'CreatorType', creator)
      } catch (err) {
        return res.error(`Creator '${creator}' not found.`)
      }
    }

    if (typeof type === 'string') {
      type = type.toUpperCase()
      try {
        type = proto.stringToEnum(mediaProto, 'MediaType', type)
      } catch (err) {
        return res.error(`Media Type '${type}' isn't supported.`)
      }
    }

    if (typeof source === 'string') {
      source = source.toUpperCase()
      try {
        source = proto.stringToEnum(mediaProto, 'SourceType', source)
      } catch (err) {
        return res.error(`Source '${source}' isn't supported.`)
      }
    }

    if (typeof metadata === 'string') {
      metadata = metadata.toUpperCase()
      try {
        metadata = proto.stringToEnum(mediaProto, 'MetadataType', metadata)
      } catch (err) {
        return res.error(`Metadata '${metadata}' isn't supported.`)
      }
    }

    if (creator === 1) {
      return res.error('Trello type is not supported over this endpoint.')
    }

    for (const v of validate) {
      if (v === 0) {
        res.error(`Cannot set enum value to 0.`, 400)
        break
      }
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
      return res.error('Input failed validation:' + err)
    }

    let encoded
    try {
      encoded = await db.new(name, creator, creatorId, type, source, sourceURI, metadata, metadataId)
    } catch (err) {
      logger.error('failed to create media', err.message || err)
      logger.error(err.stack)
      return res.error('Failed to create media')
    }

    // TODO(jaredallard): get rid of db.new returning a fixed proto
    try {
      const payload = await proto.decode(db.downloadProto, encoded)
      const encodedIdentify = proto.encode(identifyProto, payload)
      await amqp.publish('v1.identify', encodedIdentify)
    } catch (err) {
      logger.error('failed to publish to identify queue', err.message || err)
      logger.error(err.stack)
      return res.error('Failed to create media')
    }

    try {
      await amqp.publish('v1.download', encoded)
    } catch (err) {
      logger.error('failed to publish to download queue', err.message || err)
      logger.error(err.stack)
      return res.error('Failed to create media')
    }

    const data = await proto.decode(db.downloadProto, encoded, {
      enums: req.query.enum === 'number' ? Number : String
    })

    return res.success(data.media)
  })
}
