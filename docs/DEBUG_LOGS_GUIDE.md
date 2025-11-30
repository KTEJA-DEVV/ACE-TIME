# AceTime Debug Logs Guide

## Overview
This guide explains how to use debug logs to verify all features are working, especially transcription.

## Debug Log Prefixes

### Frontend Logs (Browser Console)
- `[SOCKET]` - Socket.IO connection events
- `[SPEECH]` - Web Speech API transcription
- `[TRANSCRIPT]` - Transcript processing and display
- `[RECORDING]` - Call recording (MediaRecorder)
- `[WEBRTC]` - WebRTC peer connection
- `[ROOM]` - Room join/leave events
- `[CALL]` - Call lifecycle events
- `[JOIN]` - Room joining process

### Backend Logs (Server Terminal)
- `[TRANSCRIPT]` - Server-side transcript processing
- `[SOCKET]` - Socket.IO server events
- `[ROOM]` - Room management
- `[CALL]` - Call session management
- `[IMAGES]` - Image generation (DALL-E)
- `[OPENAI]` - OpenAI API calls

## Testing Transcription

### Step 1: Open Browser Console
1. Open Chrome/Edge browser (Web Speech API required)
2. Press `F12` or `Ctrl+Shift+I` to open DevTools
3. Go to the **Console** tab

### Step 2: Start a Call
1. Login to AceTime
2. Click "Start New Call"
3. Share the room code with another user
4. Both users join the call

### Step 3: Check Logs

#### Expected Frontend Logs:
```
[SPEECH] ✅ Web Speech API is available
[SPEECH] ✅ Speech recognition started
[SPEECH] Language: en-US
[SPEECH] Continuous: true
[SPEECH] Interim results: true
[SPEECH] 📝 onresult event: { resultIndex: 0, resultsLength: 1 }
[SPEECH] Result 0: { transcript: "Hello", isFinal: false, confidence: 0.9 }
[SPEECH] 📝 Interim transcript: Hello
[SPEECH] ✅ Final transcript: Hello world
[SPEECH] 📤 Sending transcript to server: { text: "Hello world", roomId: "...", socketConnected: true }
[TRANSCRIPT] ✅ Received transcript chunk: { speaker: "User Name", text: "Hello world", ... }
[TRANSCRIPT] ✅ Adding new segment from: User Name
[TRANSCRIPT] ✅ Updated transcript length: 1
```

#### Expected Backend Logs:
```
[TRANSCRIPT] 📥 Received transcript:manual event: { text: "Hello world", roomId: "...", userName: "User Name", userId: "..." }
[TRANSCRIPT] 🔍 Room state: { roomId: "...", callId: "...", participantsCount: 2, ... }
[TRANSCRIPT] ✅ Created segment: { speaker: "User Name", text: "Hello world", ... }
[TRANSCRIPT] ✅ Saved to database, total segments: 1
[TRANSCRIPT] 📤 Emitting transcript:chunk to room: ...
[TRANSCRIPT] Room has 2 participant(s)
[TRANSCRIPT] ✅ Emitted transcript chunk to all participants in room
```

### Step 4: Verify Transcription
- **Both users should see transcripts** in the "Live Transcript" tab
- **Speaker names should be correct** (not showing same name for both)
- **Interim transcripts** should appear while speaking (gray text)
- **Final transcripts** should appear after a pause (normal text)

## Common Issues & Solutions

### Issue: "No transcription showing"
**Check:**
1. Browser console for `[SPEECH]` logs
2. Microphone permissions granted
3. User is not muted
4. Web Speech API is supported (Chrome/Edge only)

**Solution:**
- Check browser console for errors
- Ensure microphone permission is granted
- Unmute if muted
- Use Chrome or Edge browser

### Issue: "Only one user's transcription showing"
**Check:**
1. Both users have speech recognition active
2. Both users are not muted
3. Socket.IO connection is active for both
4. Backend logs show both users' transcripts received

**Solution:**
- Ensure both users have microphone access
- Check both browser consoles for `[SPEECH] ✅ Speech recognition started`
- Verify both users are in the same room
- Check backend logs for `[TRANSCRIPT] Room has 2 participant(s)`

### Issue: "Duplicate transcripts"
**Check:**
- Frontend logs show `[TRANSCRIPT] ⚠️ Duplicate segment, skipping`
- This is normal - duplicate detection is working

**Solution:**
- No action needed - duplicates are automatically filtered

## Testing All Features

### Feature 1: AI-Recorded Calls
**Test:**
1. Start a call
2. Speak for 30+ seconds
3. Check console for `[SPEECH]` and `[TRANSCRIPT]` logs
4. Check `[RECORDING]` logs for recording activity
5. End call and check History page for recording

**Expected Logs:**
- `[RECORDING] ✅ Started call recording`
- `[RECORDING] Chunk recorded: X bytes`
- `[RECORDING] ✅ Recording uploaded successfully`

### Feature 2: Messaging
**Test:**
1. Go to Messages page
2. Create/join a conversation
3. Send a message
4. Check console for Socket.IO message events

**Expected Logs:**
- `💬 User joined conversation`
- `message:new` event received

### Feature 3: Dreamweaving
**Test:**
1. During a call, open Dreamweaving tab
2. Enter a prompt and generate image
3. Check console for image generation logs

**Expected Logs:**
- `[IMAGES] Generating image with prompt: ...`
- `[IMAGES] ✅ Image generated successfully`
- `image:generated` event received

### Feature 4: Network Hub
**Test:**
1. Go to Network page
2. Create a Vision/Lead/Offer
3. Trigger matching
4. Check backend logs for AI matching

**Expected Logs:**
- `[NETWORK] Creating vision/lead/offer`
- `[NETWORK] Running AI matching`
- `[OPENAI] GPT-4o matching complete`

## Running Automated Tests

Run the test script:
```bash
cd backend
node test-features.js
```

This will test:
- Backend health
- Authentication
- All API endpoints
- Feature status

## Debug Mode

To enable verbose logging, check:
- Browser console is open
- Backend terminal is visible
- All logs are prefixed with feature tags

## Quick Verification Checklist

- [ ] Backend health check passes
- [ ] Frontend loads without errors
- [ ] Login/Register works
- [ ] Can create/join rooms
- [ ] WebRTC connection established
- [ ] Speech recognition starts (`[SPEECH] ✅ Speech recognition started`)
- [ ] Transcripts appear for both users
- [ ] Recording starts (`[RECORDING] ✅ Started call recording`)
- [ ] Messages send/receive in real-time
- [ ] Image generation works (if OpenAI quota available)
- [ ] Network Hub features accessible

## Notes

- **Web Speech API** only works in Chrome/Edge
- **Transcription** requires microphone permissions
- **Both users** must have speech recognition active
- **OpenAI quota** may limit image generation
- **Socket.IO** must be connected for real-time features

