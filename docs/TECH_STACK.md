# AceTime - Complete Tech Stack Documentation

## 📋 Overview

AceTime is built using the **MERN stack** (MongoDB, Express, React, Node.js) with modern web technologies and AI integrations.

---

## 🔧 Backend Tech Stack

### Core Framework & Runtime
- **Node.js** (v18+) - JavaScript runtime
- **TypeScript** (v5.3.2) - Type-safe JavaScript
- **Express.js** (v4.18.2) - Web application framework
- **tsx** (v4.6.0) - TypeScript execution for development

### Database & Storage
- **MongoDB** (v8.0.1 via Mongoose) - NoSQL database
- **Mongoose** (v8.0.1) - MongoDB object modeling (ODM)
- **MongoDB GridFS** - File storage for call recordings (video/audio)

### Authentication & Security
- **jsonwebtoken** (v9.0.2) - JWT token generation and verification
- **bcryptjs** (v2.4.3) - Password hashing
- **express-validator** (v7.0.1) - Input validation middleware

### Real-Time Communication
- **Socket.IO** (v4.7.2) - WebSocket server for real-time features
  - WebRTC signaling
  - Real-time message delivery
  - Live transcription updates
  - Image generation notifications
  - Reaction updates

### File Handling
- **multer** (v1.4.5-lts.1) - Multipart/form-data handling for file uploads
  - Used for call recordings
  - Message attachments (images, files, audio)

### HTTP & CORS
- **cors** (v2.8.5) - Cross-Origin Resource Sharing middleware
- **http** (Node.js built-in) - HTTP server

### Utilities
- **uuid** (v9.0.1) - Unique identifier generation
- **dotenv** (v16.3.1) - Environment variable management

### Development Tools
- **@types/node** (v20.9.4) - TypeScript definitions for Node.js
- **@types/express** (v4.17.21) - TypeScript definitions for Express
- **@types/bcryptjs** (v2.4.6) - TypeScript definitions
- **@types/jsonwebtoken** (v9.0.5) - TypeScript definitions
- **@types/multer** (v1.4.10) - TypeScript definitions
- **@types/cors** (v2.8.16) - TypeScript definitions
- **@types/uuid** (v9.0.7) - TypeScript definitions

---

## 🎨 Frontend Tech Stack

### Core Framework
- **React** (v18.2.0) - UI library
- **React DOM** (v18.2.0) - React rendering
- **TypeScript** (v5.3.2) - Type-safe JavaScript

### Build Tools & Dev Server
- **Vite** (v5.0.7) - Fast build tool and dev server
- **@vitejs/plugin-react** (v4.2.1) - React plugin for Vite

### Routing
- **react-router-dom** (v6.20.1) - Client-side routing
  - Protected routes
  - Navigation between pages
  - URL parameters

### State Management
- **Zustand** (v4.4.7) - Lightweight state management
  - `auth.ts` - Authentication state
  - `call.ts` - Call state and WebRTC logic

### Styling
- **Tailwind CSS** (v3.3.6) - Utility-first CSS framework
- **PostCSS** (v8.4.32) - CSS processing
- **Autoprefixer** (v10.4.16) - CSS vendor prefixing
- **Custom CSS** - Glass morphism effects, animations

### Icons
- **lucide-react** (v0.294.0) - Icon library
  - 1000+ icons used throughout the UI

### Real-Time Communication
- **socket.io-client** (v4.7.2) - WebSocket client
  - Real-time message delivery
  - Live transcription updates
  - Image generation notifications
  - Reaction updates

### Development Tools
- **@types/react** (v18.2.43) - TypeScript definitions
- **@types/react-dom** (v18.2.17) - TypeScript definitions

---

## 🌐 External APIs & Services

### AI Services

#### OpenAI API
- **Service**: OpenAI Platform
- **SDK**: `openai` (v4.20.1)
- **Models Used**:
  - **GPT-4o** - AI notes generation, chat responses, network matching
  - **DALL-E 3** - Image generation (optional, fallback)
- **Endpoints Used**:
  - `chat.completions.create()` - Text generation
  - `images.generate()` - Image generation
- **Features**:
  - Real-time meeting notes
  - Action items extraction
  - AI chat responses (`@ai` mentions)
  - Network matching (Vision/Lead/Offer scoring)
  - Image generation (if Stability AI not configured)

#### Stability AI API
- **Service**: Stability AI Platform
- **SDK**: Native `fetch` API
- **Model**: Stable Diffusion XL (stable-diffusion-xl-1024-v1-0)
- **Endpoint**: `https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`
- **Features**:
  - Free tier available
  - High-quality image generation
  - Multiple style options (realistic, artistic, sketch, dream, abstract)
  - Real-time image generation during calls

