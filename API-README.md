# API Documentation - Pupuk SDL

Base URL: `http://localhost:3001/api`

## Health Check

### GET /api/health

Check if the API is running.

**Response:**

```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2025-08-03T10:30:00.000Z"
}
```

## Raw Data Endpoints

### POST /api/data/raw

Save raw sensor data from ESP.

**Request Body:**

```json
{
  "timestamp": "2025-08-03T10:30:00.000Z",
  "variables": {
    "pH": 6.8,
    "suhu": 28,
    "kelembaban": 65,
    "N": 45,
    "P": 20,
    "K": 35,
    "EC": 1.2
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Raw data saved successfully",
  "data": {
    "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "timestamp": "2025-08-03T10:30:00.000Z",
    "variables": {
      "pH": 6.8,
      "suhu": 28,
      "kelembaban": 65,
      "N": 45,
      "P": 20,
      "K": 35,
      "EC": 1.2
    },
    "createdAt": "2025-08-03T10:30:00.000Z"
  }
}
```

### GET /api/data/raw

Get the latest raw data.

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "timestamp": "2025-08-03T10:30:00.000Z",
    "variables": {
      "pH": 6.8,
      "suhu": 28,
      "kelembaban": 65,
      "N": 45,
      "P": 20,
      "K": 35,
      "EC": 1.2
    },
    "createdAt": "2025-08-03T10:30:00.000Z"
  }
}
```

### GET /api/data/raw/history

Get raw data history.

**Query Parameters:**

- `limit` (optional): Number of records to return (default: 50)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "timestamp": "2025-08-03T10:30:00.000Z",
      "variables": {
        "pH": 6.8,
        "suhu": 28,
        "kelembaban": 65,
        "N": 45,
        "P": 20,
        "K": 35,
        "EC": 1.2
      },
      "createdAt": "2025-08-03T10:30:00.000Z"
    }
  ]
}
```

### DELETE /api/data/raw/:id

Delete a specific raw data record.

**Response:**

```json
{
  "success": true,
  "message": "Raw data deleted successfully"
}
```

### DELETE /api/data/raw

Delete all raw data records.

**Response:**

```json
{
  "success": true,
  "message": "All raw data deleted successfully"
}
```

## Calibrated Data Endpoints

### POST /api/data/calibrated

Save calibrated sensor data.

**Request Body:**

```json
{
  "timestamp": "2025-08-03T10:30:00.000Z",
  "variables": {
    "pH": 6.8,
    "suhu": 28,
    "kelembaban": 65,
    "N": 45,
    "P": 20,
    "K": 35,
    "EC": 1.2
  }
}
```

### GET /api/data/calibrated

Get the latest calibrated data.

### GET /api/data/calibrated/history

Get calibrated data history.

### DELETE /api/data/calibrated/:id

Delete a specific calibrated data record.

### DELETE /api/data/calibrated

Delete all calibrated data records.

_(Response formats are similar to Raw Data endpoints)_

## Recommendation Endpoints

### POST /api/recommendation

Get fertilizer recommendation based on pH, N, and K values.

**Request Body:**

```json
{
  "pH": 6.8,
  "N": 45,
  "K": 35
}
```

**Response:**

```json
{
  "success": true,
  "message": "Recommendation generated successfully",
  "data": {
    "recommendation": {
      "urea": 120,
      "sp36": 80,
      "kcl": 60
    },
    "timestamp": "2025-08-03T10:30:00.000Z"
  }
}
```

### GET /api/recommendation/history

Get recommendation history.

**Query Parameters:**

- `limit` (optional): Number of records to return (default: 50)

## Postman Usage Examples

### 1. Send Raw Data from ESP

- Method: POST
- URL: `http://localhost:3001/api/data/raw`
- Body (raw JSON):

```json
{
  "timestamp": "2025-08-03T10:30:00.000Z",
  "variables": {
    "pH": 6.8,
    "suhu": 28,
    "kelembaban": 65,
    "N": 45,
    "P": 20,
    "K": 35,
    "EC": 1.2
  }
}
```

### 2. Get Latest Raw Data

- Method: GET
- URL: `http://localhost:3001/api/data/raw`

### 3. Get Raw Data History

- Method: GET
- URL: `http://localhost:3001/api/data/raw/history?limit=10`

### 4. Get Recommendation

- Method: POST
- URL: `http://localhost:3001/api/recommendation`
- Body (raw JSON):

```json
{
  "pH": 6.8,
  "N": 45,
  "K": 35
}
```

### 5. Delete All Raw Data

- Method: DELETE
- URL: `http://localhost:3001/api/data/raw`

## Data Format

All sensor data should follow this format:

```json
{
  "timestamp": "ISO 8601 timestamp",
  "variables": {
    "pH": "pH value (0-14)",
    "suhu": "temperature in Celsius (0-100)",
    "kelembaban": "humidity percentage (0-100)",
    "N": "Nitrogen value (0-100)",
    "P": "Phosphorus value (0-100)",
    "K": "Potassium value (0-100)",
    "EC": "Electrical Conductivity (0-10)"
  }
}
```

## Error Responses

All endpoints return error responses in this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Success Responses

All endpoints return success responses with a `success: true` field when operations complete successfully.
