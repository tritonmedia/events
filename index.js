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
  const db = new Storage()
  const amqp = new AMQP(dyn('rabbitmq'))
  await amqp.connect()
  await db.connect()

  let app = express()
  app.use(bodyp.json())
  app.get('/v1/health', (req, res) => {
    return res.status(200).send({
      message: 'healthy'
    })
  })

  // intialize the routes
  await require('./routes/routes')(app, {
    db,
    amqp,
    emitter: event,
    tracer
  })

  app.use(async (req, res) => {
    return res.status(404).send({
      success: false,
      message: 'Not Found'
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

  // media events
  await require('./event/media')(event, config, tracer)
  await require('./event/status')(event, config, tracer)
}

init()