### WebRTC Services
- **Google STUN Servers**:
  - `stun:stun.l.google.com:19302`
  - `stun:stun1.l.google.com:19302`
- **Purpose**: NAT traversal for peer-to-peer connections

---

## 🌍 Browser APIs (Frontend)

### WebRTC APIs
- **RTCPeerConnection** - Peer-to-peer video/audio connections
- **MediaStream** - Camera and microphone access
- **MediaStreamTrack** - Individual audio/video tracks
- **RTCSessionDescription** - WebRTC offer/answer
- **RTCIceCandidate** - ICE candidate exchange

### Media APIs
- **MediaRecorder API** - Call recording (video/audio)
  - Records both local and remote streams
  - Supports multiple codecs (WebM, MP4)
  - Chunked recording for large files

### Speech Recognition
- **Web Speech API** - Client-side real-time transcription
  - `SpeechRecognition` / `webkitSpeechRecognition`
  - Continuous recognition
  - Interim results
  - Language: en-US
  - Browser support: Chrome, Edge

### Storage APIs
- **localStorage** - Client-side data persistence
  - Access tokens
  - Refresh tokens
  - User data

### Clipboard API
- **navigator.clipboard** - Copy room codes to clipboard

### File APIs
- **File API** - File selection and reading
- **FormData API** - File uploads
- **Blob API** - Binary data handling

---

## 🗄️ Database Models (MongoDB)

### Core Models
1. **User** - User accounts and profiles
2. **CallSession** - Call metadata and recordings
3. **Transcript** - Call transcripts with segments
4. **Notes** - AI-generated meeting notes
5. **Conversation** - Chat conversations (direct/group)
6. **Message** - Chat messages with reactions and attachments
7. **GeneratedImage** - Dreamweaving images
8. **Vision** - Network hub visions
9. **Lead** - Network hub leads
10. **Offer** - Network hub offers
11. **Match** - AI-powered matches
12. **Connection** - User connections

---

## 🔐 Authentication & Authorization

### JWT (JSON Web Tokens)
- **Access Tokens** - Short-lived (1 hour)
- **Refresh Tokens** - Long-lived (7 days)
- **Algorithm**: HS256
- **Storage**: 
  - Backend: Environment variables (JWT_SECRET, JWT_REFRESH_SECRET)
  - Frontend: localStorage

### Password Security
- **bcryptjs** - Password hashing
- **Salt rounds**: 10 (default)

---

## 📡 Real-Time Features (Socket.IO)

### Events Emitted (Client → Server)
- `room:join` - Join a call room
- `room:leave` - Leave a call room
- `signal:offer` - WebRTC offer
- `signal:answer` - WebRTC answer
- `signal:candidate` - ICE candidate
- `transcript:manual` - Send transcript chunk
- `notes:request` - Request AI notes update
- `call:end` - End call
- `conversation:join` - Join conversation room
- `conversation:leave` - Leave conversation room
- `typing:start` - Typing indicator start
- `typing:stop` - Typing indicator stop
- `image:request` - Request image generation

### Events Received (Server → Client)
- `connect` - Socket connected
- `connect_error` - Connection error
- `room:joined` - Room join confirmation
- `user:joined` - User joined room
- `user:left` - User left room
- `signal:offer` - WebRTC offer received
- `signal:answer` - WebRTC answer received
- `signal:candidate` - ICE candidate received
- `call:started` - Call started
- `call:ended` - Call ended
- `transcript:chunk` - Transcript segment received
- `ai:notes` - AI notes update
- `message:new` - New message received
- `message:reaction` - Reaction update
- `image:generated` - Image generation complete
- `image:generating` - Image generation started

---

## 🛣️ API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User login
- `POST /refresh` - Refresh access token
- `GET /verify` - Verify token validity

### Rooms (`/api/rooms`)
- `POST /` - Create new room
- `POST /:roomId/join` - Join room

### Calls (`/api/calls`)
- `GET /:id` - Get call details
- `GET /:id/transcript` - Get transcript
- `GET /:id/notes` - Get AI notes
- `POST /:id/recording` - Upload recording
- `GET /:id/recording/stream` - Stream recording

### Users (`/api/users`)
- `GET /history` - Get call history
- `GET /stats` - Get user statistics
- `PUT /profile` - Update profile
- `PUT /settings` - Update settings

