/**
 * Event Processor for the stack.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

'use strict'

const Event = require('events').EventEmitter
const express = require('express')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})
const bodyp = require('body-parser')

const AMQP = require('triton-core/amqp')
const dyn = require('triton-core/dynamics')
const Config = require('triton-core/config')
const Tracer = require('triton-core/tracer').initTracer
const Storage = require('triton-core/db')
const Prom = require('triton-core/prom')
const Minio = require('triton-core/minio')

const Auth = require('./lib/authentication')

const tracer = Tracer('events', logger)
const event = new Event()

const init = async () => {
  const config = await Config('events')
  const trello = require('./lib/trello')
  const db = new Storage()
  const prom = Prom.new()
  const amqp = new AMQP(dyn('rabbitmq'), 10000, 2, prom)
  await amqp.connect()
  await db.connect()
  Prom.expose()

  const app = express()
  app.use(bodyp.json())
  app.get('/v1/health', (req, res) => {
    return res.status(200).send({
      message: 'healthy'
    })
  })

  const keys = await db.listTokens()
  if (keys.length === 0) {
    const auth = Auth(db)
    const token = await auth.generateAPIToken()

    logger.info('generated initial API token:', token)
  }

  // intialize the routes
  await require('./routes/routes')(app, {
    db,
    s3Client: Minio.newClient(config),
    amqp,
    emitter: event,
    tracer
  })

  app.use(async (req, res) => {
    return res.status(404).send({
      metadata: {
        success: false,
        error_message: 'Not Found'
      }
    })
  })

  app.listen(process.env.PORT || 3401, () => {
    logger.info('api is listening on port', process.env.PORT || 3401)
  })

  // start the trello listener
  if (!process.env.NO_TRELLO) {
    await trello(config.keys.trello, {
      callbackUrl: config.instance.webhook,
      board: config.instance.board,
      event,
      tracer
    })
  } else {
    logger.info('running with trello support disabled')
  }

  // DEPRECATED: trello event system
  await require('./event/media')(event, config, tracer, prom)
}

init()
