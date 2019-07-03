/**
 * Webhook spawned by Trello.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const express = require('express')
const bodyp = require('body-parser')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

const proto = require('triton-core/proto')
const AMQP = require('triton-core/amqp')
const dyn = require('triton-core/dynamics')
const opentracing = require('triton-core/tracer').opentracing
const Storage = require('./db')

/* eslint no-unused-vars: [0] */
const { Tracer } = opentracing
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

  const db = new Storage()
  await db.connect()

  const amqp = new AMQP(dyn('rabbitmq'))
  await amqp.connect()

  // start the routes
  await require('../routes/routes')(app, {
    db,
    amqp,
    emitter,
    tracer
  })

  app.listen(process.env.PORT || 3401, () => {
    logger.info('webhook is listening on port', process.env.PORT || 3401)
  })
}
