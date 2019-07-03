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

const Storage = require('./lib/db')

const tracer = Tracer('events', logger)
const event = new Event()

const init = async () => {
  const config = await Config('events')
  const trello = require('./lib/trello')

  logger.debug('starting trello init')

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

  let app = express()

  app.use(bodyp.json())

  app.get('/v1/health', (req, res) => {
    return res.status(200).send({
      message: 'healthy'
    })
  })

  const db = new Storage()
  await db.connect()

  const amqp = new AMQP(dyn('rabbitmq'))
  await amqp.connect()

  // start the routes
  await require('../routes/routes')(app, {
    db,
    amqp,
    emitter: event,
    tracer
  })

  app.listen(process.env.PORT || 3401, () => {
    logger.info('webhook is listening on port', process.env.PORT || 3401)
  })

  // media events
  await require('./event/media')(event, config, tracer)
  await require('./event/status')(event, config, tracer)
}

init()
