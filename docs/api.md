# API

This doc contains API documentation

## Important Information

For integer response for "source", "type", and etc, you should refer to the protobufs located [here](https://github.com/tritonmedia/core/tree/master/protos/api) for their string representations.

## Authentication

All routes are authenticated. A API token is created on first init and printed to stdout, it can be found in
the `tokens` table.

A token should be supplied in the `Authorization` header.

## /v1/media

### GET /v1/media - List all Media

**Endpoint**: GET - https://app.tritonjs.com/v1/media

**Description**: Returns a list of all of the media in the platform.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "ef8824d6-4c83-4e3f-8a2c-4447d7babf3c",
      "name": "My Media",
      "creator": 0, // TRELLO
      "creatorId": "5a6824e971636a279de0a93e",
      "type": 1, // TV
      "source": 1, // MAGNET
      "sourceURI": "....",
      "metadata": 0, // MyAnimeList (1 is IMDB)
      "metadataId": "24833",
      "status": 4 // DEPLOYED
    },
		...
  ]
}
```


### POST /v1/media - Create New Media

**Endpoint**: POST - https://app.tritonjs.com/v1/media

**Description**: Creates a new media request.

#### Body

**Type**: v1.media (without the id)

```json
{
	"source": 2,
	"sourceURI": "file:///tmp/Bunny.mkv",
	"metadataId": "tt5311514",
	"type": 0,
	"creator": 1,
	"name": "Test Card",
	"metadata": 0
}
```

#### Response

```json
{
	"success": true,
	"data": {
		"id": "ef8824d6-4c83-4e3f-8a2c-4447d7babf3c",
		"name": "My Media",
		"creator": 0, // TRELLO
		"creatorId": "5a6824e971636a279de0a93e",
		"type": 1, // TV
		"source": 1, // MAGNET
		"sourceURI": "....",
		"metadata": 0, // MyAnimeList (1 is IMDB)
		"metadataId": "24833",
		"status": 4 // DEPLOYED
	}
}
```

### Get Media

**Endpoint**: GET - https://app.tritonjs.com/v1/media/:id

**Description**: Returns a media entry.

#### Response

```json
{
	"success": true,
	"data": {
		"id": "ef8824d6-4c83-4e3f-8a2c-4447d7babf3c",
		"name": "My Media",
		"creator": 0, // TRELLO
		"creatorId": "5a6824e971636a279de0a93e",
		"type": 1, // TV
		"source": 1, // MAGNET
		"sourceURI": "....",
		"metadata": 0, // MyAnimeList (1 is IMDB)
		"metadataId": "24833",
		"status": 4 // DEPLOYED
	}
}
```

## /v1/queue

## Requeue Media

**Endpoint**: POST - https://app.tritonjs.com/v1/queue/:id

**Description**: Requeues a media file for processing. Don't use this unless you have too.

#### Response

```json
{
	"success": true,
	"data": {
		"id": "ef8824d6-4c83-4e3f-8a2c-4447d7babf3c",
		"name": "My Media",
		"creator": 0, // TRELLO
		"creatorId": "5a6824e971636a279de0a93e",
		"type": 1, // TV
		"source": 1, // MAGNET
		"sourceURI": "....",
		"metadata": 0, // MyAnimeList (1 is IMDB)
		"metadataId": "24833",
		"status": 4 // DEPLOYED
	}
}
```

## /v1/token

## Create a new Token

**Endpoint**: POST - https://app.tritonjs.com/v1/token

**Description**: Creates a new API token

#### Response

```json
{
	"success": true,
	"data": ":128-token"
}
```
