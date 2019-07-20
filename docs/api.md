# API

This doc contains API documentation

## Important Information

For integer response for "source", "type", and etc, you should refer to the protobufs located [here](https://github.com/tritonmedia/core/tree/master/protos/api) for their string representations. The API endpoints support using both integer and string representations.

## Authentication

All routes are authenticated. A API token is created on first init and printed to stdout, it can be found in the `tokens` table.

A token should be supplied in the `Authorization` header.

## /v1/media

### GET /v1/media - List all Media

**Endpoint**: GET - <https://app.tritonjs.com/v1/media>

**Description**: Returns a list of all of the media in the platform.

#### Response

```json
{
  "metadata": {
        "success": true,
        "host": "host-that-processed-this"
    },
  "data": [
    {
      "id": "ef8824d6-4c83-4e3f-8a2c-4447d7babf3c",
      "name": "My Media",
      "creator": "TRELLO",
      "creatorId": "5a6824e971636a279de0a93e",
      "type": "TV",
      "source": "MAGNET",
      "sourceURI": "....",
      "metadata": "MAL",
      "metadataId": "24833",
      "status": "DEPLOYED"
    },
        ...
  ]
}
```

### POST /v1/media - Create New Media

**Endpoint**: POST - <https://app.tritonjs.com/v1/media>

**Description**: Creates a new media request.

#### Body

**Type**: v1.media (without the id)

```json
{
    "source": "FILE", // or 2
    "sourceURI": "file:///tmp/Bunny.mkv",
    "metadataId": "tt5311514",
    "type": "MOVIE", // or 1
    "creator": "API", // or 5
    "name": "Test Card",
    "metadata": "MAL" // or 1
}
```

#### Response

```json
{
  "metadata": {
        "success": true,
        "host": "host-that-processed-this"
    },
    "data": {
        "id": "ef8824d6-4c83-4e3f-8a2c-4447d7babf3c",
        "name": "My Media",
        "creator": "TRELLO",
        "creatorId": "5a6824e971636a279de0a93e",
        "type": "TV",
        "source": "MAGNET",
        "sourceURI": "....",
        "metadata": "MAL", // MyAnimeList
        "metadataId": "24833",
        "status": "DEPLOYED"
    }
}
```

### Get Media

**Endpoint**: GET - <https://app.tritonjs.com/v1/media/:id>

**Description**: Returns a media entry.

#### Response

```json
{
  "metadata": {
        "success": true,
        "host": "host-that-processed-this"
    },
    "data": {
        "id": "ef8824d6-4c83-4e3f-8a2c-4447d7babf3c",
        "name": "My Media",
        "creator": "TRELLO",
        "creatorId": "5a6824e971636a279de0a93e",
        "type": "TV",
        "source": "MAGNET",
        "sourceURI": "....",
        "metadata": "METADATA",
        "metadataId": "24833",
        "status": "DEPLOYED"
    }
}
```

## /v1/queue

## Requeue Media

**Endpoint**: POST - <https://app.tritonjs.com/v1/queue/:id>

**Description**: Requeues a media file for processing. Don't use this unless you have too.

### Response

```json
{
  "metadata": {
        "success": true,
        "host": "host-that-processed-this"
    },
    "data": {
        "id": "ef8824d6-4c83-4e3f-8a2c-4447d7babf3c",
        "name": "My Media",
        "creator": "TRELLO",
        "creatorId": "5a6824e971636a279de0a93e",
        "type": "TV",
        "source": "MAGNET",
        "sourceURI": "....",
        "metadata": "MAL",
        "metadataId": "24833",
        "status": "DEPLOYED"
    }
}
```

## /v1/token

## Create a new Token

**Endpoint**: POST - <https://app.tritonjs.com/v1/token>

**Description**: Creates a new API token

### Response

```json
{
  "metadata": {
        "success": true,
        "host": "host-that-processed-this"
    },
    "data": ":128-token"
}
```
