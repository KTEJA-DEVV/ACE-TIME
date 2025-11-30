# AceTime - AI-Powered Video Calling

AceTime is a FaceTime alternative with AI-powered real-time transcription and smart notes.

## 🎯 Features (MVP)

- **1:1 Video/Audio Calls** - WebRTC-powered peer-to-peer calling
- **Live Transcription** - Real-time speech-to-text using Web Speech API
- **AI Notes** - Automatic summaries, action items, and insights
- **Call Recording** - Audio/video saved to MongoDB GridFS
- **Call History** - Searchable transcript and notes archive
- **Chat Interface** - Continue conversations from calls
- **Network Hub** - Connect leads and offers with contacts

## 🏗️ Project Structure

```
acetime/
├── backend/             # Node.js + Express API server
│   ├── src/
│   │   ├── index.ts     # Main server entry
│   │   ├── models/      # MongoDB models
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic (JWT, OpenAI, Storage)
│   │   ├── middleware/  # Express middleware (auth, error handling)
│   │   └── socket/      # Socket.IO handlers
│   ├── .env             # Environment variables
│   └── package.json
├── frontend/            # React + Vite web app
│   ├── src/
│   │   ├── pages/       # Page components (Home, CallRoom, History, etc.)
│   │   ├── components/  # Reusable components (Toast, ErrorBoundary)
│   │   ├── store/       # Zustand state management
│   │   └── utils/       # Utility functions
│   └── package.json
└── docs/                # Documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- OpenAI API key (optional - works without it in mock mode)

### Environment Variables

Create `backend/.env`:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/acetime
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
OPENAI_API_KEY=sk-your-openai-key  # Optional - enables AI notes/transcription
STABILITY_API_KEY=sk-your-stability-key  # Optional - enables image generation (FREE tier available)
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

**Note:** 
- The app works without `OPENAI_API_KEY` - it will use mock transcription/notes for development.
- For image generation, use `STABILITY_API_KEY` (free tier available at https://platform.stability.ai/) or `OPENAI_API_KEY` (paid).

### Installation

1. **Install root dependencies:**
   ```bash
   npm install
   ```

2. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

### Running the App

1. **Start MongoDB** (if using local):
   ```bash
   mongod
   ```

2. **Start both backend and frontend** (recommended):
   ```bash
   npm run dev
   ```

   Or start them separately:

3. **Start the backend API server:**
   ```bash
   npm run dev:backend
   # Or: cd backend && npm run dev
   ```

4. **Start the frontend web app:**
   ```bash
   npm run dev:frontend
   # Or: cd frontend && npm run dev
   ```

## 📍 Access Points

- **Backend API**: `http://localhost:3001`
- **Frontend Web App**: `http://localhost:3000`

## 🛠️ Available Scripts

### Root Level

- `npm run dev` - Start both backend and frontend concurrently
- `npm run dev:backend` - Start only backend
- `npm run dev:frontend` - Start only frontend
- `npm run build` - Build both backend and frontend
- `npm run build:backend` - Build only backend
- `npm run build:frontend` - Build only frontend
- `npm run install:all` - Install dependencies for all projects

### Backend (`backend/`)

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

### Frontend (`frontend/`)

- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 🔧 Tech Stack

### Backend
- **Node.js** + **Express** - REST API server
- **Socket.IO** - Real-time WebSocket communication
- **MongoDB** + **Mongoose** - Database and ODM
- **MongoDB GridFS** - File storage for recordings
- **JWT** - Authentication
- **OpenAI API** - AI transcription and notes generation

### Frontend
- **React** + **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Socket.IO Client** - Real-time communication
- **WebRTC** - Peer-to-peer video/audio
- **Web Speech API** - Client-side transcription

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/verify` - Verify token validity

### Calls
- `POST /api/rooms` - Create new call room
- `POST /api/rooms/:roomId/join` - Join existing room
- `GET /api/calls/:id` - Get call details
- `GET /api/calls/:id/transcript` - Get call transcript
- `GET /api/calls/:id/notes` - Get AI notes
- `POST /api/calls/:id/recording` - Upload recording

### Users
- `GET /api/users/history` - Get call history
- `GET /api/users/stats` - Get user statistics
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/settings` - Update settings

### Messages
- `GET /api/messages/conversations` - Get conversations
- `POST /api/messages/conversations` - Create conversation
- `POST /api/messages/conversations/from-call` - Create from call
- `GET /api/messages/conversations/:id/messages` - Get messages
- `POST /api/messages/conversations/:id/messages` - Send message

## 🧪 Development

### Backend Development

The backend uses TypeScript with `tsx` for hot reloading. Changes to source files will automatically restart the server.

### Frontend Development

The frontend uses Vite for fast HMR (Hot Module Replacement). Changes to React components will update instantly in the browser.

## 📝 Notes

- The app requires MongoDB to be running (local or Atlas)
- OpenAI API key is optional - the app works in mock mode without it
- Web Speech API requires Chrome or Edge browser for transcription
- All recordings are stored in MongoDB GridFS (no external storage needed)

## 📄 License

MIT
