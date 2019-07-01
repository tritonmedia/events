/**
 * Database Interface
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const { Pool } = require('pg')
const proto = require('triton-core/proto')
const dyn = require('triton-core/dynamics')
const uuid = require('uuid/v4')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

const initStatement = `
CREATE TABLE media (
  id character varying(36) PRIMARY KEY,
  media_name text NOT NULL,
  creator smallint NOT NULL,
  creator_id text,
  type smallint NOT NULL,
  source smallint NOT NULL,
  source_uri text NOT NULL,
  metadata_id text NOT NULL,
  metadata smallint NOT NULL DEFAULT '0'::smallint
);
COMMENT ON COLUMN media.id IS 'ID of the media';
COMMENT ON COLUMN media.media_name IS 'Media name';
COMMENT ON COLUMN media.creator IS 'Creator Type, see protobuf for int to string';
COMMENT ON COLUMN media.creator_id IS 'Creator ID (for mapping back to creator), if needed';
COMMENT ON COLUMN media.type IS 'Media Type, see protobuf for int to string';
COMMENT ON COLUMN media.source IS 'Source Type, see protobuf for int to string ';
COMMENT ON COLUMN media.source_uri IS 'Source URL';
COMMENT ON COLUMN media.metadata_id IS 'Metadata ID';
COMMENT ON COLUMN media.metadata IS 'Metadata Type: 0 MAL, 1 IMDB';
`

/**
 * Storage Adapter
 * @class Storage
 */
class Storage {
  constructor () {
    this.adapter = new Pool({
      host: dyn('postgres'),
      user: 'postgres',
      database: 'media'
    })
  }

  /**
   * Connects to the storage and initializes it if needed
   * @returns {Undefined}
   */
  async connect () {
    this.downloadProto = await proto.load('api.Download')

    try {
      await this.adapter.query('SELECT id FROM media LIMIT 1;')
    } catch (err) {
      logger.info('intializing postgres ...')
      try {
        await this.adapter.query(initStatement)
      } catch (err) {
        logger.error('failed to init postgress', err.message)
        // TODO: logging stuff for here
        throw err
      }
    }

    logger.info('postgres connected')
  }

  /**
   * Finds a media by it's metadata
   *
   * @param {String} id metadata id
   * @param {Number} type metadata type
   * @returns {String|Null} id of the item if found, otherwise null
   */
  async findByMetadata (id, type) {
    const res = await this.adapter.query(
      'SELECT id FROM media WHERE metadata = $1 AND metadata_id = $2;',
      [type, id])
    if (res.rows.length !== 1) return null

    return res.rows[0]
  }

  /**
   * Create a new media object, returning a protobuf for Download
   * and creating a DB object, ensuring no duplicates exist.
   *
   * @param {String} name name of the media
   * @param {Number} creator creator type
   * @param {String} creatorId creator id
   * @param {Number} type media type
   * @param {Number} source source type
   * @param {String} sourceURI source URL
   * @param {Number} metadata metadata type
   * @param {String} metadataId Metadata ID
   */
  async new (name, creator, creatorId, type, source, sourceURI, metadata, metadataId) {
    const id = uuid()
    const payload = {
      createdAt: new Date().toISOString(),
      media: {
        id,
        name,
        creator,
        creatorId,
        type,
        source,
        sourceURI,
        metadata,
        metadataId
      }
    }

    const exists = await this.findByMetadata(metadataId, metadata)
    if (exists !== null) {
      throw new Error('Media already exists.')
    }

    const client = await this.adapter.connect()
    try {
      await client.query(
        'INSERT INTO "public"."media"("id", "media_name", "creator", "creator_id", "type", "source", "source_uri", "metadata_id", "metadata") VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          id,
          name,
          creator,
          creatorId,
          type,
          source,
          sourceURI,
          metadataId,
          metadata
        ]
      )
    } catch (err) {
      logger.error('failed to insert', err.message)
      throw err
    }

    return proto.encode(this.downloadProto, payload)
  }
}

module.exports = Storage
