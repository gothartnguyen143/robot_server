# Robot Server - Image Processing API

Backend server Node.js cho xử lý ảnh với các API quản lý hash và kết quả.

## Cài đặt

```bash
npm install
```

## Chạy server

```bash
# Development
npm run dev

# Production
npm start
```

## Cấu hình

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Các biến quan trọng:
- `UPLOAD_DIR`: Thư mục lưu ảnh tạm (mặc định: `./uploads`)
- `PORT`: Port server (mặc định: 3000)

## APIs

### Image Processing APIs (theo task)

#### 1. Upload ảnh
**POST** `/api/upload`

Upload ảnh và trả về mã hash duy nhất.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: `image` (file ảnh)

**Response:**
```json
{
  "success": true,
  "hash": "a1b2c3d4e5f6...",
  "message": "Image uploaded successfully"
}
```

#### 2. Lấy danh sách hash
**GET** `/api/list-hash-images`

Lấy tất cả mã hash hiện có trên server.

**Response:**
```json
{
  "success": true,
  "hashes": ["hash1", "hash2", ...],
  "count": 2
}
```

#### 3. Hiển thị ảnh
**GET** `/api/process/{hash}`

Trả về file ảnh tương ứng với hash.

**Response:** Binary image data

#### 4. Đẩy kết quả
**POST** `/api/process/{hash}/result`

Lưu kết quả cho hash và xóa ảnh tạm.

**Request:**
```json
{
  "result": "processed_result_data"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Result stored and temporary image deleted"
}
```

#### 5. Lấy kết quả
**GET** `/api/get/{hash}`

Lấy kết quả của hash và xóa hash khỏi bộ nhớ.

**Response:**
```json
{
  "success": true,
  "result": "processed_result_data"
}
```

### Legacy Image APIs
- `POST /api/v1/images` - Upload nhiều ảnh
- `GET /api/v1/images` - Lấy danh sách ảnh với filter/pagination
- `GET /api/v1/images/:filename` - Lấy thông tin ảnh
- `GET /api/v1/images/:filename/download` - Download ảnh
- `PUT /api/v1/images/:filename/replace` - Thay thế ảnh
- `DELETE /api/v1/images/:filename` - Xóa ảnh
- `DELETE /api/v1/images/batch-delete` - Xóa nhiều ảnh

## Cấu trúc dữ liệu

Server sử dụng Map in-memory để lưu trữ:

```javascript
Map {
  "hash": {
    src_path_img: "/path/to/temp/image.jpg",
    result: null // hoặc dữ liệu kết quả
  }
}
```

## Lưu ý

- Ảnh được lưu trong thư mục tạm và sẽ bị xóa sau khi đẩy kết quả
- Hash được đảm bảo duy nhất
- Server không có persistence, dữ liệu sẽ mất khi restart

## Health Check

**GET** `/health`

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Cấu trúc thư mục

```
robot_server/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   └── app.js
├── uploads/
├── tests/
├── public/
├── package.json
├── .env
└── README.md
```