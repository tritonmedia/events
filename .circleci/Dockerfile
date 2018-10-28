FROM jaredallard/triton-base:latest

COPY --chown=999:999 package.json /stack
RUN yarn --production=true

COPY --chown=999:999 . /stack