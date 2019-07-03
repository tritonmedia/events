/**
 * Webhook spawned by Trello.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const express = require('express')
const bodyp = require('body-parser')
const opentracing = require('triton-core/tracer').opentracing
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

const proto = require('triton-core/proto')
const AMQP = require('triton-core/amqp')
const dyn = require('triton-core/dynamics')
const Storage = require('./db')

/* eslint no-unused-vars: [0] */
const { Tags, Tracer } = opentracing
const { EventEmitter } = require('events')

/**
 * Generate a webhook
 * @param {EventEmitter} emitter - event emitter
 * @param {Tracer} tracer - opentracing tracer
 */
module.exports = async (emitter, tracer) => {
  let app = express()

  app.use(bodyp.json())

  app.get('/v1/health', (req, res) => {
    return res.status(200).send({
      message: 'healthy'
    })
  })

  const downloadProto = await proto.load('api.Download')
  const db = new Storage()
  await db.connect()

  const amqp = new AMQP(dyn('rabbitmq'))
  await amqp.connect()

  // requeue media by id
  app.post('/v1/requeue', async (req, res) => {
    const id = req.body.id
    if (!id) {
      return res.status(400).send({
        success: false,
        message: 'Missing id in query'
      })
    }

    try {
      await db.updateStatus(id, 0)

      const obj = await db.getByID(id)
      const payload = {
        createdAt: new Date().toISOString(),
        media: obj
      }

      logger.info('creating new v1.download message for', id)
      const encoded = proto.encode(downloadProto, payload)
      await amqp.publish('v1.download', encoded)
      return res.send(obj)
    } catch (err) {
      logger.error('failed to requeue', err.message || err)
      logger.error(err.stack)
      return res.status(500).send({
        success: false,
        message: 'Failed to update media.'
      })
    }
  })

  // get media by id
  app.get('/v1/media/:id', async (req, res) => {
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
      return res.status(400).send({
        success: false,
        message: 'Failed to get media'
      })
    }
  })

  // actual URL pinged by Trello.
  app.use(async (req, res, next) => {
    const parentSpanContext = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, req.headers)
    const span = tracer.startSpan('http_request', {
      childOf: parentSpanContext
    })

    span.setTag(Tags.HTTP_URL, req.url)
    span.setTag(Tags.HTTP_METHOD, req.method)

    logger.debug(req.method, req.url)

    if (!req.body.action || req.method === 'HEAD') return res.status(200).send()

    const action = req.body.action
    const type = action.type

    logger.info('event', type, 'triggered')

    const traceContext = {}
    tracer.inject(span, opentracing.FORMAT_TEXT_MAP, traceContext)
    emitter.emit(type, action, JSON.stringify(traceContext))
    span.finish()

    return res.status(200).send()
  })

  app.listen(process.env.PORT || 3401, () => {
    logger.info('webhook is listening on port', process.env.PORT || 3401)
  })
}