### Messages (`/api/messages`)
- `GET /conversations` - Get all conversations
- `POST /conversations` - Create conversation
- `POST /conversations/from-call` - Create from call
- `GET /conversations/:id/messages` - Get messages
- `POST /conversations/:id/messages` - Send message
- `POST /conversations/:id/breakout` - Create private breakout
- `POST /conversations/:id/messages/:messageId/reaction` - Add/remove reaction
- `POST /upload` - Upload file attachment
- `GET /files/:fileId` - Get uploaded file

### Images (`/api/images`)
- `POST /generate` - Generate image
- `POST /generate-from-call` - Generate from call transcript
- `GET /call/:callId` - Get images for call
- `GET /my` - Get user's images
- `POST /:id/like` - Like an image

### Network (`/api/network`)
- `GET /visions` - Get visions
- `POST /visions` - Create vision
- `GET /leads` - Get leads
- `POST /leads` - Create lead
- `GET /offers` - Get offers
- `POST /offers` - Create offer
- `POST /match/find` - Find matches

### Health
- `GET /health` - Health check endpoint

---

## 🎯 Key Features & Technologies

### Feature 1: AI-Recorded Calls
- **WebRTC** - Peer-to-peer video/audio
- **MediaRecorder API** - Client-side recording
- **MongoDB GridFS** - Server-side storage
- **Web Speech API** - Real-time transcription
- **OpenAI GPT-4o** - AI notes generation

### Feature 2: Messaging
- **Socket.IO** - Real-time message delivery
- **MongoDB** - Message storage
- **Multer** - File upload handling
- **OpenAI GPT-4o** - AI chat responses

### Feature 3: Dreamweaving
- **Stability AI API** - Image generation (primary)
- **OpenAI DALL-E 3** - Image generation (fallback)
- **Socket.IO** - Real-time image updates

### Feature 4: Network Hub
- **OpenAI GPT-4o** - AI-powered matching
- **MongoDB** - Vision/Lead/Offer storage
- **Matching Algorithm** - Multi-arch scoring

---

## 🔧 Development Tools

### Root Level
- **concurrently** (v8.2.2) - Run multiple npm scripts simultaneously

### Code Quality
- **ESLint** - Linting (configured but not in package.json)
- **TypeScript** - Type checking

---

## 📦 Project Structure

```
acetime/
├── backend/              # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── index.ts      # Server entry point
│   │   ├── models/       # MongoDB models (Mongoose)
│   │   ├── routes/       # Express routes
│   │   ├── services/     # Business logic
│   │   │   ├── jwt.ts    # JWT token management
│   │   │   ├── openai.ts # OpenAI integration
│   │   │   ├── stability.ts # Stability AI integration
│   │   │   └── storage.ts   # GridFS storage
│   │   ├── middleware/   # Express middleware
│   │   │   ├── auth.ts   # JWT authentication
│   │   │   └── errorHandler.ts # Error handling
│   │   └── socket/       # Socket.IO handlers
│   ├── .env             # Environment variables
│   └── package.json
├── frontend/             # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── store/        # Zustand stores
│   │   └── utils/        # Utility functions
│   └── package.json
└── docs/                 # Documentation
```

---

## 🌐 Environment Variables

### Backend (`backend/.env`)
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/acetime
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
OPENAI_API_KEY=sk-...          # Optional - AI features
STABILITY_API_KEY=sk-...       # Optional - Image generation (FREE)
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

### Frontend (`frontend/.env` or Vite)
```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

---

## 📊 Technology Summary

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB + Mongoose
- **Storage**: MongoDB GridFS
- **Real-time**: Socket.IO
- **Auth**: JWT + bcryptjs
- **File Upload**: Multer
- **AI**: OpenAI API, Stability AI API

### Frontend
- **Framework**: React
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Routing**: React Router DOM
- **Icons**: Lucide React
- **Real-time**: Socket.IO Client
- **Video/Audio**: WebRTC APIs
- **Transcription**: Web Speech API
- **Recording**: MediaRecorder API

### External Services
- **OpenAI** - GPT-4o, DALL-E 3
- **Stability AI** - Stable Diffusion XL
- **Google STUN** - WebRTC NAT traversal
- **MongoDB Atlas** (optional) - Cloud database

---

## 🚀 Deployment Considerations

### Backend
- Node.js 18+ required
- MongoDB connection required
- Environment variables must be set
- Port 3001 (configurable)

### Frontend
- Modern browser required (Chrome/Edge for Web Speech API)
- HTTPS recommended for production (WebRTC requirement)
- Vite build for production

### Browser Support
- **Chrome/Edge**: Full support (Web Speech API, WebRTC, MediaRecorder)
- **Firefox**: Limited (no Web Speech API)
- **Safari**: Limited (no Web Speech API, limited WebRTC)

---

## 📝 License

MIT License

