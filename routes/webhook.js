// Webhook Route

'use strict'

const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

const opentracing = require('triton-core/tracer').opentracing
const { Tags } = opentracing

module.exports = async (app, opts) => {
  const { emitter, tracer } = opts
  // Trello Webhook
  app.use(async (req, res, next) => {
    if (req.url !== '/webhook' && req.url !== '/trello/webhook') return next()

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
}
